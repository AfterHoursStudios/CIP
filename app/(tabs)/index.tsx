import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useCompany } from '../../src/contexts';
import * as inspectionService from '../../src/services/inspection.service';
import { Card, Button } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../src/lib/constants';
import type { Inspection } from '../../src/types';

export default function InspectionsScreen() {
  const { user } = useAuth();
  const { currentCompany, companies, isLoading: companyLoading } = useCompany();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (currentCompany) {
        loadInspections();
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
    router.push('/inspection/create');
  }

  function handleInspectionPress(inspection: Inspection) {
    router.push(`/inspection/${inspection.id}`);
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

  // No company state
  if (!companyLoading && companies.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="business-outline" size={64} color={COLORS.gray400} />
        <Text style={styles.emptyTitle}>No Company Found</Text>
        <Text style={styles.emptyText}>
          Create a company to start managing inspections.
        </Text>
        <Button
          title="Create Company"
          onPress={() => router.push('/profile')}
          style={styles.createButton}
        />
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
          Create your first inspection to get started.
        </Text>
        <Button
          title="Create Inspection"
          onPress={handleCreateInspection}
          icon={<Ionicons name="add" size={20} color={COLORS.white} />}
          style={styles.createButton}
        />
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
        renderItem={({ item }) => {
          const percentage = item.completion_percentage ?? 0;
          return (
            <TouchableOpacity onPress={() => handleInspectionPress(item)}>
              <Card style={styles.inspectionCard}>
                <View style={styles.cardHeader}>
                  <Text style={styles.projectName} numberOfLines={1}>
                    {item.project_name}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(percentage) }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(percentage) }]}>
                      {getStatusDisplayText(percentage)}
                    </Text>
                  </View>
                </View>

                {item.project_address && (
                  <View style={styles.detailRow}>
                    <Ionicons name="location-outline" size={16} color={COLORS.gray500} />
                    <Text style={styles.detailText} numberOfLines={1}>
                      {item.project_address}
                    </Text>
                  </View>
                )}

                {item.client_name && (
                  <View style={styles.detailRow}>
                    <Ionicons name="person-outline" size={16} color={COLORS.gray500} />
                    <Text style={styles.detailText}>{item.client_name}</Text>
                  </View>
                )}

                {item.scheduled_date && (
                  <View style={styles.detailRow}>
                    <Ionicons name="calendar-outline" size={16} color={COLORS.gray500} />
                    <Text style={styles.detailText}>
                      {new Date(item.scheduled_date).toLocaleDateString()}
                    </Text>
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={handleCreateInspection}>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
