import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth, useCompany } from '../../src/contexts';
import { Card, Button, Input } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as hcpService from '../../src/services/housecallpro.service';
import * as companyService from '../../src/services/company.service';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { currentCompany, companies, createCompany, isOwner, isAdmin, updateCompany, refreshCompanies } = useCompany();
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isHcpConnected, setIsHcpConnected] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      checkHcpConnection();
    }, [currentCompany])
  );

  async function checkHcpConnection() {
    if (!currentCompany) return;
    const connected = await hcpService.isConnected(currentCompany.id);
    setIsHcpConnected(connected);
  }

  async function handleCreateCompany() {
    if (!companyName.trim()) {
      Alert.alert('Error', 'Please enter a company name');
      return;
    }

    setIsCreating(true);
    const { error } = await createCompany(companyName.trim());
    setIsCreating(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      setCompanyName('');
      setShowCreateCompany(false);
      Alert.alert('Success', 'Company created successfully');
    }
  }

  async function handleSignOut() {
    const doSignOut = async () => {
      await signOut();
      router.replace('/(auth)/login');
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to sign out?')) {
        doSignOut();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: doSignOut },
      ]);
    }
  }

  async function handleUploadLogo() {
    if (!currentCompany) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingLogo(true);

    const { data, error } = await companyService.uploadCompanyLogo(
      currentCompany.id,
      result.assets[0].uri
    );

    if (error) {
      if (Platform.OS === 'web') {
        alert('Error uploading logo: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      await refreshCompanies();
      if (Platform.OS === 'web') {
        alert('Logo uploaded successfully!');
      } else {
        Alert.alert('Success', 'Logo uploaded successfully!');
      }
    }

    setIsUploadingLogo(false);
  }

  async function handleRemoveLogo() {
    if (!currentCompany) return;

    const doRemove = async () => {
      setIsUploadingLogo(true);

      const { error } = await companyService.removeCompanyLogo(currentCompany.id);

      if (error) {
        if (Platform.OS === 'web') {
          alert('Error removing logo: ' + error);
        } else {
          Alert.alert('Error', error);
        }
      } else {
        await refreshCompanies();
      }

      setIsUploadingLogo(false);
    };

    if (Platform.OS === 'web') {
      if (confirm('Remove company logo?')) {
        doRemove();
      }
    } else {
      Alert.alert('Remove Logo', 'Are you sure you want to remove the company logo?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ]);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User Info */}
      <Card style={styles.card}>
        <View style={styles.userHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={COLORS.white} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.full_name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* Company Info */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Company</Text>

        {currentCompany ? (
          <View style={styles.companyInfo}>
            <Ionicons name="business" size={24} color={COLORS.primary} />
            <View style={styles.companyDetails}>
              <Text style={styles.companyName}>{currentCompany.name}</Text>
              {isOwner && (
                <Text style={styles.companyRole}>Owner</Text>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.noCompany}>No company selected</Text>
        )}

        {companies.length === 0 && !showCreateCompany && (
          <Button
            title="Create Company"
            onPress={() => setShowCreateCompany(true)}
            variant="outline"
            style={styles.createCompanyButton}
          />
        )}

        {showCreateCompany && (
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
                variant="ghost"
                size="sm"
              />
              <Button
                title="Create"
                onPress={handleCreateCompany}
                loading={isCreating}
                size="sm"
              />
            </View>
          </View>
        )}
      </Card>

      {/* Company Settings (Owner and Admin only) */}
      {isAdmin && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Company Settings</Text>

          {/* Company Logo */}
          <View style={styles.logoSection}>
            <Text style={styles.logoLabel}>Company Logo</Text>
            <Text style={styles.logoSubtext}>This logo will appear on PDF reports</Text>

            <View style={styles.logoContainer}>
              {currentCompany?.logo_url ? (
                <Image
                  source={{ uri: currentCompany.logo_url }}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color={COLORS.gray400} />
                  <Text style={styles.logoPlaceholderText}>No logo</Text>
                </View>
              )}
            </View>

            <View style={styles.logoButtons}>
              <TouchableOpacity
                style={styles.logoButton}
                onPress={handleUploadLogo}
                disabled={isUploadingLogo}
              >
                {isUploadingLogo ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color={COLORS.primary} />
                    <Text style={styles.logoButtonText}>
                      {currentCompany?.logo_url ? 'Change Logo' : 'Upload Logo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {currentCompany?.logo_url && (
                <TouchableOpacity
                  style={[styles.logoButton, styles.logoButtonDanger]}
                  onPress={handleRemoveLogo}
                  disabled={isUploadingLogo}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  <Text style={[styles.logoButtonText, styles.logoButtonTextDanger]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/templates')}
          >
            <Ionicons name="list-outline" size={24} color={COLORS.primary} />
            <View style={styles.settingContent}>
              <Text style={styles.settingText}>Checklist Templates</Text>
              <Text style={styles.settingSubtext}>Manage inspection checklists</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
          </TouchableOpacity>
        </Card>
      )}

      {/* Integrations (Owner and Admin only) */}
      {isAdmin && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Integrations</Text>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => router.push('/settings/integrations')}
          >
            <Ionicons name="link" size={24} color={COLORS.primary} />
            <View style={styles.settingContent}>
              <Text style={styles.settingText}>Housecall Pro</Text>
              {isHcpConnected ? (
                <View style={styles.connectedBadge}>
                  <View style={styles.connectedDot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
              ) : (
                <Text style={styles.notConnectedText}>Not connected</Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
          </TouchableOpacity>
        </Card>
      )}

      {/* Settings */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingRow}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.gray600} />
          <Text style={styles.settingText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <Ionicons name="help-circle-outline" size={24} color={COLORS.gray600} />
          <Text style={styles.settingText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <Ionicons name="document-text-outline" size={24} color={COLORS.gray600} />
          <Text style={styles.settingText}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
        </TouchableOpacity>
      </Card>

      {/* Sign Out */}
      <Button
        title="Sign Out"
        onPress={handleSignOut}
        variant="outline"
        fullWidth
        style={styles.signOutButton}
        icon={<Ionicons name="log-out-outline" size={20} color={COLORS.primary} />}
      />

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
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
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
  },
  companyDetails: {
    marginLeft: SPACING.md,
  },
  companyName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  companyRole: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
  noCompany: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  createCompanyButton: {
    marginTop: SPACING.md,
  },
  createCompanyForm: {
    marginTop: SPACING.md,
  },
  createCompanyButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
  },
  settingContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  settingText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  connectedText: {
    fontSize: FONT_SIZE.sm,
    color: '#22c55e',
  },
  notConnectedText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  settingSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  signOutButton: {
    marginTop: SPACING.md,
  },
  version: {
    textAlign: 'center',
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  logoSection: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray200,
    marginBottom: SPACING.md,
  },
  logoLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
  },
  logoSubtext: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray50,
  },
  logoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.gray100,
    borderWidth: 2,
    borderColor: COLORS.gray200,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.gray400,
    marginTop: SPACING.xs,
  },
  logoButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.md,
  },
  logoButtonDanger: {
    backgroundColor: '#fee2e2',
  },
  logoButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  logoButtonTextDanger: {
    color: COLORS.error,
  },
});
