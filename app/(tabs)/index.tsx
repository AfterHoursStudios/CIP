import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useCompany } from '../../src/contexts';
import * as inspectionService from '../../src/services/inspection.service';
import { Card, Button, Input } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import { isSubscriptionActive } from '../../src/services/subscription.service';
import type { Inspection } from '../../src/types';

export default function InspectionsScreen() {
  const { user } = useAuth();
  const { currentCompany, companies, createCompany, isLoading: companyLoading, subscription } = useCompany();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  const hasActiveSubscription = isSubscriptionActive(subscription?.status || null);

  useFocusEffect(
    useCallback(() => {
      if (currentCompany) {
        loadInspections();
      } else {
        // Reset loading state if no company
        setIsLoading(false);
      }
    }, [currentCompany])
  );

  async function loadInspections() {
    if (!currentCompany) return;

    setIsLoading(true);
    const { data } = await inspectionService.getCompanyInspections(currentCompany.id, {
      limit: 50,
    });
    setInspections(data || []);
    setIsLoading(false);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadInspections();
    setIsRefreshing(false);
  }

  function handleCreateInspection() {
    if (!hasActiveSubscription) {
      showSubscriptionAlert();
      return;
    }
    router.push('/inspection/create');
  }

  function handleInspectionPress(inspection: Inspection) {
    if (!hasActiveSubscription) {
      showSubscriptionAlert();
      return;
    }
    router.push(`/inspection/${inspection.id}`);
  }

  function showSubscriptionAlert() {
    if (Platform.OS === 'web') {
      alert('Subscription required to access inspections. Please subscribe to a plan.');
    } else {
      Alert.alert(
        'Subscription Required',
        'You need an active subscription to access inspections.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Subscribe', onPress: () => router.push('/settings/subscription') },
        ]
      );
    }
  }

  function getStatusColor(percentage: number): string {
    if (percentage === 100) return '#22c55e';
    if (percentage > 0) return COLORS.warning;
    return COLORS.gray500;
  }

  function getStatusDisplayText(percentage: number): string {
    if (percentage === 100) return 'Finished';
    if (percentage > 0) return `${percentage}%`;
    return 'Not Started';
  }

  function getStatusBgColor(percentage: number): string {
    if (percentage === 100) return '#E8F5E9';
    if (percentage > 0) return '#FFF3E0';
    return COLORS.gray100;
  }

  async function handleCreateCompany() {
    if (!companyName.trim()) {
      alert('Please enter a company name');
      return;
    }

    setIsCreatingCompany(true);
    const { error } = await createCompany(companyName.trim());
    setIsCreatingCompany(false);

    if (error) {
      alert(error);
    } else {
      setCompanyName('');
      setShowCreateCompany(false);
      alert('Company created successfully');
    }
  }

  // No company state
  if (!companyLoading && companies.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.noCompanyContainer}>
          <Ionicons name="business-outline" size={64} color={COLORS.gray400} />
          <Text style={styles.noCompanyTitle}>No Company</Text>

          {!showCreateCompany ? (
            <View style={styles.noCompanyActions}>
              <Card style={styles.noCompanyCard}>
                <Ionicons name="mail-outline" size={32} color={COLORS.primary} />
                <Text style={styles.noCompanyCardTitle}>Join a Company</Text>
                <Text style={styles.noCompanyCardText}>
                  Ask your company owner to send you an invitation to the email address you signed up with
                </Text>
              </Card>

              <Text style={styles.orText}>OR</Text>

              <Button
                title="Create a Company"
                onPress={() => setShowCreateCompany(true)}
                fullWidth
                icon={<Ionicons name="add-circle-outline" size={20} color={COLORS.white} />}
              />
            </View>
          ) : (
            <View style={styles.createCompanyForm}>
              <Input
                label="Company Name"
                value={companyName}
                onChangeText={setCompanyName}
                placeholder="Enter company name"
              />
              <View style={styles.createCompanyButtons}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowCreateCompany(false);
                    setCompanyName('');
                  }}
                  variant="outline"
                />
                <Button
                  title="Create Company"
                  onPress={handleCreateCompany}
                  loading={isCreatingCompany}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Loading state
  if (isLoading || companyLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Empty state
  if (inspections.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="clipboard-outline" size={64} color={COLORS.gray400} />
        <Text style={styles.emptyTitle}>No Inspections Yet</Text>
        <Text style={styles.emptyText}>
          {hasActiveSubscription
            ? 'Create your first inspection to get started.'
            : 'Subscribe to a plan to create inspections.'}
        </Text>
        {hasActiveSubscription ? (
          <Button
            title="Create Inspection"
            onPress={handleCreateInspection}
            icon={<Ionicons name="add" size={20} color={COLORS.white} />}
            style={styles.createButton}
          />
        ) : (
          <Button
            title="Subscribe Now"
            onPress={() => router.push('/settings/subscription')}
            icon={<Ionicons name="card-outline" size={20} color={COLORS.white} />}
            style={styles.createButton}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={inspections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Jobs Count Header */}
            <View style={styles.jobsCountHeader}>
              <Text style={styles.jobsCountText}>
                {inspections.length} Job{inspections.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Subscription Banner */}
            {!hasActiveSubscription && inspections.length > 0 && (
              <View style={styles.subscriptionBanner}>
                <Ionicons name="lock-closed" size={20} color={COLORS.warning} />
                <View style={styles.subscriptionBannerText}>
                  <Text style={styles.subscriptionBannerTitle}>Subscription Required</Text>
                  <Text style={styles.subscriptionBannerSubtitle}>
                    Subscribe to access your inspections
                  </Text>
                </View>
                <Button
                  title="Subscribe"
                  onPress={() => router.push('/settings/subscription')}
                  size="sm"
                />
              </View>
            )}
          </>
        }
        renderItem={({ item }) => {
          const percentage = item.completion_percentage ?? 0;
          return (
            <TouchableOpacity
              onPress={() => handleInspectionPress(item)}
              activeOpacity={hasActiveSubscription ? 0.7 : 1}
            >
              <Card style={[
                styles.inspectionCard,
                !hasActiveSubscription && styles.inspectionCardDisabled,
              ]}>
                {!hasActiveSubscription && (
                  <View style={styles.lockedOverlay}>
                    <Ionicons name="lock-closed" size={20} color={COLORS.gray400} />
                  </View>
                )}
                <View style={styles.cardHeader}>
                  <Text style={[
                    styles.projectName,
                    !hasActiveSubscription && styles.textDisabled,
                  ]} numberOfLines={1}>
                    {item.project_name}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: hasActiveSubscription ? getStatusBgColor(percentage) : COLORS.gray200 }
                  ]}>
                    <Text style={[
                      styles.statusText,
                      { color: hasActiveSubscription ? getStatusColor(percentage) : COLORS.gray500 }
                    ]}>
                      {getStatusDisplayText(percentage)}
                    </Text>
                  </View>
                </View>

                {item.project_address && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={hasActiveSubscription ? COLORS.gray500 : COLORS.gray400} />
                    <Text style={[
                      styles.detailText,
                      !hasActiveSubscription && styles.textDisabled,
                    ]} numberOfLines={1}>
                      {item.project_address}
                    </Text>
                  </View>
                )}

                {item.client_name && (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color={hasActiveSubscription ? COLORS.gray500 : COLORS.gray400} />
                    <Text style={[
                      styles.detailText,
                      !hasActiveSubscription && styles.textDisabled,
                    ]}>{item.client_name}</Text>
                  </View>
                )}

                {item.scheduled_date && (
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={hasActiveSubscription ? COLORS.gray500 : COLORS.gray400} />
                    <Text style={[
                      styles.detailText,
                      !hasActiveSubscription && styles.textDisabled,
                    ]}>
                      {new Date(item.scheduled_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.fab, !hasActiveSubscription && styles.fabDisabled]}
        onPress={handleCreateInspection}
      >
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>
    </View>
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
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  createButton: {
    minWidth: 200,
  },
  listContent: {
    padding: SPACING.md,
  },
  jobsCountHeader: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  jobsCountText: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.white,
    textAlign: 'center',
  },
  inspectionCard: {
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  projectName: {
    flex: 1,
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'uppercase',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  detailText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)' }
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        }),
  } as any,
  noCompanyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  noCompanyTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  noCompanyActions: {
    width: '100%',
    gap: SPACING.lg,
  },
  noCompanyCard: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  noCompanyCardTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  noCompanyCardText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  orText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: FONT_WEIGHT.medium,
  },
  createCompanyForm: {
    width: '100%',
    gap: SPACING.md,
  },
  createCompanyButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  // Subscription styles
  subscriptionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  subscriptionBannerText: {
    flex: 1,
  },
  subscriptionBannerTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.warning,
  },
  subscriptionBannerSubtitle: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  inspectionCardDisabled: {
    opacity: 0.7,
    position: 'relative',
  },
  lockedOverlay: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    zIndex: 1,
  },
  textDisabled: {
    color: COLORS.gray500,
  },
  fabDisabled: {
    backgroundColor: COLORS.gray400,
  },
});
