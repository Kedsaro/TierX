import { Database, Trash2, UserRound } from 'lucide-react-native';
import { Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { clearAllTournaments, seedDemoTournaments } from '../utils/databaseCleanup';

export function ProfileScreen() {
  const db = useSQLiteContext();
  const { user, signOut } = useAuth();
  const { player } = useCurrentPlayer();

  async function handleSeedDemoData() {
    if (!user || !player) return;
    try {
      const result = await seedDemoTournaments(db, user.id, player.id);
      Alert.alert('Demo data seeded', `Created ${result.created} tournaments across Home and Tournaments.`);
    } catch (error) {
      Alert.alert('Error', 'Failed to seed demo data.');
      console.error(error);
    }
  }

  async function handleClearTournaments() {
    Alert.alert('Delete all tournaments', 'This will delete every tournament from the database. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await clearAllTournaments(db);
            Alert.alert('Cleanup complete', `Deleted ${result.deleted} tournaments.`);
          } catch (error) {
            Alert.alert('Error', 'Failed to clear tournaments.');
            console.error(error);
          }
        },
      },
    ]);
  }

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

      {__DEV__ && (
        <View className="mt-8 gap-3">
          <Text className="text-center text-xs font-semibold uppercase text-[#65736c]">Developer Tools</Text>
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-lg bg-[#e1e7e2] px-4 py-3"
            onPress={() => void handleSeedDemoData()}
          >
            <Database color="#176b5b" size={16} />
            <Text className="text-sm font-semibold text-[#176b5b]">Seed demo tournaments</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center justify-center gap-2 rounded-lg bg-[#f9e4e2] px-4 py-3"
            onPress={() => void handleClearTournaments()}
          >
            <Trash2 color="#872822" size={16} />
            <Text className="text-sm font-semibold text-[#872822]">Delete all tournaments</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}
