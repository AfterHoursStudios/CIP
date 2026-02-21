import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZE, FONT_WEIGHT, RADIUS } from '../lib/constants';

interface MeasurementInputProps {
  label: string;
  description?: string | null;
  value: { feet: number; inches: number } | null;
  onChange: (value: { feet: number; inches: number }) => void;
  maxFeet?: number;
  disabled?: boolean;
}

export default function MeasurementInput({
  label,
  description,
  value,
  onChange,
  maxFeet = 99,
  disabled = false,
}: MeasurementInputProps) {
  const [feetText, setFeetText] = useState(value?.feet?.toString() ?? '');
  const [inchesText, setInchesText] = useState(value?.inches?.toString() ?? '');

  useEffect(() => {
    setFeetText(value?.feet?.toString() ?? '');
    setInchesText(value?.inches?.toString() ?? '');
  }, [value]);

  function handleFeetChange(text: string) {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    setFeetText(cleaned);

    const feet = parseInt(cleaned, 10) || 0;
    const inches = parseInt(inchesText, 10) || 0;
    onChange({ feet: Math.min(feet, maxFeet), inches });
  }

  function handleInchesChange(text: string) {
    // Only allow numbers
    const cleaned = text.replace(/[^0-9]/g, '');
    const inchValue = parseInt(cleaned, 10) || 0;

    // Cap at 11 inches
    const cappedInches = Math.min(inchValue, 11);
    setInchesText(cappedInches > 0 ? cappedInches.toString() : cleaned);

    const feet = parseInt(feetText, 10) || 0;
    onChange({ feet, inches: cappedInches });
  }

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.topRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputsRow}>
          <TextInput
            style={styles.input}
            value={feetText}
            onChangeText={handleFeetChange}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.gray400}
            editable={!disabled}
            maxLength={2}
          />
          <Text style={styles.unitLabel}>ft</Text>
          <TextInput
            style={styles.input}
            value={inchesText}
            onChangeText={handleInchesChange}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={COLORS.gray400}
            editable={!disabled}
            maxLength={2}
          />
          <Text style={styles.unitLabel}>in</Text>
        </View>
      </View>
      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  disabled: {
    opacity: 0.6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    color: COLORS.textPrimary,
    marginRight: SPACING.sm,
  },
  description: {
    fontSize: FONT_SIZE.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  inputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    width: 45,
    height: 40,
    backgroundColor: COLORS.gray100,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.gray300,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: COLORS.textPrimary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 0,
  },
  unitLabel: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
    marginRight: SPACING.sm,
  },
});
