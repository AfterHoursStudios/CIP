import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCompany, useAuth } from '../../src/contexts';
import { Card, Button, Input } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as companyService from '../../src/services/company.service';
import type { MemberRole, CompanyMember } from '../../src/types';
import type { PendingInvitation } from '../../src/services/company.service';

const ROLES: { value: MemberRole; label: string; description: string }[] = [
  { value: 'inspector', label: 'Inspector', description: 'Can create and manage inspections' },
  { value: 'admin', label: 'Admin', description: 'Can manage team members and settings' },
  { value: 'owner', label: 'Owner', description: 'Full access to everything' },
];

export default function TeamScreen() {
  const { user } = useAuth();
  const {
    currentCompany,
    members,
    isLoading,
    isOwner,
    isAdmin,
    inviteMember,
    updateMemberRole,
    removeMember,
    refreshMembers,
  } = useCompany();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('inspector');
  const [isInviting, setIsInviting] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CompanyMember | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);

  const loadPendingInvitations = useCallback(async () => {
    if (!currentCompany || !isAdmin) return;
    const { data } = await companyService.getPendingInvitations(currentCompany.id);
    setPendingInvitations(data || []);
  }, [currentCompany, isAdmin]);

  useEffect(() => {
    loadPendingInvitations();
  }, [loadPendingInvitations]);

  async function handleCancelInvitation(invitationId: string) {
    const doDelete = async () => {
      const { error } = await companyService.cancelInvitation(invitationId);
      if (error) {
        if (Platform.OS === 'web') {
          alert('Error: ' + error);
        } else {
          Alert.alert('Error', error);
        }
      } else {
        loadPendingInvitations();
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to cancel this invitation?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Cancel Invitation',
        'Are you sure you want to cancel this invitation?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, Cancel', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(inviteEmail)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsInviting(true);
    const { error } = await inviteMember(inviteEmail.trim(), inviteRole);
    setIsInviting(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      Alert.alert('Success', 'Team member invited successfully');
      setInviteEmail('');
      setInviteRole('inspector');
      setShowInvite(false);
      loadPendingInvitations();
    }
  }

  function handleMemberPress(member: CompanyMember) {
    if (!isAdmin) return;
    if (member.user_id === user?.id) return; // Can't modify yourself
    setSelectedMember(member);
    setShowMemberModal(true);
  }

  async function handleRoleChange(newRole: MemberRole) {
    if (!selectedMember) return;

    const { error } = await updateMemberRole(selectedMember.id, newRole);
    if (error) {
      if (Platform.OS === 'web') {
        alert('Error: ' + error);
      } else {
        Alert.alert('Error', error);
      }
    } else {
      setShowMemberModal(false);
      setSelectedMember(null);
      refreshMembers();
    }
  }

  async function handleRemoveMember() {
    if (!selectedMember) return;

    const memberName = selectedMember.user?.full_name || selectedMember.user?.email || 'this member';

    const doRemove = async () => {
      const { error } = await removeMember(selectedMember.id);
      if (error) {
        if (Platform.OS === 'web') {
          alert('Error: ' + error);
        } else {
          Alert.alert('Error', error);
        }
      } else {
        setShowMemberModal(false);
        setSelectedMember(null);
        refreshMembers();
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
        doRemove();
      }
    } else {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${memberName} from the team?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: doRemove },
        ]
      );
    }
  }

  if (!currentCompany) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="people-outline" size={64} color={COLORS.gray400} />
        <Text style={styles.emptyTitle}>No Company Selected</Text>
        <Text style={styles.emptyText}>
          Select or create a company to manage team members.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isAdmin && (
        <View style={styles.header}>
          <Button
            title={showInvite ? 'Cancel' : 'Invite Member'}
            onPress={() => setShowInvite(!showInvite)}
            variant={showInvite ? 'outline' : 'primary'}
            icon={
              <Ionicons
                name={showInvite ? 'close' : 'person-add'}
                size={18}
                color={showInvite ? COLORS.primary : COLORS.white}
              />
            }
          />
        </View>
      )}

      {showInvite && (
        <Card style={styles.inviteCard}>
          <Input
            label="Email Address"
            value={inviteEmail}
            onChangeText={setInviteEmail}
            placeholder="colleague@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.roleLabel}>Role</Text>
          <View style={styles.roleOptions}>
            {ROLES.filter((r) => r.value !== 'owner' || isOwner).map((role) => (
              <TouchableOpacity
                key={role.value}
                style={[
                  styles.roleOption,
                  inviteRole === role.value && styles.roleOptionSelected,
                ]}
                onPress={() => setInviteRole(role.value)}
              >
                <View style={styles.roleOptionHeader}>
                  <View
                    style={[
                      styles.radioButton,
                      inviteRole === role.value && styles.radioButtonSelected,
                    ]}
                  >
                    {inviteRole === role.value && <View style={styles.radioButtonInner} />}
                  </View>
                  <Text style={styles.roleOptionLabel}>{role.label}</Text>
                </View>
                <Text style={styles.roleOptionDesc}>{role.description}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Button
            title="Send Invitation"
            onPress={handleInvite}
            loading={isInviting}
            fullWidth
            style={styles.inviteButton}
          />
        </Card>
      )}

      {/* Pending Invitations */}
      {isAdmin && pendingInvitations.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>Pending Invitations</Text>
          {pendingInvitations.map((invitation) => (
            <Card key={invitation.id} style={styles.invitationCard}>
              <View style={styles.invitationInfo}>
                <View style={styles.invitationAvatar}>
                  <Ionicons name="mail-outline" size={20} color={COLORS.gray500} />
                </View>
                <View style={styles.invitationDetails}>
                  <Text style={styles.invitationEmail}>{invitation.email}</Text>
                  <Text style={styles.invitationMeta}>
                    {invitation.role} · Expires{' '}
                    {new Date(invitation.expires_at).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => handleCancelInvitation(invitation.id)}
                style={styles.cancelButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </TouchableOpacity>
            </Card>
          ))}
        </View>
      )}

      {/* Team Members */}
      {members.length > 0 && (
        <Text style={[styles.sectionTitle, styles.membersTitle]}>Team Members</Text>
      )}

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleMemberPress(item)}
            disabled={!isAdmin || item.user_id === user?.id}
            activeOpacity={0.7}
          >
            <Card style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={COLORS.white} />
                </View>
                <View style={styles.memberDetails}>
                  <Text style={styles.memberName}>
                    {item.user?.full_name || item.user?.email || 'Unknown'}
                    {item.user_id === user?.id && ' (You)'}
                  </Text>
                  <Text style={styles.memberEmail}>{item.user?.email}</Text>
                </View>
              </View>
              <View style={styles.memberRight}>
                <View style={[styles.roleBadge, styles[`role_${item.role}`]]}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
                {isAdmin && item.user_id !== user?.id && (
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.gray400}
                    style={styles.chevron}
                  />
                )}
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>No team members yet.</Text>
          </View>
        }
      />

      {/* Member Management Modal */}
      <Modal
        visible={showMemberModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Member</Text>
              <TouchableOpacity onPress={() => setShowMemberModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedMember && (
              <>
                <View style={styles.modalMemberInfo}>
                  <View style={styles.modalAvatar}>
                    <Ionicons name="person" size={32} color={COLORS.white} />
                  </View>
                  <View>
                    <Text style={styles.modalMemberName}>
                      {selectedMember.user?.full_name || 'Unknown'}
                    </Text>
                    <Text style={styles.modalMemberEmail}>
                      {selectedMember.user?.email}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalSectionTitle}>Change Role</Text>
                {ROLES.filter((r) => r.value !== 'owner' || isOwner).map((role) => (
                  <TouchableOpacity
                    key={role.value}
                    style={[
                      styles.modalRoleOption,
                      selectedMember.role === role.value && styles.modalRoleOptionSelected,
                    ]}
                    onPress={() => handleRoleChange(role.value)}
                  >
                    <View style={styles.modalRoleInfo}>
                      <Text style={styles.modalRoleLabel}>{role.label}</Text>
                      <Text style={styles.modalRoleDesc}>{role.description}</Text>
                    </View>
                    {selectedMember.role === role.value && (
                      <Ionicons name="checkmark" size={24} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}

                <Button
                  title="Remove from Team"
                  onPress={handleRemoveMember}
                  variant="outline"
                  fullWidth
                  style={styles.removeButton}
                  icon={<Ionicons name="trash-outline" size={18} color={COLORS.error} />}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
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
  },
  header: {
    padding: SPACING.md,
    alignItems: 'flex-end',
  },
  inviteCard: {
    margin: SPACING.md,
    marginTop: 0,
    padding: SPACING.md,
  },
  roleLabel: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  roleOptions: {
    gap: SPACING.sm,
  },
  roleOption: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.white,
  },
  roleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  roleOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.gray400,
    marginRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  roleOptionLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  roleOptionDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginLeft: 28,
  },
  inviteButton: {
    marginTop: SPACING.lg,
  },
  listContent: {
    padding: SPACING.md,
    paddingTop: 0,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  memberEmail: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevron: {
    marginLeft: SPACING.sm,
  },
  roleBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  role_owner: {
    backgroundColor: '#E3F2FD',
  },
  role_admin: {
    backgroundColor: '#FFF3E0',
  },
  role_inspector: {
    backgroundColor: '#E8F5E9',
  },
  roleText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    textTransform: 'capitalize',
    color: COLORS.textPrimary,
  },
  emptyList: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
  },
  modalMemberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
    borderRadius: RADIUS.md,
  },
  modalAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  modalMemberName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  modalMemberEmail: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  modalRoleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    marginBottom: SPACING.sm,
  },
  modalRoleOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0F7FF',
  },
  modalRoleInfo: {
    flex: 1,
  },
  modalRoleLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  modalRoleDesc: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  removeButton: {
    marginTop: SPACING.lg,
    borderColor: COLORS.error,
  },
  // Pending invitations styles
  pendingSection: {
    paddingHorizontal: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  membersTitle: {
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: COLORS.gray300,
    backgroundColor: COLORS.gray50,
  },
  invitationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  invitationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gray200,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  invitationDetails: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
  },
  invitationMeta: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  cancelButton: {
    padding: SPACING.sm,
    backgroundColor: '#FFEBEE',
    borderRadius: RADIUS.sm,
  },
});
