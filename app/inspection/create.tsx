import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth, useCompany } from '../../src/contexts';
import * as inspectionService from '../../src/services/inspection.service';
import { Button, Input, Card } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../src/lib/constants';

export default function CreateInspectionScreen() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();

  const [projectName, setProjectName] = useState('');
  const [projectAddress, setProjectAddress] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
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
});
