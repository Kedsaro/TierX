import { Filter, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TournamentScope, TournamentStatus } from '../types/tournament';
import { TournamentList } from '../components/tournaments/TournamentList';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../auth/AuthProvider';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { useTournaments } from '../hooks/useTournaments';
import type { TournamentsStackParamList } from '../navigation/tournaments/types';

type Props = NativeStackScreenProps<TournamentsStackParamList, 'TournamentsMain'>;

type Segment = 'public' | 'mine' | 'following';

const segments: { label: string; value: Segment }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Mine', value: 'mine' },
  { label: 'Following', value: 'following' },
];

const statusFilters: { label: string; value: TournamentStatus | undefined }[] = [
  { label: 'All statuses', value: undefined },
  { label: 'Open', value: 'published' },
  { label: 'In progress', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Drafts', value: 'draft' },
];

const scopeFilters: { label: string; value: TournamentScope | undefined }[] = [
  { label: 'All scopes', value: undefined },
  { label: 'Local', value: 'local' },
  { label: 'Regional', value: 'regional' },
  { label: 'National', value: 'national' },
  { label: 'International', value: 'international' },
];

type DateFilter = 'all' | 'upcoming' | 'past';

const dateFilters: { label: string; value: DateFilter }[] = [
  { label: 'Any date', value: 'all' },
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Past', value: 'past' },
];

export function TournamentsScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const [segment, setSegment] = useState<Segment>('public');
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [status, setStatus] = useState<TournamentStatus | undefined>();
  const [scope, setScope] = useState<TournamentScope | undefined>();
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [draftStatus, setDraftStatus] = useState<TournamentStatus | undefined>();
  const [draftScope, setDraftScope] = useState<TournamentScope | undefined>();
  const [draftDateFilter, setDraftDateFilter] = useState<DateFilter>('all');

  const now = new Date().toISOString();
  const { tournaments, isLoading, error, refresh } = useTournaments({
    mode: segment === 'following' ? 'following' : 'list',
    followedByPlayerId: player?.id,
    search: search.trim() || undefined,
    status,
    scope,
    organizerId: segment === 'mine' ? user?.id : undefined,
    visibility: segment === 'public' ? 'public' : undefined,
    excludeDraft: segment === 'public',
    startsAfter: dateFilter === 'upcoming' ? now : undefined,
    startsBefore: dateFilter === 'past' ? now : undefined,
  });

  // Refresh whenever this tab regains focus, so tournaments created or
  // joined elsewhere (e.g. via the dev seed tool, or after registering)
  // show up without requiring a manual pull-to-refresh.
  useRefreshOnFocus(() => void refresh());

  const activeFilterCount = [status, scope, dateFilter !== 'all' ? dateFilter : undefined].filter(Boolean).length;

  function openFilters() {
    setDraftStatus(status);
    setDraftScope(scope);
    setDraftDateFilter(dateFilter);
    setFilterModalVisible(true);
  }

  function clearFilters() {
    setDraftStatus(undefined);
    setDraftScope(undefined);
    setDraftDateFilter('all');
    setStatus(undefined);
    setScope(undefined);
    setDateFilter('all');
    setFilterModalVisible(false);
  }

  function applyFilters() {
    setStatus(draftStatus);
    setScope(draftScope);
    setDateFilter(draftDateFilter);
    setFilterModalVisible(false);
  }

  const hasActiveQuery = Boolean(search.trim()) || activeFilterCount > 0;
  const emptyCopyBySegment: Record<Segment, { title: string; description: string }> = {
    public: { title: 'Your tournament list is empty', description: 'Public, followed and organized tournaments will be collected here.' },
    mine: { title: "You haven't organized any tournaments", description: 'Tournaments you create will appear here.' },
    following: { title: "You're not following any tournaments", description: 'Register for a tournament to see it here.' },
  };

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <View className="pb-4 pt-5">
        <View className="mb-4 flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-2xl font-bold text-[#17231f]">Tournaments</Text>
            <Text className="mt-1 text-sm text-[#65736c]">Find a competition or revisit your tournaments.</Text>
            <View className="mt-3">
              <Badge label="On device" tone="success" />
            </View>
          </View>
          <Pressable
            accessibilityLabel="Create tournament"
            accessibilityRole="button"
            className="h-11 w-11 items-center justify-center rounded-lg bg-[#176b5b] active:opacity-80"
            onPress={() => navigation.navigate('TournamentForm', undefined)}
          >
            <Plus color="#ffffff" size={20} />
          </Pressable>
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
            {dateFilter !== 'all' ? <Badge label={dateFilters.find((item) => item.value === dateFilter)?.label ?? ''} /> : null}
            {search.trim() ? <Badge label={`"${search.trim()}"`} tone="accent" /> : null}
          </View>
        ) : null}
      </View>

      <TournamentList
        emptyDescription={hasActiveQuery ? 'No tournaments match these criteria. Clear your search or filters and try again.' : emptyCopyBySegment[segment].description}
        emptyTitle={hasActiveQuery ? 'No matching tournaments' : emptyCopyBySegment[segment].title}
        error={error}
        isLoading={isLoading}
        onRetry={() => void refresh()}
        onTournamentPress={(tournament) => navigation.navigate('TournamentDetail', { tournamentId: tournament.id })}
        tournaments={tournaments}
      />

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

        <Text className="mb-3 text-sm font-semibold text-[#4d5d55]">Date</Text>
        <View className="gap-2">
          {dateFilters.map((filter) => (
            <FilterOption
              key={filter.label}
              label={filter.label}
              selected={filter.value === draftDateFilter}
              onPress={() => setDraftDateFilter(filter.value)}
            />
          ))}
        </View>
      </Modal>
    </SafeAreaView>
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
