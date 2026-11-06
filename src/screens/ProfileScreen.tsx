import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Database, MapPin, Pencil, ShieldCheck, Trash2, Trophy, UserRound } from 'lucide-react-native';
import { Alert, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { RankingRow } from '../components/tournaments/RankingRow';
import { TournamentCard } from '../components/tournaments/TournamentCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { FeedbackState } from '../components/ui/FeedbackState';
import { countryRepository, gameRepository, notificationRepository, playerRepository, preferencesRepository, profileRepository, rankingRepository, tournamentRepository } from '../database/repositories';
import { isAdminRole } from '../tournaments/authorization';
import type { AppNotification } from '../types/admin';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { ProfileStackParamList } from '../navigation/tournaments/types';
import type { MatchHistoryItem, PlayerRankSummary, ProfileStats, UserPreferences } from '../types/profile';
import type { Player, RankingWithPlayer } from '../types/player';
import type { TournamentSummary } from '../types/tournament';
import { clearAllTournaments, seedDemoTournaments } from '../utils/databaseCleanup';

type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

interface ProfileData {
  player: Player | null;
  preferences: UserPreferences | null;
  stats: ProfileStats | null;
  rank: PlayerRankSummary | null;
  leaderboard: RankingWithPlayer[];
  created: TournamentSummary[];
  participating: TournamentSummary[];
  history: MatchHistoryItem[];
  countryName: string | null;
  favoriteGameName: string | null;
  notifications: AppNotification[];
  unreadCount: number;
}

export function ProfileScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<ProfileNavigation>();
  const { user, signOut } = useAuth();
  const { player: linkedPlayer, isLoading: isPlayerLoading } = useCurrentPlayer();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const fetchProfile = useCallback(async (): Promise<ProfileData> => {
    if (!user || !linkedPlayer) throw new Error('No signed-in player.');
    const [player, preferences, stats, created, participating, history, countries, games, notifications, unreadCount] = await Promise.all([
      playerRepository.getById(db, linkedPlayer.id),
      preferencesRepository.getForUser(db, user.id),
      profileRepository.getStats(db, user.id, linkedPlayer.id),
      tournamentRepository.list(db, { organizerId: user.id }),
      tournamentRepository.listFollowed(db, linkedPlayer.id),
      profileRepository.listMatchHistory(db, linkedPlayer.id),
      countryRepository.list(db),
      gameRepository.list(db),
      notificationRepository.listForUser(db, user.id, 10),
      notificationRepository.unreadCount(db, user.id),
    ]);

    const favoriteGameId = player?.favorite_game_id ?? null;
    const [rank, leaderboard] = favoriteGameId !== null
      ? await Promise.all([
          profileRepository.getRankForGame(db, linkedPlayer.id, favoriteGameId),
          rankingRepository.listByGame(db, favoriteGameId),
        ])
      : [null, []];

    return {
      player,
      preferences,
      stats,
      rank,
      leaderboard: leaderboard.slice(0, 5),
      created,
      participating,
      history,
      countryName: countries.find((country) => country.id === player?.country_id)?.name ?? null,
      favoriteGameName: games.find((game) => game.id === favoriteGameId)?.name ?? null,
      notifications,
      unreadCount,
    };
  }, [db, user, linkedPlayer]);

  const load = useCallback(() => {
    if (!linkedPlayer) return;
    fetchProfile().then(
      (result) => {
        setData(result);
        setLoadError(false);
      },
      (error: unknown) => {
        console.error('Failed to load profile.', error);
        setLoadError(true);
      },
    );
  }, [fetchProfile, linkedPlayer]);

  // `linkedPlayer` resolves asynchronously (it may be created on first use),
  // so the first focus callback can fire while it is still null; re-running
  // the effect once it arrives guarantees the profile actually loads.
  useEffect(() => {
    if (linkedPlayer) load();
  }, [load, linkedPlayer]);

  useRefreshOnFocus(() => {
    load();
  });

  async function handleSeedDemoData() {
    if (!user || !linkedPlayer) return;
    try {
      const result = await seedDemoTournaments(db, user.id, linkedPlayer.id);
      Alert.alert('Demo data seeded', `Created ${result.created} tournaments across Home and Tournaments.`);
      load();
    } catch (error) {
      Alert.alert('Error', 'Failed to seed demo data.');
      console.error(error);
    }
  }

  function handleClearTournaments() {
    Alert.alert('Delete all tournaments', 'This will delete every tournament from the database. Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await clearAllTournaments(db);
            Alert.alert('Cleanup complete', `Deleted ${result.deleted} tournaments.`);
            load();
          } catch (error) {
            Alert.alert('Error', 'Failed to clear tournaments.');
            console.error(error);
          }
        },
      },
    ]);
  }

  const isLoadingProfile = isPlayerLoading || (linkedPlayer !== null && data === null && !loadError);

  if (isLoadingProfile) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
        <Text className="py-5 text-2xl font-bold text-[#17231f]">Profile</Text>
        <FeedbackState kind="loading" title="Loading your profile" />
      </SafeAreaView>
    );
  }

  if (loadError || !data?.player || !data.stats) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
        <Text className="py-5 text-2xl font-bold text-[#17231f]">Profile</Text>
        <FeedbackState
          kind="error"
          title="We couldn't load your profile"
          description="Check your connection and try again."
          actionLabel="Retry"
          onAction={load}
        />
      </SafeAreaView>
    );
  }

  const { player, preferences, stats, rank, leaderboard, created, participating, history, countryName, favoriteGameName, notifications, unreadCount } = data;
  const winRate = stats.wins + stats.losses > 0 ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : null;
  const initials = player.display_name.trim().slice(0, 2).toUpperCase();

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-8" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between py-5">
          <Text className="text-2xl font-bold text-[#17231f]">Profile</Text>
          <View className="flex-row gap-2">
            {isAdminRole(user?.role) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Administration"
                className="flex-row items-center gap-1.5 rounded-lg bg-[#173d35] px-3 py-2"
                onPress={() => navigation.navigate('Admin')}
              >
                <ShieldCheck color="#f2bd56" size={15} />
                <Text className="text-sm font-bold text-[#f2bd56]">Admin</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile"
              className="flex-row items-center gap-1.5 rounded-lg bg-[#e1eee8] px-3 py-2"
              onPress={() => navigation.navigate('EditProfile')}
            >
              <Pencil color="#17483e" size={15} />
              <Text className="text-sm font-bold text-[#17483e]">Edit</Text>
            </Pressable>
          </View>
        </View>

        <Card className="items-center px-5 py-6">
          {player.avatar_uri ? (
            <Image source={{ uri: player.avatar_uri }} className="h-20 w-20 rounded-full" accessibilityLabel="Profile avatar" />
          ) : (
            <View className="h-20 w-20 items-center justify-center rounded-full bg-[#e1eee8]">
              <Text className="text-2xl font-bold text-[#176b5b]">{initials}</Text>
            </View>
          )}
          <Text className="mt-3 text-lg font-bold text-[#17231f]">{player.display_name}</Text>
          <Text className="mt-0.5 text-sm text-[#65736c]">@{user?.username}</Text>
          {player.bio ? (
            <Text className="mt-3 text-center text-sm leading-5 text-[#4d5d55]">{player.bio}</Text>
          ) : (
            <Text className="mt-3 text-center text-sm italic text-[#85928b]">No description yet — add one from Edit profile.</Text>
          )}
          <View className="mt-4 flex-row flex-wrap justify-center gap-2">
            {countryName ? <Badge label={countryName} tone="neutral" /> : null}
            {favoriteGameName ? <Badge label={favoriteGameName} tone="accent" /> : null}
            <Badge label={preferences?.privacy === 'private' ? 'Private profile' : 'Public profile'} tone="neutral" />
            {preferences?.notifications_enabled ? <Badge label="Notifications on" tone="success" /> : <Badge label="Notifications off" tone="neutral" />}
          </View>
        </Card>

        <View className="mt-4 flex-row gap-2">
          <StatCard label="Organized" value={stats.organized} />
          <StatCard label="Playing" value={stats.participating} />
          <StatCard label="Wins" value={stats.wins} />
          <StatCard label="Losses" value={stats.losses} />
        </View>

        <Card className="mt-4 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Bell color="#176b5b" size={16} />
              <Text className="text-base font-bold text-[#17231f]">Notifications</Text>
            </View>
            {unreadCount > 0 ? <Badge label={`${unreadCount} new`} tone="accent" /> : null}
          </View>
          {notifications.length === 0 ? (
            <Text className="mt-3 text-sm leading-5 text-[#65736c]">
              Registrations, match schedules and results will show up here.
            </Text>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <View className="flex-row items-start gap-3 border-b border-[#e7ece8] py-3" key={notification.id}>
                <View className={`mt-1.5 h-2 w-2 rounded-full ${notification.read_at ? 'bg-[#dfe7e1]' : 'bg-[#176b5b]'}`} />
                <View className="min-w-0 flex-1">
                  <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>{notification.title}</Text>
                  <Text className="mt-0.5 text-xs leading-4 text-[#65736c]" numberOfLines={2}>{notification.message}</Text>
                </View>
              </View>
            ))
          )}
          {unreadCount > 0 ? (
            <View className="mt-3">
              <Button
                onPress={() => void notificationRepository.markAllRead(db, user!.id).then(load)}
                variant="secondary"
              >
                Mark all as read
              </Button>
            </View>
          ) : null}
        </Card>

        <Card className="mt-4 px-4 py-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-[#17231f]">Local ranking</Text>
            {favoriteGameName ? <Badge label={favoriteGameName} tone="accent" /> : null}
          </View>
          {favoriteGameName === null ? (
            <Text className="mt-3 text-sm leading-5 text-[#65736c]">
              Pick a favorite game in Edit profile to see your local leaderboard here.
            </Text>
          ) : rank === null ? (
            <Text className="mt-3 text-sm leading-5 text-[#65736c]">
              You have no ranked matches in {favoriteGameName} yet. Finish a match to enter the leaderboard.
            </Text>
          ) : (
            <View className="mt-3">
              <View className="flex-row items-center justify-between rounded-lg bg-[#e1eee8] px-3 py-2.5">
                <Text className="text-sm font-bold text-[#17483e]">
                  #{rank.position} of {rank.total}
                </Text>
                <Text className="text-sm font-bold text-[#17483e]">
                  {rank.rating} RP{winRate !== null ? ` · ${winRate}% win rate` : ''}
                </Text>
              </View>
              {leaderboard.map((entry, index) => (
                <RankingRow key={entry.id} ranking={entry} position={index + 1} />
              ))}
            </View>
          )}
        </Card>

        <ProfileSection
          icon={<Trophy color="#176b5b" size={16} />}
          title={`Created by you (${created.length})`}
          emptyLabel="You have not created any tournaments yet."
        >
          {created.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              gameName={tournament.game_name}
              countryName={tournament.country_name}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: tournament.id })}
            />
          ))}
        </ProfileSection>

        <ProfileSection
          icon={<UserRound color="#176b5b" size={16} />}
          title={`Participating (${participating.length})`}
          emptyLabel="You are not registered in any tournament yet."
        >
          {participating.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              gameName={tournament.game_name}
              countryName={tournament.country_name}
              organizerName={tournament.organizer_username}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: tournament.id })}
            />
          ))}
        </ProfileSection>

        <Card className="mt-4 px-4 py-4">
          <Text className="text-base font-bold text-[#17231f]">Match history</Text>
          {history.length === 0 ? (
            <Text className="mt-3 text-sm leading-5 text-[#65736c]">
              Your completed matches will appear here once organizers publish results.
            </Text>
          ) : (
            history.map((match) => {
              const isPlayerOne = match.player_one_id === player.id;
              const ownScore = isPlayerOne ? match.score_one : match.score_two;
              const opponentScore = isPlayerOne ? match.score_two : match.score_one;
              const opponentName = isPlayerOne ? match.player_two_name : match.player_one_name;
              const won = match.winner_id === player.id;
              return (
                <Pressable
                  key={match.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${match.tournament_name}`}
                  className="flex-row items-center gap-3 border-b border-[#e7ece8] py-3 active:opacity-70"
                  onPress={() => navigation.navigate('TournamentDetail', { tournamentId: match.tournament_id })}
                >
                  <Badge label={won ? 'Won' : 'Lost'} tone={won ? 'success' : 'danger'} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>{match.tournament_name}</Text>
                    <Text className="mt-0.5 text-xs text-[#65736c]" numberOfLines={1}>
                      {match.game_name} · vs {opponentName ?? 'Unknown'} · R{match.round_number} M{match.match_number}
                    </Text>
                  </View>
                  <Text className="text-sm font-bold text-[#17231f]">{ownScore ?? '–'} - {opponentScore ?? '–'}</Text>
                </Pressable>
              );
            })
          )}
        </Card>

        <View className="mt-5 gap-3">
          <Button onPress={() => navigation.navigate('EditProfile')} variant="secondary">Edit profile</Button>
          <Button onPress={() => void signOut()} variant="quiet">Sign out</Button>
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
              onPress={handleClearTournaments}
            >
              <Trash2 color="#872822" size={16} />
              <Text className="text-sm font-semibold text-[#872822]">Delete all tournaments</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex-1 items-center px-2 py-3">
      <Text className="text-xl font-bold text-[#176b5b]">{value}</Text>
      <Text className="mt-1 text-xs font-semibold text-[#65736c]">{label}</Text>
    </Card>
  );
}

function ProfileSection({ icon, title, emptyLabel, children }: { icon: React.ReactNode; title: string; emptyLabel: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-center gap-2">
        {icon}
        <Text className="text-base font-bold text-[#17231f]">{title}</Text>
      </View>
      <View className="gap-3">
        {Array.isArray(children) && children.length === 0 ? (
          <Card className="items-center px-4 py-5">
            <MapPin color="#85928b" size={18} />
            <Text className="mt-2 text-center text-sm text-[#65736c]">{emptyLabel}</Text>
          </Card>
        ) : (
          children
        )}
      </View>
    </View>
  );
}
