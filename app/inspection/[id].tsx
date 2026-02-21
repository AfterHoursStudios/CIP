import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  TextInput,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as inspectionService from '../../src/services/inspection.service';
import * as hcpService from '../../src/services/housecallpro.service';
import * as pdfService from '../../src/services/pdf.service';
import * as templateService from '../../src/services/checklist-template.service';
import { Button } from '../../src/components/ui';
import TemplateSelector from '../../src/components/TemplateSelector';
import MeasurementInput from '../../src/components/MeasurementInput';
import { useCompany } from '../../src/contexts';
import type { Inspection, InspectionItem, ItemStatus, MeasurementValue } from '../../src/types';
import type { ChecklistTemplate } from '../../src/services/checklist-template.service';

const STATUS_OPTIONS: { value: ItemStatus; label: string; color: string; bgColor: string }[] = [
  { value: 'satisfactory', label: 'Satisfactory', color: '#15803d', bgColor: '#dcfce7' },
  { value: 'recommended', label: 'Recommended', color: '#ca8a04', bgColor: '#fef9c3' },
  { value: 'unsafe', label: 'Unsafe', color: '#dc2626', bgColor: '#fee2e2' },
  { value: 'na', label: 'N/A', color: '#2563eb', bgColor: '#dbeafe' },
];

interface CategoryGroup {
  category: string;
  items: InspectionItem[];
  isExpanded: boolean;
}

export default function InspectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentCompany } = useCompany();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncingToHcp, setIsSyncingToHcp] = useState(false);
  const [isHcpConnected, setIsHcpConnected] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [isClearingChecklist, setIsClearingChecklist] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [uploadingPhotoItemId, setUploadingPhotoItemId] = useState<string | null>(null);

  const loadInspection = useCallback(async () => {
    if (!id) return;

    const { data, error } = await inspectionService.getInspectionById(id);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error loading inspection: ' + error);
      } else {
        Alert.alert('Error', error);
      }
      return;
    }

    if (data) {
      setInspection(data);
      setNotes(data.notes || '');

      // Group items by category
      const grouped = (data.items || []).reduce((acc, item) => {
        const existing = acc.find((g) => g.category === item.category);
        if (existing) {
          existing.items.push(item);
        } else {
          acc.push({ category: item.category, items: [item], isExpanded: true });
        }
        return acc;
      }, [] as CategoryGroup[]);

      // Sort items within each category by sort_order
      grouped.forEach((g) => g.items.sort((a, b) => a.sort_order - b.sort_order));

      setCategories(grouped);
    }
  }, [id]);

  useEffect(() => {
    loadInspection().finally(() => setIsLoading(false));
  }, [loadInspection]);

  // Check HCP connection
  useEffect(() => {
    if (currentCompany) {
      hcpService.isConnected(currentCompany.id).then(setIsHcpConnected);
    }
  }, [currentCompany]);

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadInspection();
    setIsRefreshing(false);
  }

  function toggleCategory(categoryName: string) {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.category === categoryName ? { ...cat, isExpanded: !cat.isExpanded } : cat
      )
    );
  }

  async function handleStatusChange(item: InspectionItem, newStatus: ItemStatus) {
    // Toggle back to pending if clicking the same status
    const finalStatus = item.status === newStatus ? 'pending' : newStatus;

    setUpdatingItemId(item.id);

    const { error } = await inspectionService.updateItemStatus(item.id, finalStatus);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error updating status: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      // Update local state
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) => (i.id === item.id ? { ...i, status: finalStatus } : i)),
        }))
      );
    }

    setUpdatingItemId(null);
  }

  async function handleMeasurementChange(item: InspectionItem, value: MeasurementValue) {
    setUpdatingItemId(item.id);

    const { error } = await inspectionService.updateItemMeasurement(item.id, value);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error updating measurement: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      // Update local state
      setCategories((prev) =>
        prev.map((cat) => ({
          ...cat,
          items: cat.items.map((i) =>
            i.id === item.id ? { ...i, value, status: 'satisfactory' as ItemStatus } : i
          ),
        }))
      );
    }

    setUpdatingItemId(null);
  }

  function getStatusConfig(status: ItemStatus) {
    return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[3];
  }

  function getCategoryProgress(items: InspectionItem[]) {
    const completed = items.filter((i) => i.status !== 'pending').length;
    return { completed, total: items.length };
  }

  function getCompletionPercentage(): number {
    const allItems = categories.flatMap(cat => cat.items);
    if (allItems.length === 0) return 0;
    const completed = allItems.filter(i => i.status !== 'pending').length;
    return Math.round((completed / allItems.length) * 100);
  }

  function getStatusDisplay(): { text: string; style: object } {
    const percentage = getCompletionPercentage();

    // Prioritize actual percentage over saved status
    if (percentage === 100) {
      return {
        text: 'Finished',
        style: styles.status_completed
      };
    }

    if (percentage > 0) {
      return {
        text: `${percentage}% Complete`,
        style: styles.status_in_progress
      };
    }

    // No progress
    return {
      text: 'Not Started',
      style: styles.status_draft
    };
  }

  async function handleSelectTemplate(template: ChecklistTemplate) {
    if (!id) return;

    setIsApplyingTemplate(true);

    // Flatten template categories into items
    const items = templateService.flattenTemplateCategories(template.categories);
    const { error } = await inspectionService.bulkAddInspectionItems(id, items);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error applying template: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      setShowTemplateSelector(false);
      await loadInspection();
    }

    setIsApplyingTemplate(false);
  }

  async function handleChangeChecklist() {
    if (!id || !inspection) return;

    const doChange = async () => {
      setIsClearingChecklist(true);

      // Delete all existing checklist items
      const allItems = categories.flatMap(cat => cat.items);
      for (const item of allItems) {
        await inspectionService.deleteInspectionItem(item.id);
      }

      // Clear local state and show template selector
      setCategories([]);
      setShowTemplateSelector(true);
      setIsClearingChecklist(false);
    };

    if (Platform.OS === 'web') {
      if (confirm('This will clear the current checklist. Are you sure?')) {
        doChange();
      }
    } else {
      Alert.alert(
        'Change Checklist',
        'This will clear the current checklist. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Change', style: 'destructive', onPress: doChange },
        ]
      );
    }
  }

  async function handleSaveInspection(status: 'in_progress' | 'completed') {
    if (!id) return;

    setIsSaving(true);

    const { error } = await inspectionService.updateInspectionStatus(id, status);

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error saving inspection: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      if (Platform.OS === 'web') {
        alert('Inspection saved successfully!');
      } else {
        Alert.alert('Success', 'Inspection saved successfully!');
      }
      await loadInspection();
    }

    setIsSaving(false);
  }

  function handleDeleteInspection() {
    const doDelete = async () => {
      if (!id) return;

      setIsDeleting(true);

      const { error } = await inspectionService.deleteInspection(id);

      if (error) {
        if (Platform.OS === 'web') {
          alert('Error deleting inspection: ' + error);
        } else {
          Alert.alert('Error', error);
        }
        setIsDeleting(false);
      } else {
        // Navigate to schedule tab
        router.replace('/(tabs)/schedule');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete this inspection? This action cannot be undone.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Delete Inspection',
        'Are you sure you want to delete this inspection? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }

  async function handleSyncToHcp() {
    if (!inspection?.hcp_job_id || !currentCompany) return;

    setIsSyncingToHcp(true);

    // Generate PDF and upload to HCP
    const { data, error } = await pdfService.generateAndUploadReport(
      currentCompany.id,
      inspection.hcp_job_id,
      inspection,
      categories,
      currentCompany
    );

    if (error || !data) {
      if (Platform.OS === 'web') {
        alert('Error syncing to Housecall Pro: ' + (error || 'Unknown error'));
      } else {
        Alert.alert('Error', 'Failed to sync: ' + (error || 'Unknown error'));
      }
    } else {
      // Update sync timestamp
      await inspectionService.updateHcpSyncStatus(inspection.id);
      await loadInspection();

      if (Platform.OS === 'web') {
        alert('Inspection report PDF uploaded to Housecall Pro!');
      } else {
        Alert.alert('Success', 'Inspection report PDF uploaded to Housecall Pro!');
      }
    }

    setIsSyncingToHcp(false);
  }

  async function handleDownloadPdf() {
    if (!inspection || !currentCompany) return;

    setIsGeneratingPdf(true);

    // Generate PDF
    const { data, error } = await pdfService.generateInspectionPDF(
      inspection,
      categories,
      currentCompany
    );

    if (error || !data) {
      if (Platform.OS === 'web') {
        alert('Error generating PDF: ' + (error || 'Unknown error'));
      } else {
        Alert.alert('Error', 'Failed to generate PDF: ' + (error || 'Unknown error'));
      }
      setIsGeneratingPdf(false);
      return;
    }

    // Preview/share the PDF
    const previewResult = await pdfService.previewPDF(data.uri, data.blob, data.fileName);

    if (previewResult.error) {
      if (Platform.OS === 'web') {
        alert('Error opening PDF: ' + previewResult.error);
      } else {
        Alert.alert('Error', previewResult.error);
      }
    }

    setIsGeneratingPdf(false);
  }

  async function handleSaveNotes() {
    if (!id) return;

    setIsSavingNotes(true);

    const { error } = await inspectionService.updateInspection(id, { notes });

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error saving notes: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    }

    setIsSavingNotes(false);
  }

  async function handleAddPhoto(itemId: string) {
    if (!inspection || !currentCompany) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhotoItemId(itemId);

    // Upload photo to storage
    const { data: photoUrl, error: uploadError } = await inspectionService.uploadPhoto(
      currentCompany.id,
      inspection.id,
      result.assets[0].uri
    );

    if (uploadError || !photoUrl) {
      if (Platform.OS === 'web') {
        alert('Error uploading photo: ' + (uploadError || 'Unknown error'));
      } else {
        Alert.alert('Error', uploadError || 'Failed to upload photo');
      }
      setUploadingPhotoItemId(null);
      return;
    }

    // Add photo record to database
    const { error: addError } = await inspectionService.addItemPhoto(itemId, photoUrl);

    if (addError) {
      if (Platform.OS === 'web') {
        alert('Error saving photo: ' + addError);
      } else {
        Alert.alert('Error', addError);
      }
    } else {
      // Reload to get updated photos
      await loadInspection();
    }

    setUploadingPhotoItemId(null);
  }

  async function handleTakePhoto(itemId: string) {
    if (!inspection || !currentCompany) return;

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      if (Platform.OS === 'web') {
        alert('Camera permission is required to take photos');
      } else {
        Alert.alert('Permission Required', 'Camera permission is required to take photos');
      }
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhotoItemId(itemId);

    // Upload photo to storage
    const { data: photoUrl, error: uploadError } = await inspectionService.uploadPhoto(
      currentCompany.id,
      inspection.id,
      result.assets[0].uri
    );

    if (uploadError || !photoUrl) {
      if (Platform.OS === 'web') {
        alert('Error uploading photo: ' + (uploadError || 'Unknown error'));
      } else {
        Alert.alert('Error', uploadError || 'Failed to upload photo');
      }
      setUploadingPhotoItemId(null);
      return;
    }

    // Add photo record to database
    const { error: addError } = await inspectionService.addItemPhoto(itemId, photoUrl);

    if (addError) {
      if (Platform.OS === 'web') {
        alert('Error saving photo: ' + addError);
      } else {
        Alert.alert('Error', addError);
      }
    } else {
      // Reload to get updated photos
      await loadInspection();
    }

    setUploadingPhotoItemId(null);
  }

  async function handleDeletePhoto(photoId: string) {
    const doDelete = async () => {
      const { error } = await inspectionService.deleteItemPhoto(photoId);
      if (error) {
        if (Platform.OS === 'web') {
          alert('Error deleting photo: ' + error);
        } else {
          Alert.alert('Error', error);
        }
      } else {
        await loadInspection();
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this photo?')) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Photo', 'Are you sure you want to delete this photo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!inspection) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
        <Text style={styles.errorText}>Inspection not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: inspection.project_name,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Inspection Header */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            {inspection.project_address && (
              <View style={styles.headerRow}>
                <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.headerText}>{inspection.project_address}</Text>
              </View>
            )}
            {inspection.client_name && (
              <View style={styles.headerRow}>
                <Ionicons name="person-outline" size={16} color={COLORS.textSecondary} />
                <Text style={styles.headerText}>{inspection.client_name}</Text>
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.statusBadge, getStatusDisplay().style]}>
              <Text style={styles.statusText}>{getStatusDisplay().text}</Text>
            </View>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDeleteInspection}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.error} />
              ) : (
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Change Checklist Button - shown at top when checklist exists */}
        {categories.length > 0 && !showTemplateSelector && (
          <TouchableOpacity
            style={styles.changeChecklistBanner}
            onPress={handleChangeChecklist}
            disabled={isClearingChecklist}
          >
            {isClearingChecklist ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Ionicons name="swap-horizontal" size={20} color={COLORS.primary} />
                <Text style={styles.changeChecklistBannerText}>Change Checklist</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.gray400} />
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Categories */}
        {categories.length === 0 || showTemplateSelector ? (
          currentCompany ? (
            <View style={styles.templateSelectorContainer}>
              <TemplateSelector
                companyId={currentCompany.id}
                onSelect={handleSelectTemplate}
                onCancel={categories.length > 0 ? () => setShowTemplateSelector(false) : undefined}
                isLoading={isApplyingTemplate}
              />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          )
        ) : (
          <View style={styles.categoriesContainer}>
            {categories.map((cat) => {
              const progress = getCategoryProgress(cat.items);
              return (
                <View key={cat.category} style={styles.categoryCard}>
                  {/* Category Header */}
                  <TouchableOpacity
                    style={styles.categoryHeader}
                    onPress={() => toggleCategory(cat.category)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.categoryHeaderLeft}>
                      <Ionicons
                        name={cat.isExpanded ? 'chevron-down' : 'chevron-forward'}
                        size={20}
                        color={COLORS.textPrimary}
                      />
                      <Text style={styles.categoryTitle}>{cat.category}</Text>
                    </View>
                    <View style={styles.progressBadge}>
                      <Text style={styles.progressText}>
                        {progress.completed}/{progress.total}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {/* Category Items */}
                  {cat.isExpanded && (
                    <View style={styles.itemsContainer}>
                      {cat.items.map((item, index) => (
                        <View
                          key={item.id}
                          style={[
                            styles.itemWrapper,
                            index < cat.items.length - 1 && styles.itemWrapperBorder,
                          ]}
                        >
                          <View style={styles.itemRow}>
                            {item.item_type === 'measurement' ? (
                              /* Measurement Input */
                              <MeasurementInput
                                label={item.name}
                                description={item.description}
                                value={item.value}
                                onChange={(value) => handleMeasurementChange(item, value)}
                                disabled={updatingItemId === item.id}
                              />
                            ) : (
                              /* Status Options */
                              <>
                                <View style={styles.itemNameContainer}>
                                  <Text style={styles.itemName}>{item.name}</Text>
                                  {item.description && (
                                    <Text style={styles.itemDescription}>{item.description}</Text>
                                  )}
                                </View>
                                <View style={styles.statusOptions}>
                                  {STATUS_OPTIONS.map((option) => {
                                    const isSelected = item.status === option.value;
                                    const isUpdating = updatingItemId === item.id;
                                    return (
                                      <TouchableOpacity
                                        key={option.value}
                                        style={[
                                          styles.statusButton,
                                          isSelected && {
                                            backgroundColor: option.bgColor,
                                            borderColor: option.color,
                                          },
                                        ]}
                                        onPress={() => handleStatusChange(item, option.value)}
                                        disabled={isUpdating}
                                      >
                                        {isUpdating && isSelected ? (
                                          <ActivityIndicator size="small" color={option.color} />
                                        ) : (
                                          <Text
                                            style={[
                                              styles.statusButtonText,
                                              isSelected && { color: option.color },
                                            ]}
                                          >
                                            {option.label}
                                          </Text>
                                        )}
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </>
                            )}
                          </View>

                          {/* Photo Section */}
                          <View style={styles.photoSection}>
                            {/* Photo Buttons */}
                            <View style={styles.photoButtons}>
                              <TouchableOpacity
                                style={styles.photoButton}
                                onPress={() => handleTakePhoto(item.id)}
                                disabled={uploadingPhotoItemId === item.id}
                              >
                                {uploadingPhotoItemId === item.id ? (
                                  <ActivityIndicator size="small" color={COLORS.primary} />
                                ) : (
                                  <>
                                    <Ionicons name="camera-outline" size={16} color={COLORS.primary} />
                                    <Text style={styles.photoButtonText}>Camera</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.photoButton}
                                onPress={() => handleAddPhoto(item.id)}
                                disabled={uploadingPhotoItemId === item.id}
                              >
                                <Ionicons name="image-outline" size={16} color={COLORS.primary} />
                                <Text style={styles.photoButtonText}>Gallery</Text>
                              </TouchableOpacity>
                            </View>

                            {/* Photo Thumbnails */}
                            {item.photos && item.photos.length > 0 && (
                              <View style={styles.photoThumbnails}>
                                {item.photos.map((photo) => (
                                  <View key={photo.id} style={styles.photoThumbnailContainer}>
                                    <Image
                                      source={{ uri: photo.photo_url }}
                                      style={styles.photoThumbnail}
                                    />
                                    <TouchableOpacity
                                      style={styles.photoDeleteButton}
                                      onPress={() => handleDeletePhoto(photo.id)}
                                    >
                                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                                    </TouchableOpacity>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Notes/Comments Section */}
        {categories.length > 0 && (
          <View style={styles.notesContainer}>
            <View style={styles.notesHeader}>
              <Ionicons name="chatbubble-outline" size={20} color={COLORS.textPrimary} />
              <Text style={styles.notesTitle}>Inspector Notes</Text>
            </View>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add notes or comments about this inspection..."
              placeholderTextColor={COLORS.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.saveNotesButton, isSavingNotes && styles.saveNotesButtonDisabled]}
              onPress={handleSaveNotes}
              disabled={isSavingNotes}
            >
              {isSavingNotes ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color={COLORS.primary} />
                  <Text style={styles.saveNotesButtonText}>Save Notes</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Save Button */}
        {categories.length > 0 && (
          <View style={styles.saveContainer}>
            <Button
              title="Save Inspection"
              onPress={() => handleSaveInspection('completed')}
              loading={isSaving}
              fullWidth
              icon={
                <Ionicons
                  name="save-outline"
                  size={20}
                  color={COLORS.white}
                />
              }
            />

            {/* Download PDF Button */}
            <Button
              title="Download PDF Report"
              onPress={handleDownloadPdf}
              loading={isGeneratingPdf}
              variant="outline"
              fullWidth
              style={styles.syncButton}
              icon={
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={COLORS.primary}
                />
              }
            />

            {/* Sync to HCP Button - only shows when 100% complete */}
            {inspection.hcp_job_id && isHcpConnected && getCompletionPercentage() === 100 && (
              <Button
                title={inspection.hcp_synced_at ? 'Synced to Housecall Pro' : 'Sync to Housecall Pro'}
                onPress={handleSyncToHcp}
                loading={isSyncingToHcp}
                variant={inspection.hcp_synced_at ? 'outline' : 'secondary'}
                fullWidth
                style={styles.syncButton}
                icon={
                  <Ionicons
                    name={inspection.hcp_synced_at ? 'checkmark-circle' : 'sync-outline'}
                    size={20}
                    color={inspection.hcp_synced_at ? COLORS.primary : COLORS.white}
                  />
                }
              />
            )}

            {/* HCP Badge */}
            {inspection.hcp_job_id && (
              <View style={styles.hcpBadge}>
                <Ionicons name="link" size={14} color={COLORS.textSecondary} />
                <Text style={styles.hcpBadgeText}>
                  HCP Job #{inspection.hcp_job_number}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: SPACING.xl }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  errorText: {
    fontSize: FONT_SIZE.lg,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  backButton: {
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
  header: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  headerInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  headerText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  status_draft: {
    backgroundColor: '#f3f4f6',
  },
  status_scheduled: {
    backgroundColor: '#dbeafe',
  },
  status_in_progress: {
    backgroundColor: '#fef3c7',
  },
  status_completed: {
    backgroundColor: '#dcfce7',
  },
  status_cancelled: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'capitalize',
    color: COLORS.textPrimary,
  },
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  templateSelectorContainer: {
    flex: 1,
    minHeight: 400,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  categoriesContainer: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  changeChecklistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  changeChecklistBannerText: {
    flex: 1,
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  categoryCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  categoryTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  progressBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  progressText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.white,
    fontWeight: FONT_WEIGHT.medium,
  },
  itemsContainer: {
    padding: SPACING.xs,
  },
  itemWrapper: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
  },
  itemWrapperBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemNameContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  itemName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
  },
  itemDescription: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 4,
  },
  statusButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
    minWidth: 50,
    alignItems: 'center',
  },
  statusButtonText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textSecondary,
  },
  photoSection: {
    marginTop: SPACING.sm,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
  },
  photoButtonText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  photoThumbnails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  photoThumbnailContainer: {
    position: 'relative',
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.gray200,
  },
  photoDeleteButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.white,
    borderRadius: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  deleteButton: {
    padding: SPACING.sm,
    backgroundColor: '#fee2e2',
    borderRadius: RADIUS.md,
  },
  saveContainer: {
    padding: SPACING.md,
    paddingTop: SPACING.lg,
  },
  syncButton: {
    marginTop: SPACING.sm,
  },
  hcpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  hcpBadgeText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  notesContainer: {
    margin: SPACING.md,
    marginTop: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  notesTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  notesInput: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    minHeight: 100,
  },
  saveNotesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    alignSelf: 'flex-end',
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
  },
  saveNotesButtonDisabled: {
    opacity: 0.6,
  },
  saveNotesButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
});
