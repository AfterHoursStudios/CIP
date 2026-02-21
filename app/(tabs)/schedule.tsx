import { useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth, useCompany } from '../../src/contexts';
import { Card } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as hcpService from '../../src/services/housecallpro.service';
import * as inspectionService from '../../src/services/inspection.service';
import type { Inspection } from '../../src/types';

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHcpConnected, setIsHcpConnected] = useState(false);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [syncStatus, setSyncStatus] = useState<string>('');

  // Generate array of dates for the date picker (7 days centered on selected)
  const dateOptions = useMemo(() => {
    const dates: Date[] = [];
    const today = new Date();
    // Show 3 days before and 10 days after today
    for (let i = -3; i <= 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, []);

  // Filter inspections for selected date
  const filteredInspections = useMemo(() => {
    const selectedDateStr = selectedDate.toISOString().split('T')[0];
    return allInspections.filter((inspection) => {
      if (!inspection.scheduled_date) return false;
      const inspectionDateStr = new Date(inspection.scheduled_date).toISOString().split('T')[0];
      return inspectionDateStr === selectedDateStr;
    }).sort((a, b) => {
      if (!a.scheduled_date || !b.scheduled_date) return 0;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });
  }, [allInspections, selectedDate]);

  const loadData = useCallback(async (showSyncStatus = false) => {
    if (!currentCompany || !user) return;

    // Check HCP connection
    const connected = await hcpService.isConnected(currentCompany.id);
    setIsHcpConnected(connected);

    // If connected, sync jobs from HCP
    if (connected && showSyncStatus) {
      setIsSyncing(true);
      setSyncStatus('Fetching jobs from Housecall Pro...');
      await syncHcpJobs();
      setIsSyncing(false);
      setSyncStatus('');
    }

    // Load inspections from database
    await loadInspections();
  }, [currentCompany, user]);

  async function syncHcpJobs() {
    if (!currentCompany || !user) return;

    const { data: jobsData, error } = await hcpService.getScheduledJobs(currentCompany.id);

    // Log full response for debugging
    console.log('HCP Full Response:', JSON.stringify(jobsData, null, 2));

    if (error) {
      console.error('Failed to fetch HCP jobs:', error);
      return;
    }

    if (!jobsData) {
      console.log('No jobsData returned');
      return;
    }

    // Try to find jobs array - might be at different paths
    const jobs = jobsData.jobs || jobsData.data || jobsData;
    console.log('Jobs array:', jobs);

    if (!Array.isArray(jobs) || jobs.length === 0) {
      console.log('No jobs found or jobs is not an array');
      return;
    }

    let importedCount = 0;

    for (const job of jobs) {
      // Log job data for debugging
      console.log('HCP Job data:', JSON.stringify(job, null, 2));

      // Get job number - HCP uses invoice_number
      const jobNumber = job.invoice_number || job.job_number || job.id;

      // Build address string
      const addressParts = [
        job.address?.street,
        job.address?.city,
        job.address?.state,
        job.address?.zip,
      ].filter(Boolean);
      const fullAddress = addressParts.join(', ');

      // Build client name
      const clientName = [
        job.customer?.first_name,
        job.customer?.last_name,
      ].filter(Boolean).join(' ') || job.customer?.company || '';

      // Build assigned employee name
      const assignedEmployee = job.assigned_employees && job.assigned_employees.length > 0
        ? job.assigned_employees.map(emp =>
            `${emp.first_name || ''} ${emp.last_name || ''}`.trim()
          ).join(', ')
        : null;

      // Check if already imported
      const { data: existing } = await inspectionService.getInspectionByHcpJobId(job.id);

      if (existing) {
        // Update existing inspection with latest data
        setSyncStatus(`Updating job #${jobNumber}...`);
        await inspectionService.updateInspection(existing.id, {
          project_name: job.description || job.name || `Job #${jobNumber}`,
          project_address: fullAddress || null,
          client_name: clientName || null,
          client_email: job.customer?.email || null,
          scheduled_date: job.schedule?.scheduled_start || null,
          hcp_job_number: jobNumber,
          hcp_assigned_employee: assignedEmployee,
        });
        continue;
      }

      setSyncStatus(`Importing job #${jobNumber}...`);

      // Create inspection - use description as project name
      const { data: inspection, error: createError } = await inspectionService.createInspection(
        currentCompany.id,
        user.id,
        {
          project_name: job.description || job.name || `Job #${jobNumber}`,
          project_address: fullAddress || undefined,
          client_name: clientName || undefined,
          client_email: job.customer?.email || undefined,
          scheduled_date: job.schedule?.scheduled_start || undefined,
          hcp_job_id: job.id,
          hcp_job_number: jobNumber,
          hcp_assigned_employee: assignedEmployee || undefined,
        }
      );

      if (createError || !inspection) {
        console.error('Failed to create inspection:', createError);
        continue;
      }

      // No checklist items added here - inspector will choose template when they open the job
      importedCount++;
    }

    if (importedCount > 0) {
      showAlert('Sync Complete', `Imported ${importedCount} new job${importedCount > 1 ? 's' : ''} from Housecall Pro`);
    }
  }

  async function loadInspections() {
    if (!currentCompany) return;

    const { data: inspections, error } = await inspectionService.getCompanyInspections(
      currentCompany.id,
      { limit: 100 }
    );

    if (error || !inspections) {
      console.error('Failed to load inspections:', error);
      setIsLoading(false);
      return;
    }

    setAllInspections(inspections);
    setIsLoading(false);
  }

  function isToday(date: Date): boolean {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isSameDay(date1: Date, date2: Date): boolean {
    return date1.toDateString() === date2.toDateString();
  }

  function formatDayName(date: Date): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tmrw';
    }

    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  function formatDayNumber(date: Date): string {
    return date.getDate().toString();
  }

  function formatSelectedDateHeader(): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (selectedDate.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (selectedDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    return selectedDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  // Count inspections for a given date
  function getInspectionCount(date: Date): number {
    const dateStr = date.toISOString().split('T')[0];
    return allInspections.filter((inspection) => {
      if (!inspection.scheduled_date) return false;
      const inspectionDateStr = new Date(inspection.scheduled_date).toISOString().split('T')[0];
      return inspectionDateStr === dateStr;
    }).length;
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  function getStatusColor(percentage: number): string {
    if (percentage === 100) return '#22c55e';
    if (percentage > 0) return COLORS.warning;
    return COLORS.gray500;
  }

  function getStatusDisplayText(percentage: number): string {
    if (percentage === 100) return 'Finished';
    if (percentage > 0) return `${percentage}% Complete`;
    return 'Not Started';
  }

  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData(true);
    }, [loadData])
  );

  async function handleRefresh() {
    setIsRefreshing(true);
    await loadData(true);
    setIsRefreshing(false);
  }

  async function handleManualSync() {
    setIsSyncing(true);
    setSyncStatus('Syncing with Housecall Pro...');
    await syncHcpJobs();
    await loadInspections();
    setIsSyncing(false);
    setSyncStatus('');
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        {isSyncing && syncStatus && (
          <Text style={styles.syncText}>{syncStatus}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Date Picker */}
      <View style={styles.datePickerContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.datePickerContent}
        >
          {dateOptions.map((date, index) => {
            const isSelected = isSameDay(date, selectedDate);
            const count = getInspectionCount(date);

            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.dateItem,
                  isSelected && styles.dateItemSelected,
                  isToday(date) && !isSelected && styles.dateItemToday,
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text
                  style={[
                    styles.dateDayName,
                    isSelected && styles.dateDayNameSelected,
                  ]}
                >
                  {formatDayName(date)}
                </Text>
                <Text
                  style={[
                    styles.dateDayNumber,
                    isSelected && styles.dateDayNumberSelected,
                  ]}
                >
                  {formatDayNumber(date)}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.dateCountBadge,
                      isSelected && styles.dateCountBadgeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateCountText,
                        isSelected && styles.dateCountTextSelected,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.mainContent}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* HCP Sync Status */}
        {isHcpConnected && (
          <TouchableOpacity
            style={styles.syncBanner}
            onPress={handleManualSync}
            disabled={isSyncing}
          >
            <View style={styles.syncBannerContent}>
              <Ionicons name="sync" size={18} color={COLORS.white} />
              <Text style={styles.syncBannerText}>
                {isSyncing ? syncStatus || 'Syncing...' : 'Connected to Housecall Pro'}
              </Text>
            </View>
            {!isSyncing && (
              <Text style={styles.syncBannerAction}>Tap to sync</Text>
            )}
            {isSyncing && (
              <ActivityIndicator size="small" color={COLORS.white} />
            )}
          </TouchableOpacity>
        )}

        {!isHcpConnected && (
          <TouchableOpacity
            style={styles.connectBanner}
            onPress={() => router.push('/settings/integrations')}
          >
            <Ionicons name="link-outline" size={18} color={COLORS.primary} />
            <Text style={styles.connectBannerText}>
              Connect Housecall Pro to auto-import jobs
            </Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Selected Date Header */}
        <Text style={styles.selectedDateHeader}>{formatSelectedDateHeader()}</Text>

        {/* Inspections List */}
        {filteredInspections.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.gray400} />
            <Text style={styles.emptyTitle}>No Inspections</Text>
            <Text style={styles.emptySubtitle}>
              No inspections scheduled for this day
            </Text>
          </View>
        ) : (
          filteredInspections.map((inspection) => (
            <TouchableOpacity
              key={inspection.id}
              onPress={() => router.push(`/inspection/${inspection.id}`)}
            >
              <Card style={styles.inspectionCard}>
                <View style={styles.inspectionHeader}>
                  <View style={styles.inspectionInfo}>
                    {inspection.scheduled_date && (
                      <Text style={styles.inspectionTime}>
                        {formatTime(inspection.scheduled_date)}
                      </Text>
                    )}
                    <Text style={styles.inspectionName}>
                      {inspection.project_name}
                    </Text>
                    {inspection.client_name && (
                      <Text style={styles.inspectionClient}>
                        {inspection.client_name}
                      </Text>
                    )}
                    {inspection.project_address && (
                      <View style={styles.addressRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.inspectionAddress} numberOfLines={1}>
                          {inspection.project_address}
                        </Text>
                      </View>
                    )}
                    {inspection.hcp_assigned_employee && (
                      <View style={styles.employeeRow}>
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={COLORS.textSecondary}
                        />
                        <Text style={styles.employeeName}>
                          {inspection.hcp_assigned_employee}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.inspectionMeta}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(inspection.completion_percentage ?? 0) + '20' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: getStatusColor(inspection.completion_percentage ?? 0) },
                        ]}
                      >
                        {getStatusDisplayText(inspection.completion_percentage ?? 0)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  datePickerContainer: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  datePickerContent: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    minWidth: 56,
  },
  dateItemSelected: {
    backgroundColor: COLORS.primary,
  },
  dateItemToday: {
    backgroundColor: COLORS.gray100,
  },
  dateDayName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
    marginBottom: 2,
  },
  dateDayNameSelected: {
    color: COLORS.white,
  },
  dateDayNumber: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  dateDayNumberSelected: {
    color: COLORS.white,
  },
  dateCountBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  dateCountBadgeSelected: {
    backgroundColor: COLORS.white,
  },
  dateCountText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  dateCountTextSelected: {
    color: COLORS.primary,
  },
  mainContent: {
    flex: 1,
  },
  content: {
    padding: SPACING.md,
  },
  selectedDateHeader: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    gap: SPACING.md,
  },
  syncText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#22c55e',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  syncBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  syncBannerText: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  syncBannerAction: {
    color: COLORS.white,
    fontSize: FONT_SIZE.sm,
    opacity: 0.8,
  },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  connectBannerText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
  },
  inspectionCard: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  inspectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inspectionInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  inspectionTime: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
    marginBottom: 2,
  },
  inspectionName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  inspectionClient: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  inspectionAddress: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  employeeName: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
  },
  inspectionMeta: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
  },
  statusText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    textTransform: 'capitalize',
  },
});
