import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import { Card, Button, Input } from '../../src/components/ui';
import { useCompany, useAuth } from '../../src/contexts';
import * as hcpService from '../../src/services/housecallpro.service';
import * as jobberService from '../../src/services/jobber.service';
import * as inspectionService from '../../src/services/inspection.service';

export default function IntegrationsScreen() {
  const { user } = useAuth();
  const { currentCompany, isAdmin } = useCompany();
  const params = useLocalSearchParams<{ success?: string; error?: string }>();

  // HCP State
  const [isHcpConnected, setIsHcpConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Jobber State
  const [isJobberConnected, setIsJobberConnected] = useState(false);
  const [isJobberConnecting, setIsJobberConnecting] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!currentCompany) return;

    setIsCheckingConnection(true);

    // Check both connections in parallel
    const [hcpConnected, jobberConnected] = await Promise.all([
      hcpService.isConnected(currentCompany.id),
      jobberService.isConnected(currentCompany.id),
    ]);

    setIsHcpConnected(hcpConnected);
    setIsJobberConnected(jobberConnected);
    setIsCheckingConnection(false);
  }, [currentCompany]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  // Handle OAuth callback params
  useEffect(() => {
    if (params.success === 'jobber') {
      showAlert('Success', 'Connected to Jobber! All team members can now sync jobs.');
      checkConnection();
    } else if (params.error) {
      showAlert('Error', params.error);
    }
  }, [params.success, params.error]);

  async function handleHcpConnect() {
    if (!currentCompany || !user) return;

    if (!apiKey.trim()) {
      showAlert('Error', 'Please enter your API key');
      return;
    }

    setIsConnecting(true);

    // Save the key first
    await hcpService.saveApiKey(currentCompany.id, apiKey.trim(), user.id);

    // Test the connection
    const { data, error } = await hcpService.testConnection(currentCompany.id);

    if (error || !data) {
      await hcpService.removeApiKey(currentCompany.id);
      showAlert('Connection Failed', error || 'Unable to connect to Housecall Pro');
      setIsConnecting(false);
      return;
    }

    setIsHcpConnected(true);
    setShowApiKeyInput(false);
    setApiKey('');
    setIsConnecting(false);
    showAlert('Success', 'Connected to Housecall Pro! All team members can now sync jobs.');
  }

  async function handleJobberConnect() {
    if (!currentCompany || !user) return;

    setIsJobberConnecting(true);
    const { error } = await jobberService.startOAuthFlow(currentCompany.id, user.id);

    if (error) {
      setIsJobberConnecting(false);
      showAlert('Configuration Error', error);
    }
    // Note: If successful, the page will redirect, so we don't need to set state back
  }

  async function handleHcpDisconnect() {
    if (!currentCompany) return;

    const doDisconnect = async () => {
      // Delete all HCP-imported inspections
      const { data, error } = await inspectionService.deleteHcpInspections(currentCompany.id);

      if (error) {
        showAlert('Error', 'Failed to remove HCP jobs: ' + error);
        return;
      }

      // Remove the API key
      await hcpService.removeApiKey(currentCompany.id);
      setIsHcpConnected(false);

      const jobCount = data?.count || 0;
      if (jobCount > 0) {
        showAlert('Disconnected', `Removed ${jobCount} job${jobCount === 1 ? '' : 's'} imported from Housecall Pro.`);
      }
    };

    const message = 'Are you sure you want to disconnect from Housecall Pro? This will remove all jobs imported from HCP and affect all team members.';

    if (Platform.OS === 'web') {
      if (confirm(message)) {
        doDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: doDisconnect },
        ]
      );
    }
  }

  async function handleJobberTest() {
    if (!currentCompany) return;

    showAlert('Testing...', 'Testing Jobber connection...');
    const { data, error } = await jobberService.testConnection(currentCompany.id);

    if (error) {
      showAlert('Test Failed', `Error: ${error}`);
    } else {
      showAlert('Test Passed', 'Jobber connection is working!');
    }
  }

  async function handleJobberDisconnect() {
    if (!currentCompany) return;

    const doDisconnect = async () => {
      // Delete all Jobber-imported inspections
      const { data, error } = await inspectionService.deleteJobberInspections(currentCompany.id);

      if (error) {
        showAlert('Error', 'Failed to remove Jobber jobs: ' + error);
        return;
      }

      // Remove the integration
      await jobberService.disconnect(currentCompany.id);
      setIsJobberConnected(false);

      const jobCount = data?.count || 0;
      if (jobCount > 0) {
        showAlert('Disconnected', `Removed ${jobCount} job${jobCount === 1 ? '' : 's'} imported from Jobber.`);
      }
    };

    const message = 'Are you sure you want to disconnect from Jobber? This will remove all jobs imported from Jobber and affect all team members.';

    if (Platform.OS === 'web') {
      if (confirm(message)) {
        doDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', style: 'destructive', onPress: doDisconnect },
        ]
      );
    }
  }

  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  if (isCheckingConnection) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Only owners and admins can access this page
  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Integrations' }} />
        <View style={styles.noAccessContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.gray400} />
          <Text style={styles.noAccessTitle}>Admin Access Required</Text>
          <Text style={styles.noAccessText}>
            Only owners and admins can manage integrations.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Integrations',
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView style={styles.container}>
        {/* Housecall Pro Section */}
        <Card style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <View style={styles.integrationInfo}>
              <View style={styles.integrationIcon}>
                <Ionicons name="business" size={24} color={COLORS.primary} />
              </View>
              <View>
                <Text style={styles.integrationName}>Housecall Pro</Text>
                <Text style={styles.integrationStatus}>
                  {isHcpConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: isHcpConnected ? '#22c55e' : COLORS.gray400 }
            ]} />
          </View>

          {isHcpConnected && (
            <View style={styles.connectedInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.connectedInfoText}>
                All team members can sync jobs from Housecall Pro
              </Text>
            </View>
          )}

          {!isHcpConnected ? (
            <>
              {showApiKeyInput ? (
                <View style={styles.connectForm}>
                  {/* Step by step instructions */}
                  <View style={styles.instructionsContainer}>
                    <Text style={styles.instructionsTitle}>How to get your API Key:</Text>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Log in to your <Text style={styles.boldText}>Housecall Pro</Text> account
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Click the <Text style={styles.boldText}>Apps</Text> icon (9-dot grid) next to the gear in the top left
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Click the <Text style={styles.boldText}>Go to App Store</Text> button
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>4</Text>
                      </View>
                      <Text style={styles.stepText}>
                        In the search bar, type <Text style={styles.boldText}>API</Text>
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>5</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Select <Text style={styles.boldText}>API Key Management</Text>
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>6</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Select <Text style={styles.boldText}>Generate new API key</Text>
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>7</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Select <Text style={styles.boldText}>Full Access</Text> from the permissions dropdown
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>8</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Select the <Text style={styles.boldText}>Generate key</Text> button
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNumber}>
                        <Text style={styles.stepNumberText}>9</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Copy your new API key and paste it below
                      </Text>
                    </View>

                    <View style={styles.noteBox}>
                      <Ionicons name="information-circle" size={18} color={COLORS.info} />
                      <Text style={styles.noteText}>
                        Note: API access requires a Housecall Pro MAX plan. Only Admin users can generate API keys.
                      </Text>
                    </View>
                  </View>

                  <Input
                    label="Paste your API Key"
                    value={apiKey}
                    onChangeText={setApiKey}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    secureTextEntry
                    autoCapitalize="none"
                  />

                  <View style={styles.connectButtons}>
                    <Button
                      title="Cancel"
                      variant="outline"
                      onPress={() => {
                        setShowApiKeyInput(false);
                        setApiKey('');
                      }}
                      style={styles.cancelButton}
                    />
                    <Button
                      title="Connect"
                      onPress={handleHcpConnect}
                      loading={isConnecting}
                      style={styles.connectButton}
                    />
                  </View>
                </View>
              ) : (
                <Button
                  title="Connect Housecall Pro"
                  onPress={() => setShowApiKeyInput(true)}
                  fullWidth
                  style={styles.connectMainButton}
                  icon={<Ionicons name="link" size={18} color={COLORS.white} />}
                />
              )}
            </>
          ) : (
            <View style={styles.connectedActions}>
              <Button
                title="Disconnect"
                variant="outline"
                onPress={handleHcpDisconnect}
                style={styles.disconnectButton}
              />
            </View>
          )}
        </Card>

        {/* Jobber Section */}
        <Card style={styles.integrationCard}>
          <View style={styles.integrationHeader}>
            <View style={styles.integrationInfo}>
              <View style={[styles.integrationIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="briefcase" size={24} color="#4CAF50" />
              </View>
              <View>
                <Text style={styles.integrationName}>Jobber</Text>
                <Text style={styles.integrationStatus}>
                  {isJobberConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: isJobberConnected ? '#22c55e' : COLORS.gray400 }
            ]} />
          </View>

          {isJobberConnected && (
            <View style={styles.connectedInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.connectedInfoText}>
                All team members can sync jobs from Jobber
              </Text>
            </View>
          )}

          {!isJobberConnected ? (
            <View style={styles.connectForm}>
              <View style={styles.noteBox}>
                <Ionicons name="information-circle" size={18} color={COLORS.info} />
                <Text style={styles.noteText}>
                  API access requires a Jobber Grow plan or higher. You will be redirected to Jobber to authorize the connection.
                </Text>
              </View>

              <Button
                title="Connect Jobber"
                onPress={handleJobberConnect}
                loading={isJobberConnecting}
                fullWidth
                style={styles.connectMainButton}
                icon={<Ionicons name="link" size={18} color={COLORS.white} />}
              />
            </View>
          ) : (
            <View style={styles.connectedActions}>
              <Button
                title="Test Connection"
                variant="outline"
                onPress={handleJobberTest}
                style={[styles.disconnectButton, { marginRight: SPACING.sm }]}
              />
              <Button
                title="Disconnect"
                variant="outline"
                onPress={handleJobberDisconnect}
                style={styles.disconnectButton}
              />
            </View>
          )}
        </Card>

        <View style={{ height: SPACING.xl * 2 }} />
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
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },
  noAccessTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  noAccessText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  integrationCard: {
    margin: SPACING.md,
    padding: SPACING.lg,
  },
  integrationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  integrationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  integrationIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  integrationName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  integrationStatus: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  connectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  connectedInfoText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#166534',
  },
  connectForm: {
    marginTop: SPACING.md,
  },
  instructionsContainer: {
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  instructionsTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  stepNumberText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  stepText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  boldText: {
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.primary,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  noteText: {
    flex: 1,
    fontSize: FONT_SIZE.xs,
    color: COLORS.info,
    lineHeight: 18,
  },
  connectButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  cancelButton: {
    flex: 1,
  },
  connectButton: {
    flex: 1,
  },
  connectMainButton: {
    marginTop: SPACING.sm,
  },
  connectedActions: {
    marginTop: SPACING.sm,
  },
  disconnectButton: {
    borderColor: COLORS.error,
  },
});
