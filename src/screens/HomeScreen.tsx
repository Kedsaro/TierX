import { Flag, Globe2, PlusCircle, Sparkles, Swords } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { TournamentCard } from '../components/tournaments/TournamentCard';
import { RankingRow } from '../components/tournaments/RankingRow';
import { Button } from '../components/ui/Button';
import { FeedbackState } from '../components/ui/FeedbackState';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useRejectedTournamentIds } from '../hooks/useRejectedTournamentIds';
import { useTournaments } from '../hooks/useTournaments';
import { rankingRepository, tournamentRepository } from '../database/repositories';
import type { HomeStackParamList } from '../navigation/tournaments/types';
import type { RootTabParamList } from '../navigation/RootNavigator';
import type { RankingWithPlayer } from '../types/player';
import type { Tournament, TournamentSummary } from '../types/tournament';

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, 'HomeMain'>,
  BottomTabScreenProps<RootTabParamList, 'Home'>
>;

export function HomeScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const bannedIds = useRejectedTournamentIds();

  const published = useTournaments({ registrationOpen: true, visibility: 'public', limit: 30 });
  const competitiveFeed = useTournaments({ registrationOpen: true, visibility: 'private', limit: 5 });

  const [activity, setActivity] = useState<{ organizing: number; following: number } | null>(null);
  const [topRankings, setTopRankings] = useState<RankingWithPlayer[]>([]);

  const loadActivityAndRanking = useCallback(
    (isCurrent: () => boolean) => {
      if (!user) return;

      tournamentRepository.list(db, { organizerId: user.id }).then((organized) => {
        if (isCurrent()) setActivity((prev) => ({ organizing: organized.length, following: prev?.following ?? 0 }));
      }).catch(() => {});

      if (player) {
        tournamentRepository.listFollowed(db, player.id).then((followed) => {
          // Finished tournaments no longer count as "following".
          const active = followed.filter((t) => t.status === 'published' || t.status === 'ongoing' || t.status === 'draft');
          if (isCurrent()) setActivity((prev) => ({ organizing: prev?.organizing ?? 0, following: active.length }));
        }).catch(() => {});

        if (player.favorite_game_id) {
          rankingRepository.listByGame(db, player.favorite_game_id).then((rows) => {
            if (isCurrent()) setTopRankings(rows.slice(0, 3));
          }).catch(() => {});
        }
      }
    },
    [db, user, player],
  );

  useEffect(() => {
    let isCurrent = true;
    loadActivityAndRanking(() => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [loadActivityAndRanking]);

  // Refresh the feed and activity summary whenever Home regains focus, so
  // tournaments created or joined elsewhere (e.g. via the dev seed tool)
  // show up without requiring a manual reload.
  useRefreshOnFocus(() => {
    void published.refresh();
    void competitiveFeed.refresh();
    loadActivityAndRanking(() => true);
  });

  const visibleTournaments = useMemo(
    () => published.tournaments.filter((tournament) => !bannedIds.has(tournament.id)),
    [published.tournaments, bannedIds],
  );
  const canInterestYou = useMemo(
    () => visibleTournaments.slice(0, 5),
    [visibleTournaments],
  );
  const national = useMemo(
    () => visibleTournaments.filter((tournament) => tournament.scope === 'national').slice(0, 5),
    [visibleTournaments],
  );
  const international = useMemo(
    () => visibleTournaments.filter((tournament) => tournament.scope === 'international').slice(0, 5),
    [visibleTournaments],
  );
  const visibleCompetitive = useMemo(
    () => competitiveFeed.tournaments.filter((tournament) => !bannedIds.has(tournament.id)),
    [competitiveFeed.tournaments, bannedIds],
  );
  function openDetail(tournament: Tournament) {
    navigation.navigate('TournamentDetail', { tournamentId: tournament.id });
  }


  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        <View className="flex-row items-center justify-between py-5">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-[#176b5b]">TierX</Text>
            <Text className="mt-1 text-2xl font-bold text-[#17231f]">Your local arena</Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#e1eee8]">
            <Text className="text-base font-bold text-[#176b5b]">TX</Text>
          </View>
        </View>

        <View className="-mt-2 pb-4">
          <Text className="text-xl text-[#4d5d55]">
            Welcome back, <Text className="text-4xl font-bold text-[#17231f]">{player?.display_name ?? user?.username ?? 'player'}</Text>
          </Text>
          <Text className="text-xl text-[#4d5d55]">Are you ready to compete?</Text>
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button icon={<PlusCircle color="#ffffff" size={16} />} onPress={() => navigation.navigate('TournamentForm', undefined)}>
              Create Tournament
            </Button>
          </View>
        </View>

        {activity ? (
          <View className="mt-6 flex-row gap-3">
            <ActivityStat label="Organizing" value={activity.organizing} />
            <ActivityStat label="Following" value={activity.following} />
          </View>
        ) : null}

        {topRankings.length > 0 ? (
          <View className="mt-6">
            <Text className="mb-2 text-lg font-bold text-[#17231f]">Your ranking</Text>
            <View className="rounded-xl border border-[#dfe7e1] bg-white px-4">
              {topRankings.map((ranking, index) => (
                <RankingRow key={ranking.id} position={index + 1} ranking={ranking} />
              ))}
            </View>
          </View>
        ) : null}

        <Collection
          emptyLabel="No public tournaments available yet."
          icon={<Sparkles color="#176b5b" size={18} />}
          isLoading={published.isLoading}
          onPressTournament={openDetail}
          title="Can interest you"
          tournaments={canInterestYou}
        />
        <Collection
          emptyLabel="No competitive tournaments right now."
          icon={<Swords color="#176b5b" size={18} />}
          isLoading={competitiveFeed.isLoading}
          onPressTournament={openDetail}
          title="Competitive"
          tournaments={visibleCompetitive}
        />
        <Collection
          emptyLabel="No national tournaments right now."
          icon={<Flag color="#176b5b" size={18} />}
          isLoading={published.isLoading}
          onPressTournament={openDetail}
          title="National"
          tournaments={national}
        />
        <Collection
          emptyLabel="No international tournaments right now."
          icon={<Globe2 color="#176b5b" size={18} />}
          isLoading={published.isLoading}
          onPressTournament={openDetail}
          title="International"
          tournaments={international}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <View className="flex-1 rounded-xl border border-[#dfe7e1] bg-white px-4 py-4">
      <Text className="text-2xl font-bold text-[#17231f]">{value}</Text>
      <Text className="mt-1 text-xs text-[#65736c]">{label}</Text>
    </View>
  );
}

function Collection({
  title,
  icon,
  tournaments,
  isLoading,
  emptyLabel,
  onPressTournament,
}: {
  title: string;
  icon: React.ReactNode;
  tournaments: TournamentSummary[];
  isLoading: boolean;
  emptyLabel: string;
  onPressTournament: (tournament: Tournament) => void;
}) {
  return (
    <View className="mt-6">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-[#17231f]">{title}</Text>
        {icon}
      </View>
      {isLoading ? (
        <FeedbackState kind="loading" title="Loading" />
      ) : tournaments.length === 0 ? (
        <View className="rounded-xl border border-[#dfe7e1] bg-white px-4 py-5">
          <Text className="text-sm leading-5 text-[#65736c]">{emptyLabel}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-5">
          {tournaments.map((tournament) => (
            <View className="w-72" key={tournament.id}>
              <TournamentCard
                countryName={tournament.country_name}
                gameName={tournament.game_name}
                onPress={() => onPressTournament(tournament)}
                organizerName={tournament.organizer_username}
                tournament={tournament}
              />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
