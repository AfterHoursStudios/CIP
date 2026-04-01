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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useAuth, useCompany } from '../../src/contexts';
import { Card, Button, Input } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as hcpService from '../../src/services/housecallpro.service';
import * as jobberService from '../../src/services/jobber.service';
import * as inspectionService from '../../src/services/inspection.service';
import { isSubscriptionActive, PLAN_DETAILS } from '../../src/services/subscription.service';
import type { Inspection } from '../../src/types';

export default function ScheduleScreen() {
  const { user } = useAuth();
  const { currentCompany, companies, createCompany, subscription, createCheckoutSession } = useCompany();

  const hasActiveSubscription = isSubscriptionActive(subscription?.status || null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isHcpConnected, setIsHcpConnected] = useState(false);
  const [isJobberConnected, setIsJobberConnected] = useState(false);
  const [allInspections, setAllInspections] = useState<Inspection[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [lastSyncJobCount, setLastSyncJobCount] = useState<number>(0);
  const [lastJobberSyncTime, setLastJobberSyncTime] = useState<number>(0);
  const [jobberRateLimited, setJobberRateLimited] = useState(false);

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

  // Helper to get local date string (YYYY-MM-DD) without timezone shift
  function toLocalDateStr(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Filter inspections for selected date (exclude completed)
  const filteredInspections = useMemo(() => {
    const selectedDateStr = toLocalDateStr(selectedDate);
    const filtered = allInspections.filter((inspection) => {
      if (!inspection.scheduled_date) return false;
      if (inspection.completed_date) return false; // Exclude completed inspections
      const inspectionDateStr = toLocalDateStr(new Date(inspection.scheduled_date));
      return inspectionDateStr === selectedDateStr;
    }).sort((a, b) => {
      if (!a.scheduled_date || !b.scheduled_date) return 0;
      return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
    });

    // Debug log
    console.log(`Schedule: ${filtered.length} inspections for ${selectedDateStr} (from ${allInspections.length} total)`);
    if (filtered.length > 0) {
      console.log('Filtered inspections:', filtered.map(i => ({
        name: i.project_name,
        date: i.scheduled_date,
        hcpJobId: i.hcp_job_id,
      })));
    }

    return filtered;
  }, [allInspections, selectedDate]);

  const loadData = useCallback(async (showSyncStatus = false) => {
    if (!currentCompany || !user) {
      setIsLoading(false);
      return;
    }

    // Check both HCP and Jobber connections in parallel
    const [hcpConnected, jobberConnected] = await Promise.all([
      hcpService.isConnected(currentCompany.id),
      jobberService.isConnected(currentCompany.id),
    ]);
    setIsHcpConnected(hcpConnected);
    setIsJobberConnected(jobberConnected);

    // If connected, sync jobs from HCP and/or Jobber
    if (showSyncStatus && (hcpConnected || jobberConnected)) {
      setIsSyncing(true);

      if (hcpConnected) {
        setSyncStatus('Fetching jobs from Housecall Pro...');
        await syncHcpJobs();
      }

      if (jobberConnected) {
        setSyncStatus('Fetching jobs from Jobber...');
        await syncJobberJobs();
      }

      setIsSyncing(false);
      setSyncStatus('');
    }

    // Load inspections from database
    await loadInspections();
  }, [currentCompany, user]);

  async function syncHcpJobs() {
    if (!currentCompany || !user) return;

    // Use getAllScheduledJobs to fetch all pages with progress updates
    const { data: jobs, error } = await hcpService.getAllScheduledJobs(
      currentCompany.id,
      (fetched, total) => {
        setSyncStatus(`Fetching jobs from Housecall Pro... (${fetched}/${total})`);
      }
    );

    if (error) {
      console.error('HCP sync error:', error);
      return;
    }

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      console.log('HCP sync: No jobs returned from API');
      setLastSyncJobCount(0);
      return;
    }

    console.log(`HCP sync: Processing ${jobs.length} jobs from API`);
    setLastSyncJobCount(jobs.length);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCompleted = 0;
    let skippedNoDate = 0;

    for (const job of jobs) {
      // Get job number - HCP uses invoice_number
      const jobNumber = job.invoice_number || job.job_number || job.id;

      // Check if already imported - try by job ID first, then by job number (filtered by company)
      const { data: existing, error: lookupError } = await inspectionService.getInspectionByHcpJobId(job.id, jobNumber, currentCompany.id);

      if (lookupError) {
        console.error(`HCP sync: Lookup error for job ${job.id}:`, lookupError);
      }

      // Check job status
      const status = (job.work_status || '').toLowerCase();
      const isCompleted = status === 'complete' ||
                          status === 'canceled' ||
                          status === 'cancelled' ||
                          status.includes('complete');

      // If job is completed or canceled in HCP, mark local inspection as completed
      if (isCompleted) {
        skippedCompleted++;
        if (existing && !existing.completed_date) {
          setSyncStatus(`Marking job #${jobNumber} as completed...`);
          await inspectionService.updateInspection(existing.id, {
            completed_date: new Date().toISOString(),
          });
        }
        continue; // Don't create new inspections for completed/canceled jobs
      }

      // Log job schedule info
      const scheduleDate = job.schedule?.scheduled_start;
      if (!scheduleDate) {
        skippedNoDate++;
        console.log(`HCP sync: Job #${jobNumber} has no scheduled date`);
      } else {
        // Check if this is a March 23 job
        const jobDateStr = scheduleDate.substring(0, 10); // Get YYYY-MM-DD
        if (jobDateStr === '2026-03-23') {
          console.log(`HCP sync: *** MARCH 23 JOB *** #${jobNumber} - ${job.description || job.name} - status: ${job.work_status}`);
        }
        console.log(`HCP sync: Job #${jobNumber} scheduled for ${scheduleDate}`);
      }

      // Process all non-completed jobs (scheduled, unscheduled, in_progress, etc.)

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

      if (existing) {
        // Update existing inspection with latest data (including hcp_job_id in case it changed)
        setSyncStatus(`Updating job #${jobNumber}...`);
        const updateResult = await inspectionService.updateInspection(existing.id, {
          project_name: job.description || job.name || `Job #${jobNumber}`,
          project_address: fullAddress || null,
          client_name: clientName || null,
          client_email: job.customer?.email || null,
          scheduled_date: job.schedule?.scheduled_start || null,
          hcp_job_id: job.id, // Update job ID in case it changed
          hcp_job_number: jobNumber,
          hcp_assigned_employee: assignedEmployee,
          completed_date: null, // Clear completed_date if job is scheduled again
        });
        if (updateResult.error) {
          console.error(`HCP sync: Failed to update job #${jobNumber}:`, updateResult.error);
        } else {
          updatedCount++;
        }
        continue;
      }

      setSyncStatus(`Importing job #${jobNumber}...`);
      console.log(`HCP sync: Creating inspection for job #${jobNumber} (HCP ID: ${job.id}), scheduled: ${job.schedule?.scheduled_start || 'none'}`);

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
        console.error(`HCP sync: Failed to create inspection for job #${jobNumber}:`, createError);
        continue;
      }

      console.log(`HCP sync: Created inspection ${inspection.id} for job #${jobNumber}`);

      // No checklist items added here - inspector will choose template when they open the job
      importedCount++;
    }

    console.log(`HCP sync complete: ${importedCount} imported, ${updatedCount} updated, ${skippedCompleted} completed, ${skippedNoDate} no date`);
  }

  async function syncJobberJobs(isManualSync = false) {
    if (!currentCompany || !user) return;

    // Skip auto-sync if rate limited (wait 5 minutes)
    const fiveMinutes = 5 * 60 * 1000;
    const timeSinceLastSync = Date.now() - lastJobberSyncTime;

    if (!isManualSync && jobberRateLimited && timeSinceLastSync < fiveMinutes) {
      console.log('Jobber: Skipping auto-sync due to recent rate limiting');
      return;
    }

    // Use getAllScheduledJobs to fetch all pages with progress updates
    const { data: jobs, error } = await jobberService.getAllScheduledJobs(
      currentCompany.id,
      (fetched, total) => {
        setSyncStatus(`Fetching jobs from Jobber... (${fetched}/${total})`);
      }
    );

    if (error) {
      console.error('Jobber sync error:', error);
      // Track rate limiting
      if (error.toLowerCase().includes('throttle')) {
        setJobberRateLimited(true);
        setLastJobberSyncTime(Date.now());
      }
      return;
    }

    // Successful sync - reset rate limit flag
    setJobberRateLimited(false);
    setLastJobberSyncTime(Date.now());

    if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
      console.log('Jobber sync: No jobs returned from API');
      return;
    }

    console.log(`Jobber sync: Processing ${jobs.length} jobs from API`);

    let importedCount = 0;
    let updatedCount = 0;
    let skippedCompleted = 0;

    for (const job of jobs) {
      // Get job number
      const jobNumber = String(job.jobNumber);

      // Check if already imported
      const { data: existing, error: lookupError } = await inspectionService.getInspectionByJobberJobId(
        job.id,
        jobNumber,
        currentCompany.id
      );

      if (lookupError) {
        console.error(`Jobber sync: Lookup error for job ${job.id}:`, lookupError);
      }

      // Check job status
      const status = (job.jobStatus || '').toLowerCase();
      const isCompleted = status === 'completed' || status === 'archived' || status === 'cancelled';

      // If job is completed or cancelled in Jobber, mark local inspection as completed
      if (isCompleted) {
        skippedCompleted++;
        if (existing && !existing.completed_date) {
          setSyncStatus(`Marking job #${jobNumber} as completed...`);
          await inspectionService.updateInspection(existing.id, {
            completed_date: new Date().toISOString(),
          });
        }
        continue;
      }

      // Build address string
      const fullAddress = jobberService.formatJobberAddress(job.property?.address || null);

      // Build client name
      const clientName = jobberService.getJobberClientName(job.client);

      // Get client email
      const clientEmail = job.client?.emails?.[0]?.address || null;

      // Build assigned employee name
      const assignedEmployee = jobberService.getJobberAssignedEmployees(job);

      // Get visit date
      const visitDate = jobberService.getJobberVisitDate(job);

      if (existing) {
        // Update existing inspection with latest data
        setSyncStatus(`Updating job #${jobNumber}...`);
        const updateResult = await inspectionService.updateInspection(existing.id, {
          project_name: job.title || job.instructions || `Job #${jobNumber}`,
          project_address: fullAddress || null,
          client_name: clientName || null,
          client_email: clientEmail || null,
          scheduled_date: visitDate || null,
          jobber_job_id: job.id,
          jobber_job_number: jobNumber,
          jobber_assigned_employee: assignedEmployee,
          completed_date: null, // Clear completed_date if job is active again
        });
        if (updateResult.error) {
          console.error(`Jobber sync: Failed to update job #${jobNumber}:`, updateResult.error);
        } else {
          updatedCount++;
        }
        continue;
      }

      setSyncStatus(`Importing job #${jobNumber}...`);
      console.log(`Jobber sync: Creating inspection for job #${jobNumber} (Jobber ID: ${job.id}), scheduled: ${visitDate || 'none'}`);

      // Create inspection
      const { data: inspection, error: createError } = await inspectionService.createInspection(
        currentCompany.id,
        user.id,
        {
          project_name: job.title || job.instructions || `Job #${jobNumber}`,
          project_address: fullAddress || undefined,
          client_name: clientName || undefined,
          client_email: clientEmail || undefined,
          scheduled_date: visitDate || undefined,
          jobber_job_id: job.id,
          jobber_job_number: jobNumber,
          jobber_assigned_employee: assignedEmployee || undefined,
        }
      );

      if (createError || !inspection) {
        console.error(`Jobber sync: Failed to create inspection for job #${jobNumber}:`, createError);
        continue;
      }

      console.log(`Jobber sync: Created inspection ${inspection.id} for job #${jobNumber}`);
      importedCount++;
    }

    console.log(`Jobber sync complete: ${importedCount} imported, ${updatedCount} updated, ${skippedCompleted} completed`);
  }

  async function loadInspections() {
    if (!currentCompany) return;

    // Load more inspections to ensure we get all scheduled jobs
    const { data: inspections, error } = await inspectionService.getCompanyInspections(
      currentCompany.id,
      { limit: 500 }
    );

    if (error || !inspections) {
      console.error('Failed to load inspections:', error);
      setIsLoading(false);
      return;
    }

    // Filter out completed inspections for schedule view
    const activeInspections = inspections.filter(i => !i.completed_date);
    console.log(`Loaded ${inspections.length} inspections, ${activeInspections.length} active`);

    // Debug: show all scheduled dates
    const scheduledDates: { [key: string]: number } = {};
    activeInspections.forEach(i => {
      if (i.scheduled_date) {
        const dateStr = toLocalDateStr(new Date(i.scheduled_date));
        scheduledDates[dateStr] = (scheduledDates[dateStr] || 0) + 1;
      }
    });
    console.log('Inspections by date:', scheduledDates);

    // Debug: show HCP jobs specifically
    const hcpJobs = activeInspections.filter(i => i.hcp_job_id);
    console.log(`HCP jobs in database: ${hcpJobs.length}`);

    // Debug: Show details for jobs on 3/23
    const march23Jobs = activeInspections.filter(i => {
      if (!i.scheduled_date) return false;
      const dateStr = toLocalDateStr(new Date(i.scheduled_date));
      return dateStr === '2026-03-23';
    });
    console.log(`Jobs for 2026-03-23: ${march23Jobs.length}`);
    march23Jobs.forEach(j => {
      console.log(`  - ${j.project_name} | HCP: ${j.hcp_job_id || 'N/A'} | Raw date: ${j.scheduled_date}`);
    });

    setAllInspections(activeInspections);
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

  // Count inspections for a given date (exclude completed)
  function getInspectionCount(date: Date): number {
    const dateStr = toLocalDateStr(date);
    return allInspections.filter((inspection) => {
      if (!inspection.scheduled_date) return false;
      if (inspection.completed_date) return false; // Exclude completed inspections
      const inspectionDateStr = toLocalDateStr(new Date(inspection.scheduled_date));
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

  async function handleSubscribe(plan: 'basic' | 'plus' | 'pro') {
    setIsSubscribing(true);
    const { url, error } = await createCheckoutSession(plan);
    setIsSubscribing(false);

    if (error) {
      showAlert('Error', error);
      return;
    }

    if (url) {
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        Linking.openURL(url);
      }
    }
  }

  function handleJobPress(inspectionId: string) {
    if (!hasActiveSubscription) {
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
      return;
    }
    router.push(`/inspection/${inspectionId}`);
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

    if (isHcpConnected) {
      setSyncStatus('Syncing with Housecall Pro...');
      await syncHcpJobs();
    }

    if (isJobberConnected) {
      setSyncStatus('Syncing with Jobber...');
      await syncJobberJobs(true); // Manual sync - bypass cooldown
    }

    await loadInspections();
    setIsSyncing(false);
    setSyncStatus('');
  }

  async function handleCreateCompany() {
    if (!companyName.trim()) {
      showAlert('Error', 'Please enter a company name');
      return;
    }

    setIsCreatingCompany(true);
    const { error } = await createCompany(companyName.trim());
    setIsCreatingCompany(false);

    if (error) {
      showAlert('Error', error);
    } else {
      setCompanyName('');
      setShowCreateCompany(false);
      showAlert('Success', 'Company created successfully');
    }
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

  // Show company setup if user has no company
  if (!currentCompany) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.noCompanyContainer}>
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
        </ScrollView>
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
        {/* Sync Status Banner - Shows when connected to HCP and/or Jobber */}
        {(isHcpConnected || isJobberConnected) && (
          <TouchableOpacity
            style={styles.syncBanner}
            onPress={handleManualSync}
            disabled={isSyncing}
          >
            <View style={styles.syncBannerContent}>
              <Ionicons name="sync" size={18} color={COLORS.white} />
              <Text style={styles.syncBannerText}>
                {isSyncing
                  ? syncStatus || 'Syncing...'
                  : `Connected to ${[
                      isHcpConnected ? 'Housecall Pro' : '',
                      isJobberConnected ? 'Jobber' : '',
                    ].filter(Boolean).join(' & ')}`
                }
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

        {!isHcpConnected && !isJobberConnected && (
          <TouchableOpacity
            style={styles.connectBanner}
            onPress={() => router.push('/settings/integrations')}
          >
            <Ionicons name="link-outline" size={18} color={COLORS.primary} />
            <Text style={styles.connectBannerText}>
              Connect Scheduling Platform to Auto-Import Jobs
            </Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Jobs Summary Header */}
        {(isHcpConnected || isJobberConnected) && lastSyncJobCount > 0 && (
          <View style={styles.jobsSummaryHeader}>
            <Text style={styles.jobsSummaryText}>
              {lastSyncJobCount} job{lastSyncJobCount !== 1 ? 's' : ''} synced
            </Text>
            <Text style={styles.jobsSummarySubtext}>
              {allInspections.length} active job{allInspections.length !== 1 ? 's' : ''} in schedule
            </Text>
          </View>
        )}

        {/* Selected Date Header */}
        <Text style={styles.selectedDateHeader}>{formatSelectedDateHeader()}</Text>

        {/* Subscription Required Banner */}
        {!hasActiveSubscription && filteredInspections.length > 0 && (
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
              onPress={() => handleJobPress(inspection.id)}
              activeOpacity={hasActiveSubscription ? 0.7 : 1}
            >
              <Card style={[
                styles.inspectionCard,
                !hasActiveSubscription && styles.inspectionCardDisabled,
              ]}>
                {!hasActiveSubscription && (
                  <View style={styles.lockedOverlay}>
                    <Ionicons name="lock-closed" size={24} color={COLORS.gray400} />
                  </View>
                )}
                <View style={[
                  styles.inspectionHeader,
                  !hasActiveSubscription && styles.inspectionHeaderDisabled,
                ]}>
                  <View style={styles.inspectionInfo}>
                    {inspection.scheduled_date && (
                      <Text style={[
                        styles.inspectionTime,
                        !hasActiveSubscription && styles.textDisabled,
                      ]}>
                        {formatTime(inspection.scheduled_date)}
                      </Text>
                    )}
                    <Text style={[
                      styles.inspectionName,
                      !hasActiveSubscription && styles.textDisabled,
                    ]}>
                      {inspection.project_name}
                    </Text>
                    {inspection.client_name && (
                      <Text style={[
                        styles.inspectionClient,
                        !hasActiveSubscription && styles.textDisabled,
                      ]}>
                        {inspection.client_name}
                      </Text>
                    )}
                    {inspection.project_address && (
                      <View style={styles.addressRow}>
                        <Ionicons
                          name="location-outline"
                          size={14}
                          color={hasActiveSubscription ? COLORS.textSecondary : COLORS.gray400}
                        />
                        <Text style={[
                          styles.inspectionAddress,
                          !hasActiveSubscription && styles.textDisabled,
                        ]} numberOfLines={1}>
                          {inspection.project_address}
                        </Text>
                      </View>
                    )}
                    {(inspection.hcp_assigned_employee || inspection.jobber_assigned_employee) && (
                      <View style={styles.employeeRow}>
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={hasActiveSubscription ? COLORS.textSecondary : COLORS.gray400}
                        />
                        <Text style={[
                          styles.employeeName,
                          !hasActiveSubscription && styles.textDisabled,
                        ]}>
                          {inspection.hcp_assigned_employee || inspection.jobber_assigned_employee}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.inspectionMeta}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: hasActiveSubscription
                          ? getStatusColor(inspection.completion_percentage ?? 0) + '20'
                          : COLORS.gray200
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: hasActiveSubscription
                            ? getStatusColor(inspection.completion_percentage ?? 0)
                            : COLORS.gray500
                          },
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

      <TouchableOpacity
        style={[styles.fab, !hasActiveSubscription && styles.fabDisabled]}
        onPress={() => {
          if (!hasActiveSubscription) {
            if (Platform.OS === 'web') {
              alert('Subscription required to create inspections. Please subscribe to a plan.');
            } else {
              Alert.alert(
                'Subscription Required',
                'You need an active subscription to create inspections.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Subscribe', onPress: () => router.push('/settings/subscription') },
                ]
              );
            }
            return;
          }
          router.push('/inspection/create');
        }}
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
  jobsSummaryHeader: {
    backgroundColor: COLORS.gray100,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  jobsSummaryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  jobsSummarySubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  noCompanyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    paddingTop: SPACING.xl * 2,
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
  inspectionHeaderDisabled: {
    opacity: 0.6,
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
  fabDisabled: {
    backgroundColor: COLORS.gray400,
  },
});
