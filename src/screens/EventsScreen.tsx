import { CalendarDays } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../auth/AuthProvider';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { FeedbackState } from '../components/ui/FeedbackState';
import { eventRepository } from '../database/repositories';
import { useCurrentPlayer } from '../hooks/useCurrentPlayer';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import type { EventsStackParamList } from '../navigation/events/types';
import type { EventSummary, TournamentEventStatus } from '../types/event';

type Props = NativeStackScreenProps<EventsStackParamList, 'EventsMain'>;

type Segment = 'upcoming' | 'active' | 'finished';

const segments: { label: string; value: Segment }[] = [
  { label: 'Upcoming', value: 'upcoming' },
  { label: 'Active', value: 'active' },
  { label: 'Finished', value: 'finished' },
];

/** The "Finished" tab also surfaces cancelled events instead of hiding them entirely. */
const segmentStatuses: Record<Segment, TournamentEventStatus[]> = {
  upcoming: ['upcoming'],
  active: ['active'],
  finished: ['completed', 'cancelled'],
};

const statusLabels: Record<TournamentEventStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Finished',
  cancelled: 'Cancelled',
};

const statusTones: Record<TournamentEventStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  upcoming: 'neutral',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

function formatSchedule(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const emptyCopyBySegment: Record<Segment, { title: string; description: string }> = {
  upcoming: { title: 'No upcoming events', description: 'Events scheduled for tournaments you organize or follow will appear here.' },
  active: { title: 'No active events', description: 'Events currently underway will appear here.' },
  finished: { title: 'No finished events', description: 'Completed or cancelled events will appear here.' },
};

export function EventsScreen({ navigation }: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const [segment, setSegment] = useState<Segment>('upcoming');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    eventRepository
      .listForUser(db, { userId: user.id, playerId: player?.id ?? null, status: segmentStatuses[segment] })
      .then(
        (rows) => {
          setEvents(rows);
          setError(null);
          setIsLoading(false);
        },
        (cause: unknown) => {
          setError(cause instanceof Error ? cause.message : 'Unable to load events.');
          setIsLoading(false);
        },
      );
  }, [db, user, player, segment]);

  useEffect(() => refresh(), [refresh]);
  // Refresh whenever this tab regains focus, so results published or events
  // scheduled elsewhere (e.g. from a tournament's organizer panel) show up
  // without a manual pull-to-refresh (RF-11).
  useRefreshOnFocus(refresh);

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <Text accessibilityRole="header" className="py-5 text-2xl font-bold text-[#17231f]">Events</Text>

      <View className="mb-4 flex-row gap-2">
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

      {isLoading ? (
        <FeedbackState kind="loading" title="Loading events" description="Fetching your schedule." />
      ) : error ? (
        <FeedbackState actionLabel="Try again" description={error} kind="error" onAction={refresh} title="Could not load events" />
      ) : events.length === 0 ? (
        <FeedbackState
          description={emptyCopyBySegment[segment].description}
          kind="empty"
          title={emptyCopyBySegment[segment].title}
        />
      ) : (
        <FlatList
          className="flex-1"
          contentContainerClassName="gap-3 pb-6"
          data={events}
          keyExtractor={(event) => String(event.id)}
          renderItem={({ item }) => (
            <Card className="gap-2 p-4" onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}>
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 text-base font-bold text-[#17231f]" numberOfLines={1}>{item.name}</Text>
                <Badge label={statusLabels[item.status]} tone={statusTones[item.status]} />
              </View>
              <Text className="text-xs text-[#65736c]" numberOfLines={1}>{item.tournament_name} · {item.game_name}</Text>
              <View className="flex-row items-center gap-1">
                <CalendarDays color="#718079" size={14} />
                <Text className="text-xs text-[#65736c]">{formatSchedule(item.starts_at)}</Text>
              </View>
            </Card>
          )}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}
