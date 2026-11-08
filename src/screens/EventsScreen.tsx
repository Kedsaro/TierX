import { CalendarDays, Filter, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TournamentScope, TournamentStatus, TournamentSummary } from '../types/tournament';
import { TournamentCard } from '../components/tournaments/TournamentCard';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FeedbackState } from '../components/ui/FeedbackState';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useRejectedTournamentIds } from '../hooks/useRejectedTournamentIds';
import { useTournaments } from '../hooks/useTournaments';
import type { EventsStackParamList } from '../navigation/events/types';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventsMain'>;

type OrganizedSectionKey = 'upcoming' | 'inProgress' | 'finalized';

const organizedSectionMeta: { key: OrganizedSectionKey; title: string; icon: React.ReactNode; emptyLabel: string }[] = [
  { key: 'upcoming', title: 'Upcoming', icon: <CalendarDays color="#176b5b" size={18} />, emptyLabel: 'You have no upcoming tournaments.' },
  { key: 'inProgress', title: 'In progress', icon: <Trophy color="#176b5b" size={18} />, emptyLabel: 'No tournaments are currently in progress.' },
  { key: 'finalized', title: 'Finalized', icon: <CalendarDays color="#176b5b" size={18} />, emptyLabel: 'No tournaments have been finalized yet.' },
];

/** RF-11 refinement: the Events tab groups the user's tournaments by role, with the same format and filters as the Tournaments tab. */
type Segment = 'organized' | 'participating';

const segments: { label: string; value: Segment }[] = [
  { label: 'Organized by me', value: 'organized' },
  { label: 'Participating', value: 'participating' },
];

const statusFilters: { label: string; value: TournamentStatus | undefined }[] = [
  { label: 'All statuses', value: undefined },
  { label: 'Open', value: 'published' },
  { label: 'In progress', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
];

const scopeFilters: { label: string; value: TournamentScope | undefined }[] = [
  { label: 'All scopes', value: undefined },
  { label: 'National', value: 'national' },
  { label: 'International', value: 'international' },
];

export function EventsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const bannedIds = useRejectedTournamentIds();
  const [segment, setSegment] = useState<Segment>('organized');
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [status, setStatus] = useState<TournamentStatus | undefined>();
  const [scope, setScope] = useState<TournamentScope | undefined>();
  const [draftStatus, setDraftStatus] = useState<TournamentStatus | undefined>();
  const [draftScope, setDraftScope] = useState<TournamentScope | undefined>();

  const { tournaments, isLoading, error, refresh } = useTournaments({
    mode: segment === 'participating' ? 'following' : 'list',
    followedByPlayerId: player?.id,
    search: search.trim() || undefined,
    status,
    scope,
    organizerId: segment === 'organized' ? user?.id : undefined,
  });

  // Refresh whenever this tab regains focus, so new tournaments or
  // registrations done elsewhere show up without a manual pull (RF-11).
  useRefreshOnFocus(() => void refresh());

  const activeFilterCount = [status, scope].filter(Boolean).length;

  function openFilters() {
    setDraftStatus(status);
    setDraftScope(scope);
    setFilterModalVisible(true);
  }

  function clearFilters() {
    setDraftStatus(undefined);
    setDraftScope(undefined);
    setStatus(undefined);
    setScope(undefined);
    setFilterModalVisible(false);
  }

  function applyFilters() {
    setStatus(draftStatus);
    setScope(draftScope);
    setFilterModalVisible(false);
  }

  const hasActiveQuery = Boolean(search.trim()) || activeFilterCount > 0;

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <View className="pb-4 pt-5">
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-2xl font-bold text-[#17231f]">Events</Text>
            <Text className="mt-1 text-sm text-[#65736c]">Revisit the tournaments you organize or follow.</Text>
          </View>
        </View>

        <View className="flex-row gap-2">
          {segments.map((item) => {
            const selected = item.value === segment;
            return (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                className={`min-h-10 flex-1 items-center justify-center rounded-lg border px-2 ${selected ? 'border-[#176b5b] bg-[#176b5b]' : 'border-[#dfe7e1] bg-white'}`}
                key={item.value}
                onPress={() => setSegment(item.value)}
              >
                <Text className={`text-sm font-bold ${selected ? 'text-white' : 'text-[#26352e]'}`}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <Input
              accessibilityLabel="Search tournaments"
              autoCapitalize="none"
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search by name, game or organizer"
              returnKeyType="search"
              search
              value={search}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter tournaments"
            className="h-12 w-12 items-center justify-center rounded-lg border border-[#ccd7cf] bg-white active:bg-[#e1eee8]"
            onPress={openFilters}
          >
            <Filter color="#176b5b" size={20} />
            {activeFilterCount > 0 ? (
              <View className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full bg-[#f2bd56]">
                <Text className="text-[10px] font-bold text-[#20281f]">{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
        {hasActiveQuery ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-2">
            <Text className="text-xs text-[#65736c]">Showing</Text>
            {status ? <Badge label={statusFilters.find((item) => item.value === status)?.label ?? ''} /> : null}
            {scope ? <Badge label={scopeFilters.find((item) => item.value === scope)?.label ?? ''} /> : null}
            {search.trim() ? <Badge label={`"${search.trim()}"`} tone="accent" /> : null}
          </View>
        ) : null}
      </View>

      {isLoading ? (
        <FeedbackState kind="loading" title="Loading tournaments" description="Fetching your tournaments." />
      ) : error ? (
        <FeedbackState actionLabel="Try again" description={error} kind="error" onAction={() => void refresh()} title="Could not load tournaments" />
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-6">
          {organizedSectionMeta.map((section) => (
            <Collection
              bannedIds={bannedIds}
              emptyLabel={hasActiveQuery ? `No ${section.title.toLowerCase()} tournaments match these criteria.` : section.emptyLabel}
              icon={section.icon}
              key={section.key}
              onPressTournament={(tournament) => navigation.navigate('TournamentDetail', { tournamentId: tournament.id })}
              title={section.title}
              tournaments={tournaments.filter((item) =>
                section.key === 'upcoming'
                  ? item.status === 'draft' || item.status === 'published'
                  : section.key === 'inProgress'
                    ? item.status === 'ongoing'
                    : item.status === 'completed' || item.status === 'cancelled',
              )}
            />
          ))}
        </ScrollView>
      )}

      <Modal
        footer={(
          <View className="flex-row gap-3">
            <View className="flex-1"><Button onPress={clearFilters} variant="quiet">Clear all</Button></View>
            <View className="flex-1"><Button onPress={applyFilters}>Show results</Button></View>
          </View>
        )}
        onClose={() => setFilterModalVisible(false)}
        title="Filter tournaments"
        visible={filterModalVisible}
      >
        <Text className="mb-3 text-sm font-semibold text-[#4d5d55]">Status</Text>
        <View className="mb-5 gap-2">
          {statusFilters.map((filter) => (
            <FilterOption
              key={filter.label}
              label={filter.label}
              selected={filter.value === draftStatus}
              onPress={() => setDraftStatus(filter.value)}
            />
          ))}
        </View>

        <Text className="mb-3 text-sm font-semibold text-[#4d5d55]">Scope</Text>
        <View className="mb-5 gap-2">
          {scopeFilters.map((filter) => (
            <FilterOption
              key={filter.label}
              label={filter.label}
              selected={filter.value === draftScope}
              onPress={() => setDraftScope(filter.value)}
            />
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Same section format as the Home collections: title row + horizontal cards. */
function Collection({
  title,
  icon,
  tournaments,
  emptyLabel,
  onPressTournament,
  bannedIds,
}: {
  title: string;
  icon: React.ReactNode;
  tournaments: TournamentSummary[];
  emptyLabel: string;
  onPressTournament: (tournament: TournamentSummary) => void;
  bannedIds?: Set<number>;
}) {
  return (
    <View className="mt-6 first:mt-0">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-lg font-bold text-[#17231f]">{title}</Text>
        {icon}
      </View>
      {tournaments.length === 0 ? (
        <View className="rounded-xl border border-[#dfe7e1] bg-white px-4 py-5">
          <Text className="text-sm leading-5 text-[#65736c]">{emptyLabel}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-5">
          {tournaments.map((tournament) => (
            <View className="w-72" key={tournament.id}>
              <TournamentCard
                banned={bannedIds?.has(tournament.id)}
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

function FilterOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      className={`min-h-11 justify-center rounded-lg border px-4 ${selected ? 'border-[#176b5b] bg-[#e1eee8]' : 'border-[#dfe7e1] bg-white'}`}
      onPress={onPress}
    >
      <Text className={`text-sm font-semibold ${selected ? 'text-[#176b5b]' : 'text-[#26352e]'}`}>{label}</Text>
    </Pressable>
  );
}
