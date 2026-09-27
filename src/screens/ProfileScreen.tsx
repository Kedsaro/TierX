import { UserRound } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';

export function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <Text className="py-5 text-2xl font-bold text-[#17231f]">Profile</Text>
      <View className="mt-3 items-center rounded-xl border border-[#dfe7e1] bg-white px-6 py-10">
        <UserRound color="#176b5b" size={28} />
        <Text className="mt-4 text-base font-semibold text-[#17231f]">{user?.username ?? 'Your player profile'}</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-[#65736c]">
          Player details, rankings and tournament history will appear here.
        </Text>
        <View className="mt-5 w-full">
          <Button onPress={() => void signOut()} variant="secondary">Sign out</Button>
        </View>
      </View>
    </SafeAreaView>
  );
}