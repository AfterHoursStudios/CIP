import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth, useCompany } from '../src/contexts';
import { COLORS } from '../src/lib/constants';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { companies, isLoading: companyLoading } = useCompany();

  if (authLoading || (isAuthenticated && companyLoading)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(tabs)/schedule" />;
  }

  return <Redirect href="/(marketing)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
