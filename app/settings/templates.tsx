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
import { useCompany } from '../../src/contexts';
import { Card } from '../../src/components/ui';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../../src/lib/constants';
import * as templateService from '../../src/services/checklist-template.service';
import type { ChecklistTemplate } from '../../src/services/checklist-template.service';

export default function TemplatesScreen() {
  const { currentCompany, isAdmin } = useCompany();

  const [isLoading, setIsLoading] = useState(true);
  const [systemTemplates, setSystemTemplates] = useState<ChecklistTemplate[]>([]);
  const [enabledTemplateIds, setEnabledTemplateIds] = useState<Set<string>>(new Set());
  const [defaultTemplateId, setDefaultTemplateId] = useState<string | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentCompany) return;

    setIsLoading(true);

    // Load system templates
    const { data: templates } = await templateService.getSystemTemplates();
    if (templates) {
      setSystemTemplates(templates);
    }

    // Load company's enabled templates
    const { data: companyTemplates } = await templateService.getCompanyTemplates(currentCompany.id);
    if (companyTemplates) {
      const enabledIds = new Set(companyTemplates.map(ct => ct.template_id));
      setEnabledTemplateIds(enabledIds);

      const defaultTemplate = companyTemplates.find(ct => ct.is_default);
      setDefaultTemplateId(defaultTemplate?.template_id || null);
    }

    setIsLoading(false);
  }, [currentCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleToggleTemplate(templateId: string) {
    if (!currentCompany || !isAdmin) return;

    setIsUpdating(templateId);

    const isEnabled = enabledTemplateIds.has(templateId);

    if (isEnabled) {
      // Disable template
      const { error } = await templateService.disableTemplate(currentCompany.id, templateId);
      if (error) {
        showAlert('Error', error);
      } else {
        setEnabledTemplateIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(templateId);
          return newSet;
        });
        if (defaultTemplateId === templateId) {
          setDefaultTemplateId(null);
        }
      }
    } else {
      // Enable template
      const isFirst = enabledTemplateIds.size === 0;
      const { error } = await templateService.enableTemplate(currentCompany.id, templateId, isFirst);
      if (error) {
        showAlert('Error', error);
      } else {
        setEnabledTemplateIds(prev => new Set([...prev, templateId]));
        if (isFirst) {
          setDefaultTemplateId(templateId);
        }
      }
    }

    setIsUpdating(null);
  }

  async function handleSetDefault(templateId: string) {
    if (!currentCompany || !isAdmin) return;

    setIsUpdating(templateId);

    const { error } = await templateService.setDefaultTemplate(currentCompany.id, templateId);
    if (error) {
      showAlert('Error', error);
    } else {
      setDefaultTemplateId(templateId);
    }

    setIsUpdating(null);
  }

  function showAlert(title: string, message: string) {
    if (Platform.OS === 'web') {
      alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  }

  function getIndustryIcon(industry: string | null): string {
    switch (industry) {
      case 'chimney':
        return 'flame-outline';
      case 'hvac':
        return 'thermometer-outline';
      case 'plumbing':
        return 'water-outline';
      case 'electrical':
        return 'flash-outline';
      default:
        return 'home-outline';
    }
  }

  function getIndustryColor(industry: string | null): string {
    switch (industry) {
      case 'chimney':
        return '#ef4444';
      case 'hvac':
        return '#3b82f6';
      case 'plumbing':
        return '#06b6d4';
      case 'electrical':
        return '#f59e0b';
      default:
        return COLORS.primary;
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={{ title: 'Checklist Templates' }} />
        <View style={styles.noAccessContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.gray400} />
          <Text style={styles.noAccessTitle}>Admin Access Required</Text>
          <Text style={styles.noAccessText}>
            Only owners and admins can manage checklist templates.
          </Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Checklist Templates' }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Select which checklist templates your team can use when creating inspections.
          The default template will be pre-selected for new inspections.
        </Text>

        {enabledTemplateIds.size === 0 && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning-outline" size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              No templates enabled. Enable at least one template for your team to use.
            </Text>
          </View>
        )}

        {systemTemplates.map((template) => {
          const isEnabled = enabledTemplateIds.has(template.id);
          const isDefault = defaultTemplateId === template.id;
          const isExpanded = expandedTemplateId === template.id;
          const isCurrentlyUpdating = isUpdating === template.id;
          const industryColor = getIndustryColor(template.industry);

          return (
            <Card key={template.id} style={styles.templateCard}>
              <TouchableOpacity
                style={styles.templateHeader}
                onPress={() => setExpandedTemplateId(isExpanded ? null : template.id)}
              >
                <View style={[styles.industryIcon, { backgroundColor: industryColor + '20' }]}>
                  <Ionicons
                    name={getIndustryIcon(template.industry) as any}
                    size={24}
                    color={industryColor}
                  />
                </View>
                <View style={styles.templateInfo}>
                  <View style={styles.templateTitleRow}>
                    <Text style={styles.templateName}>{template.name}</Text>
                    {isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.templateDescription} numberOfLines={2}>
                    {template.description}
                  </Text>
                  <Text style={styles.templateMeta}>
                    {template.categories.length} categories, {' '}
                    {template.categories.reduce((sum, cat) => sum + cat.items.length, 0)} items
                  </Text>
                </View>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={COLORS.gray400}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.templateDetails}>
                  <View style={styles.categoriesList}>
                    {template.categories.map((category, index) => (
                      <View key={index} style={styles.categoryItem}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        <Text style={styles.categoryItems}>
                          {category.items.join(' • ')}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.templateActions}>
                <TouchableOpacity
                  style={[
                    styles.toggleButton,
                    isEnabled && styles.toggleButtonEnabled,
                  ]}
                  onPress={() => handleToggleTemplate(template.id)}
                  disabled={isCurrentlyUpdating}
                >
                  {isCurrentlyUpdating ? (
                    <ActivityIndicator size="small" color={isEnabled ? COLORS.white : COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons
                        name={isEnabled ? 'checkmark-circle' : 'add-circle-outline'}
                        size={18}
                        color={isEnabled ? COLORS.white : COLORS.primary}
                      />
                      <Text style={[
                        styles.toggleButtonText,
                        isEnabled && styles.toggleButtonTextEnabled,
                      ]}>
                        {isEnabled ? 'Enabled' : 'Enable'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {isEnabled && !isDefault && (
                  <TouchableOpacity
                    style={styles.setDefaultButton}
                    onPress={() => handleSetDefault(template.id)}
                    disabled={isCurrentlyUpdating}
                  >
                    <Text style={styles.setDefaultButtonText}>Set as Default</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })}

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
  content: {
    padding: SPACING.md,
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
  description: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.lg,
    lineHeight: 22,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  warningText: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: '#92400e',
  },
  templateCard: {
    marginBottom: SPACING.md,
    padding: 0,
    overflow: 'hidden',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  industryIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  templateInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  templateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  templateName: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  defaultBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  defaultBadgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.white,
  },
  templateDescription: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  templateMeta: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.gray400,
    marginTop: 4,
  },
  templateDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.gray200,
    padding: SPACING.md,
    backgroundColor: COLORS.gray50,
  },
  categoriesList: {
    gap: SPACING.sm,
  },
  categoryItem: {
    marginBottom: SPACING.xs,
  },
  categoryName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  categoryItems: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  templateActions: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    paddingTop: 0,
    gap: SPACING.sm,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: 6,
  },
  toggleButtonEnabled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleButtonText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.primary,
  },
  toggleButtonTextEnabled: {
    color: COLORS.white,
  },
  setDefaultButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  setDefaultButtonText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
  },
});
