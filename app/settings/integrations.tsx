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
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import { Card, Button, Input } from '../../src/components/ui';
import { useCompany, useAuth } from '../../src/contexts';
import * as hcpService from '../../src/services/housecallpro.service';

export default function IntegrationsScreen() {
  const { user } = useAuth();
  const { currentCompany, isAdmin } = useCompany();

  // HCP State
  const [isConnected, setIsConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!currentCompany) return;

    setIsCheckingConnection(true);
    const connected = await hcpService.isConnected(currentCompany.id);
    setIsConnected(connected);
    setIsCheckingConnection(false);
  }, [currentCompany]);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  async function handleConnect() {
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

    setIsConnected(true);
    setShowApiKeyInput(false);
    setApiKey('');
    setIsConnecting(false);
    showAlert('Success', 'Connected to Housecall Pro! All team members can now sync jobs.');
  }

  async function handleDisconnect() {
    if (!currentCompany) return;

    const doDisconnect = async () => {
      await hcpService.removeApiKey(currentCompany.id);
      setIsConnected(false);
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to disconnect from Housecall Pro? This will affect all team members.')) {
        doDisconnect();
      }
    } else {
      Alert.alert(
        'Disconnect',
        'Are you sure you want to disconnect from Housecall Pro? This will affect all team members.',
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
                  {isConnected ? 'Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            <View style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#22c55e' : COLORS.gray400 }
            ]} />
          </View>

          {isConnected && (
            <View style={styles.connectedInfo}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.connectedInfoText}>
                All team members can sync jobs from Housecall Pro
              </Text>
            </View>
          )}

          {!isConnected ? (
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
                      onPress={handleConnect}
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
                onPress={handleDisconnect}
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
