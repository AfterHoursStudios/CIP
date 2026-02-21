import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../lib/constants';
import * as templateService from '../services/checklist-template.service';
import type { ChecklistTemplate } from '../services/checklist-template.service';
import { Button } from './ui';

interface TemplateSelectorProps {
  companyId: string;
  onSelect: (template: ChecklistTemplate) => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export default function TemplateSelector({
  companyId,
  onSelect,
  onCancel,
  isLoading = false,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  useEffect(() => {
    loadTemplates();
  }, [companyId]);

  async function loadTemplates() {
    setIsLoadingTemplates(true);
    const { data, error } = await templateService.getAvailableTemplates(companyId);

    if (!error && data) {
      setTemplates(data);
      // Auto-select if only one template
      if (data.length === 1) {
        setSelectedTemplate(data[0]);
      }
    }
    setIsLoadingTemplates(false);
  }

  function handleConfirm() {
    if (selectedTemplate) {
      onSelect(selectedTemplate);
    }
  }

  function getTotalItems(template: ChecklistTemplate): number {
    return template.categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }

  if (isLoadingTemplates) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading templates...</Text>
      </View>
    );
  }

  if (templates.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="document-text-outline" size={48} color={COLORS.gray400} />
        <Text style={styles.emptyTitle}>No Templates Available</Text>
        <Text style={styles.emptyText}>
          Contact your admin to enable inspection templates for your company.
        </Text>
        {onCancel && (
          <Button
            title="Go Back"
            variant="outline"
            onPress={onCancel}
            style={styles.cancelButton}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="clipboard-outline" size={24} color={COLORS.primary} />
        <Text style={styles.headerTitle}>Choose Checklist</Text>
      </View>
      <Text style={styles.headerSubtitle}>
        Select which checklist to use for this job
      </Text>

      <ScrollView style={styles.templateList} showsVerticalScrollIndicator={false}>
        {templates.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          const totalItems = getTotalItems(template);

          return (
            <TouchableOpacity
              key={template.id}
              style={[styles.templateCard, isSelected && styles.templateCardSelected]}
              onPress={() => setSelectedTemplate(template)}
              activeOpacity={0.7}
            >
              <View style={styles.templateHeader}>
                <View style={styles.templateInfo}>
                  <Text style={[styles.templateName, isSelected && styles.templateNameSelected]}>
                    {template.name}
                  </Text>
                  {template.description && (
                    <Text style={styles.templateDescription} numberOfLines={2}>
                      {template.description}
                    </Text>
                  )}
                </View>
                <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
                  {isSelected && <View style={styles.radioInner} />}
                </View>
              </View>

              <View style={styles.templateMeta}>
                <View style={styles.metaItem}>
                  <Ionicons name="layers-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>
                    {template.categories.length} categories
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="checkbox-outline" size={14} color={COLORS.textSecondary} />
                  <Text style={styles.metaText}>{totalItems} items</Text>
                </View>
                {template.industry && (
                  <View style={styles.metaItem}>
                    <Ionicons name="business-outline" size={14} color={COLORS.textSecondary} />
                    <Text style={styles.metaText}>{template.industry}</Text>
                  </View>
                )}
              </View>

              {/* Show categories preview */}
              <View style={styles.categoriesPreview}>
                {template.categories.slice(0, 3).map((cat, index) => (
                  <View key={index} style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>{cat.name}</Text>
                  </View>
                ))}
                {template.categories.length > 3 && (
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>
                      +{template.categories.length - 3} more
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        {onCancel && (
          <Button
            title="Cancel"
            variant="outline"
            onPress={onCancel}
            style={styles.footerButton}
          />
        )}
        <Button
          title="Use This Checklist"
          onPress={handleConfirm}
          disabled={!selectedTemplate}
          loading={isLoading}
          style={[styles.footerButton, styles.confirmButton]}
          icon={<Ionicons name="checkmark-circle" size={18} color={COLORS.white} />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
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
    maxWidth: 280,
  },
  cancelButton: {
    marginTop: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  headerTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
  },
  templateList: {
    flex: 1,
  },
  templateCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 2,
    borderColor: COLORS.gray200,
  },
  templateCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#f0f9ff',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  templateInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  templateName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  templateNameSelected: {
    color: COLORS.primary,
  },
  templateDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  templateMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  categoriesPreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  categoryTag: {
    backgroundColor: COLORS.gray100,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  categoryTagText: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
  },
  footerButton: {
    flex: 1,
  },
  confirmButton: {
    flex: 2,
  },
});
