import { Filter } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { TournamentStatus } from '../types/tournament';
import { TournamentList } from '../components/tournaments/TournamentList';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { useTournaments } from '../hooks/useTournaments';

const statusFilters: { label: string; value: TournamentStatus | undefined }[] = [
  { label: 'All tournaments', value: undefined },
  { label: 'Open', value: 'published' },
  { label: 'In progress', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Drafts', value: 'draft' },
];

export function TournamentsScreen() {
  const [search, setSearch] = useState('');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [status, setStatus] = useState<TournamentStatus | undefined>();
  const [draftStatus, setDraftStatus] = useState<TournamentStatus | undefined>();
  const { tournaments, isLoading, error, refresh } = useTournaments({
    search: search.trim() || undefined,
    status,
  });

  function openFilters() {
    setDraftStatus(status);
    setFilterModalVisible(true);
  }

  function clearFilters() {
    setDraftStatus(undefined);
    setStatus(undefined);
    setSearch('');
    setFilterModalVisible(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <View className="pb-4 pt-5">
        <View className="mb-4">
          <View>
            <Text accessibilityRole="header" className="text-2xl font-bold text-[#17231f]">Tournaments</Text>
            <Text className="mt-1 text-sm text-[#65736c]">Find a competition or revisit your tournaments.</Text>
          </View>
          <View className="mt-3">
            <Badge label="On device" tone="success" />
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1">
            <Input
              accessibilityLabel="Search tournaments"
              autoCapitalize="none"
              onChangeText={setSearch}
              onClear={() => setSearch('')}
              placeholder="Search tournaments"
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
          </Pressable>
        </View>
        <View className="mt-3 flex-row items-center gap-2">
          <Text className="text-xs text-[#65736c]">Showing</Text>
          <Badge label={statusFilters.find((filter) => filter.value === status)?.label ?? 'All tournaments'} />
          {search.trim() ? <Badge label={`“${search.trim()}”`} tone="accent" /> : null}
        </View>
      </View>
      <TournamentList
        emptyDescription={search || status ? 'No tournaments match these criteria. Clear your search or filters and try again.' : 'Public, followed and organized tournaments will be collected here.'}
        emptyTitle={search || status ? 'No matching tournaments' : 'Your tournament list is empty'}
        error={error}
        isLoading={isLoading}
        onRetry={() => void refresh()}
        tournaments={tournaments}
      />

      <Modal
        footer={(
          <View className="flex-row gap-3">
            <View className="flex-1"><Button onPress={clearFilters} variant="quiet">Clear all</Button></View>
            <View className="flex-1"><Button onPress={() => { setStatus(draftStatus); setFilterModalVisible(false); }}>Show results</Button></View>
          </View>
        )}
        onClose={() => setFilterModalVisible(false)}
        title="Filter tournaments"
        visible={filterModalVisible}
      >
        <Text className="mb-3 text-sm font-semibold text-[#4d5d55]">Tournament status</Text>
        <View className="gap-2">
          {statusFilters.map((filter) => {
            const selected = filter.value === draftStatus;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                className={`min-h-11 justify-center rounded-lg border px-4 ${selected ? 'border-[#176b5b] bg-[#e1eee8]' : 'border-[#dfe7e1] bg-white'}`}
                key={filter.label}
                onPress={() => setDraftStatus(filter.value)}
              >
                <Text className={`text-sm font-semibold ${selected ? 'text-[#176b5b]' : 'text-[#26352e]'}`}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>
    </SafeAreaView>
  );
}