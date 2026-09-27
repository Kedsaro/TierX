import { ActivityIndicator, Text, View } from 'react-native';
import { AuthNavigator } from './AuthNavigator';
import { RootNavigator } from './RootNavigator';
import { useAuth } from '../auth/AuthProvider';

export function AppNavigation() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-[#f4f6f2]">
        <ActivityIndicator color="#176b5b" size="large" />
        <Text className="text-sm text-[#65736c]">Loading your account…</Text>
      </View>
    );
  }

  return user ? <RootNavigator /> : <AuthNavigator />;
}