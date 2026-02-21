import { Stack } from 'expo-router';
import { COLORS } from '../../src/lib/constants';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.white,
        },
        headerTintColor: COLORS.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    />
  );
}
