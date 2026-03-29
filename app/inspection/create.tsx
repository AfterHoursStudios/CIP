import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useCompany } from '../../src/contexts';
import * as inspectionService from '../../src/services/inspection.service';
import { Button, Input, Card } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';

export default function CreateInspectionScreen() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const newErrors: Record<string, string> = {};

    if (!projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleCreate() {
    if (!validate()) return;
    if (!currentCompany || !user) {
      Alert.alert('Error', 'No company or user found');
      return;
    }

    setIsLoading(true);
    const { data, error } = await inspectionService.createInspection(
      currentCompany.id,
      user.id,
      {
        project_name: projectName.trim(),
        project_address: projectAddress.trim() || undefined,
        client_name: clientName.trim() || undefined,
        client_email: clientEmail.trim() || undefined,
        scheduled_date: scheduledDate ? `${scheduledDate}T12:00:00.000Z` : undefined,
        hcp_assigned_employee: inspectorName.trim() || undefined,
      }
    );
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', error);
    } else if (data) {
      router.replace(`/inspection/${data.id}`);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Project Details</Text>

          <Input
            label="Project Name *"
            value={projectName}
            onChangeText={setProjectName}
            placeholder="Enter project name"
            error={errors.projectName}
          />

          <Input
            label="Project Address"
            value={projectAddress}
            onChangeText={setProjectAddress}
            placeholder="Enter project address"
          />

          <View style={styles.dateInputContainer}>
            <Text style={styles.inputLabel}>Scheduled Date</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: 12,
                  fontSize: 16,
                  borderRadius: 8,
                  border: `1px solid ${COLORS.gray300}`,
                  backgroundColor: COLORS.white,
                  color: COLORS.textPrimary,
                }}
              />
            ) : (
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  // For mobile, show a simple prompt for now
                  Alert.prompt?.(
                    'Enter Date',
                    'Format: YYYY-MM-DD',
                    (text) => text && setScheduledDate(text),
                    'plain-text',
                    scheduledDate
                  ) || Alert.alert('Date', 'Enter date in format YYYY-MM-DD');
                }}
              >
                <Ionicons name="calendar-outline" size={20} color={COLORS.textSecondary} />
                <Text style={[styles.dateButtonText, !scheduledDate && styles.dateButtonPlaceholder]}>
                  {scheduledDate || 'Select date'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <Input
            label="Inspector Name"
            value={inspectorName}
            onChangeText={setInspectorName}
            placeholder="Enter inspector name"
          />
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Client Information</Text>

          <Input
            label="Client Name"
            value={clientName}
            onChangeText={setClientName}
            placeholder="Enter client name"
          />

          <Input
            label="Client Email"
            value={clientEmail}
            onChangeText={setClientEmail}
            placeholder="Enter client email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Card>

        <Button
          title="Create Inspection"
          onPress={handleCreate}
          loading={isLoading}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
  },
  card: {
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  dateInputContainer: {
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
  },
  dateButtonText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  dateButtonPlaceholder: {
    color: COLORS.textSecondary,
  },
});
