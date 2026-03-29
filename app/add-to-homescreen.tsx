import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../src/lib/constants';

export default function AddToHomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Link href="/(auth)/login" asChild>
        <Text style={styles.backLink}>
          <Ionicons name="arrow-back" size={16} color={COLORS.primary} /> Back to Login
        </Text>
      </Link>

      <Text style={styles.title}>Add CIP to Your Home Screen</Text>
      <Text style={styles.subtitle}>
        Get quick access to Construction Inspection Pro right from your phone's home screen.
      </Text>

      {/* Android Instructions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="logo-android" size={28} color="#3DDC84" />
          <Text style={styles.sectionTitle}>Android (Chrome)</Text>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Open <Text style={styles.bold}>Chrome</Text> and go to{' '}
              <Text style={styles.bold}>www.cipro.us</Text>
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Tap the <Text style={styles.bold}>three dots</Text> (menu) in the top-right corner
            </Text>
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.textSecondary} style={styles.stepIcon} />
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Tap <Text style={styles.bold}>"Add to Home screen"</Text> or{' '}
              <Text style={styles.bold}>"Install app"</Text>
            </Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Tap <Text style={styles.bold}>"Add"</Text> to confirm
            </Text>
          </View>
        </View>
      </View>

      {/* iOS Instructions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="logo-apple" size={28} color="#000" />
          <Text style={styles.sectionTitle}>iPhone / iPad (Safari)</Text>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Open <Text style={styles.bold}>Safari</Text> and go to{' '}
              <Text style={styles.bold}>www.cipro.us</Text>
            </Text>
            <Text style={styles.note}>Note: This only works in Safari, not Chrome or other browsers</Text>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Tap the <Text style={styles.bold}>Share button</Text> at the bottom of the screen
            </Text>
            <Ionicons name="share-outline" size={24} color={COLORS.primary} style={styles.stepIcon} />
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Scroll down and tap <Text style={styles.bold}>"Add to Home Screen"</Text>
            </Text>
            <View style={styles.iosAction}>
              <Ionicons name="add-outline" size={20} color={COLORS.primary} />
              <Text style={styles.iosActionText}>Add to Home Screen</Text>
            </View>
          </View>
        </View>

        <View style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>4</Text>
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepText}>
              Tap <Text style={styles.bold}>"Add"</Text> in the top-right corner
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.doneSection}>
        <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
        <Text style={styles.doneText}>
          That's it! CIP will now appear on your home screen like a regular app.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  backLink: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONT_SIZE.xxl || 28,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xl,
    lineHeight: 22,
  },
  section: {
    backgroundColor: COLORS.gray100 || '#F5F5F5',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray300,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: COLORS.textPrimary,
  },
  step: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  stepNumberText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.white,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },
  stepIcon: {
    marginTop: SPACING.sm,
  },
  bold: {
    fontWeight: FONT_WEIGHT.semibold,
  },
  note: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
  },
  iosAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
  },
  iosActionText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.primary,
  },
  doneSection: {
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: '#E8F5E9',
    borderRadius: RADIUS.lg,
  },
  doneText: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 22,
  },
});
