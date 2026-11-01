import { ArrowRight, CalendarDays, PlusCircle, Sparkles, Trophy } from 'lucide-react-native';
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
import { Input } from '../components/ui/Input';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
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

function matchesSearch(tournament: Tournament, search: string): boolean {
  if (!search) return true;
  const query = search.toLowerCase();
  return tournament.name.toLowerCase().includes(query) || (tournament.description ?? '').toLowerCase().includes(query);
}

export function HomeScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const [search, setSearch] = useState('');

  const published = useTournaments({ status: 'published', visibility: 'public', limit: 30 });
  const ongoing = useTournaments({ status: 'ongoing', visibility: 'public', limit: 10 });

  const [activity, setActivity] = useState<{ organizing: number; following: number } | null>(null);
  const [topRankings, setTopRankings] = useState<RankingWithPlayer[]>([]);

  const loadActivityAndRanking = useCallback(
    (isCurrent: () => boolean) => {
      if (!user) return;

      tournamentRepository.list(db, { organizerId: user.id }).then((organized) => {
        if (isCurrent()) setActivity((prev) => ({ organizing: organized.length, following: prev?.following ?? 0 }));
      });

      if (player) {
        tournamentRepository.listFollowed(db, player.id).then((followed) => {
          if (isCurrent()) setActivity((prev) => ({ organizing: prev?.organizing ?? 0, following: followed.length }));
        });

        if (player.favorite_game_id) {
          rankingRepository.listByGame(db, player.favorite_game_id).then((rows) => {
            if (isCurrent()) setTopRankings(rows.slice(0, 3));
          });
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
    void ongoing.refresh();
    loadActivityAndRanking(() => true);
  });

  const canInterestYou = useMemo(
    () => published.tournaments.filter((tournament) => matchesSearch(tournament, search)).slice(0, 10),
    [published.tournaments, search],
  );
  const nearYou = useMemo(
    () => canInterestYou.filter((tournament) => tournament.scope === 'local'),
    [canInterestYou],
  );
  const competitive = useMemo(
    () => canInterestYou.filter((tournament) => tournament.scope !== 'local'),
    [canInterestYou],
  );
  const others = useMemo(
    () => ongoing.tournaments.filter((tournament) => matchesSearch(tournament, search)),
    [ongoing.tournaments, search],
  );

  function openDetail(tournament: Tournament) {
    navigation.navigate('TournamentDetail', { tournamentId: tournament.id });
  }

  function goToTournaments() {
    navigation.getParent<BottomTabScreenProps<RootTabParamList>['navigation']>()?.navigate('Tournaments');
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

        <Input
          accessibilityLabel="Search tournaments"
          autoCapitalize="none"
          onChangeText={setSearch}
          onClear={() => setSearch('')}
          placeholder="Tournament search"
          returnKeyType="search"
          search
          value={search}
        />

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1">
            <Button icon={<ArrowRight color="#176b5b" size={16} />} onPress={goToTournaments} variant="secondary">
              Filters
            </Button>
          </View>
          <View className="flex-1">
            <Button icon={<PlusCircle color="#ffffff" size={16} />} onPress={() => navigation.navigate('TournamentForm', undefined)}>
              Create event
            </Button>
          </View>
        </View>

        <View className="mt-5 rounded-2xl bg-[#173d35] p-5">
          <View className="flex-row items-center gap-2">
            <Sparkles color="#f2bd56" size={17} />
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-[#c7ddd3]">Tournament desk</Text>
          </View>
          <Text className="mt-4 text-2xl font-bold text-white">Make your next match count.</Text>
          <Text className="mt-2 text-sm leading-5 text-[#d4e4dc]">
            Keep local competitions, schedules and player rankings in one place.
          </Text>
          <View className="mt-5">
            <Button onPress={goToTournaments} variant="secondary">
              Explore tournaments
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
          emptyLabel="No local tournaments right now."
          icon={<CalendarDays color="#176b5b" size={18} />}
          isLoading={published.isLoading}
          onPressTournament={openDetail}
          title="Near you"
          tournaments={nearYou}
        />
        <Collection
          emptyLabel="No regional, national or international tournaments right now."
          icon={<Trophy color="#176b5b" size={18} />}
          isLoading={published.isLoading}
          onPressTournament={openDetail}
          title="Competitive"
          tournaments={competitive}
        />
        <Collection
          emptyLabel="No tournaments are currently in progress."
          icon={<CalendarDays color="#176b5b" size={18} />}
          isLoading={ongoing.isLoading}
          onPressTournament={openDetail}
          title="Others"
          tournaments={others}
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
