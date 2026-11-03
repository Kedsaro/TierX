import {
  CalendarClock,
  ChevronLeft,
  ExternalLink,
  Pencil,
  Swords,
  Trophy,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../../auth/AuthProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DateTimeField } from '../../components/ui/DateTimeField';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { eventRepository, matchRepository } from '../../database/repositories';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import { canManageTournament } from '../../tournaments/authorization';
import { nextEventStatuses } from '../../tournaments/eventTransitions';
import { minimumScheduleDateTime, parseLocalDateTime, parseScheduleDate } from '../../tournaments/validation';
import type { EventSummary, TournamentEventStatus } from '../../types/event';
import type { MatchDetails } from '../../types/match';

type Props = NativeStackScreenProps<TournamentDetailParams, 'EventDetail'>;

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

const matchStatusLabels: Record<MatchDetails['status'], string> = {
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  disputed: 'Disputed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatDateTime(value: string | null): string {
  if (!value) return 'Not set';
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

function toEditableDateTime(isoValue: string): string {
  return isoValue.slice(0, 16).replace('T', ' ');
}

export function EventDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [matches, setMatches] = useState<MatchDetails[]>([]);
  const [finalMatch, setFinalMatch] = useState<MatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<TournamentEventStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editStartsAt, setEditStartsAt] = useState('');
  const [editEndsAt, setEditEndsAt] = useState('');
  const [editStreamUrl, setEditStreamUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const loadEvent = useCallback(() => {
    let isCurrent = true;
    eventRepository.getDetails(db, eventId).then(
      async (result) => {
        if (!isCurrent) return;
        if (!result) {
          setError('This event is no longer available.');
          setIsLoading(false);
          return;
        }
        setEvent(result);
        if (result.status === 'active') {
          const upcomingMatches = await matchRepository.listForTournament(db, result.tournament_id, ['scheduled', 'ongoing']);
          if (isCurrent) setMatches(upcomingMatches.slice(0, 5));
        } else if (result.status === 'completed') {
          const final = await matchRepository.getFinalForTournament(db, result.tournament_id);
          if (isCurrent) setFinalMatch(final);
        }
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (!isCurrent) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load this event.');
        setIsLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [db, eventId]);

  useEffect(() => loadEvent(), [loadEvent]);

  async function runStatusChange(status: TournamentEventStatus) {
    if (!event) return;
    setPendingStatus(status);
    setActionError(null);
    try {
      await eventRepository.updateStatus(db, event.id, status);
      loadEvent();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this event.');
    } finally {
      setPendingStatus(null);
    }
  }

  function openEditModal() {
    if (!event) return;
    setEditName(event.name);
    setEditStartsAt(toEditableDateTime(event.starts_at));
    setEditEndsAt(event.ends_at ? toEditableDateTime(event.ends_at) : '');
    setEditStreamUrl(event.stream_url ?? '');
    setEditError(null);
    setIsEditModalVisible(true);
  }

  async function handleSaveEdit() {
    if (!event) return;
    if (!editName.trim()) {
      setEditError('Enter a name for this event.');
      return;
    }
    const startsAtIso = parseLocalDateTime(editStartsAt);
    if (!startsAtIso) {
      setEditError('Select a valid start date and time.');
      return;
    }
    const endsAtIso = editEndsAt.trim() ? parseLocalDateTime(editEndsAt) : null;
    if (editEndsAt.trim() && !endsAtIso) {
      setEditError('Select a valid end date and time.');
      return;
    }
    if (endsAtIso && endsAtIso < startsAtIso) {
      setEditError('The end date must be on or after the start date.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    try {
      await eventRepository.update(db, event.id, {
        name: editName.trim(),
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        stream_url: editStreamUrl.trim() || null,
      });
      setIsEditModalVisible(false);
      loadEvent();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Could not save this event.');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function confirmCancelEvent() {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert('Cancel event', 'This will cancel the event for everyone. Are you sure?', [
        { text: 'Keep event', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cancel event', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (proceed) void runStatusChange('cancelled');
  }

  const isOrganizer = event ? canManageTournament({ organizer_id: event.organizer_id }, user?.id) : false;
  const minScheduleDate = minimumScheduleDateTime();
  const editEndMinimumDate = (() => {
    const startDate = parseScheduleDate(editStartsAt);
    return startDate && startDate > minScheduleDate ? startDate : minScheduleDate;
  })();

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 px-3 pt-2">
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-lg active:bg-[#e1eee8]"
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Text accessibilityRole="header" className="text-base font-bold text-[#17231f]">Event details</Text>
      </View>

      {isLoading ? (
        <FeedbackState kind="loading" title="Loading event" description="Fetching the latest details." />
      ) : error || !event ? (
        <FeedbackState
          actionLabel="Go back"
          description={error ?? 'This event is no longer available.'}
          kind="error"
          onAction={() => navigation.goBack()}
          title="Could not load event"
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-2">
          <Text className="text-2xl font-bold text-[#17231f]">{event.name}</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Badge label={statusLabels[event.status]} tone={statusTones[event.status]} />
          </View>

          <Pressable
            accessibilityRole="button"
            className="mt-4"
            onPress={() => navigation.navigate('TournamentDetail', { tournamentId: event.tournament_id })}
          >
            <Card className="gap-1 p-4">
              <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">Related tournament</Text>
              <Text className="text-base font-bold text-[#17231f]">{event.tournament_name}</Text>
              <Text className="text-xs text-[#65736c]">{event.game_name} · Organized by {event.organizer_username}</Text>
            </Card>
          </Pressable>

          <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[#65736c]">Calendar</Text>
          <Card className="gap-4 p-4">
            <DetailRow icon={<CalendarClock color="#176b5b" size={18} />} label="Starts" value={formatDateTime(event.starts_at)} />
            <DetailRow icon={<CalendarClock color="#176b5b" size={18} />} label="Ends" value={formatDateTime(event.ends_at)} />
          </Card>

          {event.status === 'active' ? (
            <>
              {event.stream_url ? (
                <Pressable
                  accessibilityRole="link"
                  className="mt-5"
                  onPress={() => void Linking.openURL(event.stream_url!)}
                >
                  <Card className="flex-row items-center gap-3 p-4">
                    <ExternalLink color="#176b5b" size={18} />
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-bold text-[#176b5b]">Watch channel / link</Text>
                      <Text className="text-xs text-[#65736c]" numberOfLines={1}>{event.stream_url}</Text>
                    </View>
                  </Card>
                </Pressable>
              ) : null}

              <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[#65736c]">Current matches</Text>
              {matches.length === 0 ? (
                <Card className="p-4">
                  <Text className="text-sm text-[#65736c]">No matches have been scheduled yet for this tournament.</Text>
                </Card>
              ) : (
                <View className="gap-3">
                  {matches.map((match) => (
                    <Card className="gap-2 p-4" key={match.id}>
                      <View className="flex-row items-center justify-between">
                        <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">Round {match.round_number} · Match {match.match_number}</Text>
                        <Badge label={matchStatusLabels[match.status]} tone={match.status === 'ongoing' ? 'warning' : 'neutral'} />
                      </View>
                      <Text className="text-sm font-bold text-[#17231f]">
                        {match.player_one_name ?? 'TBD'} <Text className="text-[#65736c]">vs</Text> {match.player_two_name ?? 'TBD'}
                      </Text>
                      <Text className="text-xs text-[#65736c]">{formatDateTime(match.scheduled_at)}</Text>
                    </Card>
                  ))}
                </View>
              )}
            </>
          ) : null}

          {event.status === 'completed' ? (
            <>
              <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[#65736c]">Result</Text>
              <Card className="gap-3 p-4">
                {finalMatch?.winner_name ? (
                  <DetailRow icon={<Trophy color="#176b5b" size={18} />} label="Winner" value={finalMatch.winner_name} />
                ) : (
                  <Text className="text-sm text-[#65736c]">No final result has been published yet.</Text>
                )}
                <DetailRow icon={<CalendarClock color="#176b5b" size={18} />} label="Finished" value={formatDateTime(event.ends_at ?? event.starts_at)} />
                <DetailRow icon={<Swords color="#176b5b" size={18} />} label="Game" value={event.game_name} />
              </Card>
            </>
          ) : null}

          {isOrganizer ? (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-[#65736c]">Manage</Text>
              {actionError ? (
                <View accessibilityRole="alert" className="mb-3 rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
                  <Text className="text-sm leading-5 text-[#872822]">{actionError}</Text>
                </View>
              ) : null}
              <View className="gap-3">
                <Button
                  icon={<Pencil color="#176b5b" size={16} />}
                  onPress={openEditModal}
                  variant="secondary"
                >
                  Edit event
                </Button>
                <Button
                  onPress={() => navigation.navigate('Bracket', { tournamentId: event.tournament_id })}
                  variant="secondary"
                >
                  Manage bracket
                </Button>
                {nextEventStatuses[event.status].includes('active') ? (
                  <Button loading={pendingStatus === 'active'} onPress={() => void runStatusChange('active')}>
                    Mark as active
                  </Button>
                ) : null}
                {nextEventStatuses[event.status].includes('completed') ? (
                  <Button loading={pendingStatus === 'completed'} onPress={() => void runStatusChange('completed')}>
                    Mark as finished
                  </Button>
                ) : null}
                {nextEventStatuses[event.status].includes('cancelled') ? (
                  <Button loading={pendingStatus === 'cancelled'} onPress={() => void confirmCancelEvent()} variant="danger">
                    Cancel event
                  </Button>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        footer={(
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button onPress={() => setIsEditModalVisible(false)} variant="quiet">Cancel</Button>
            </View>
            <View className="flex-1">
              <Button loading={isSavingEdit} onPress={() => void handleSaveEdit()}>Save</Button>
            </View>
          </View>
        )}
        onClose={() => setIsEditModalVisible(false)}
        title="Edit event"
        visible={isEditModalVisible}
      >
        <View className="gap-4">
          <Input label="Name" onChangeText={setEditName} placeholder="e.g. Grand Finals Broadcast" value={editName} />
          <DateTimeField
            label="Starts"
            minimumDate={minScheduleDate}
            onChange={setEditStartsAt}
            value={editStartsAt}
          />
          <DateTimeField
            hint="Optional."
            label="Ends"
            minimumDate={editEndMinimumDate}
            onChange={setEditEndsAt}
            value={editEndsAt}
          />
          <Input
            autoCapitalize="none"
            label="Channel / link (optional)"
            onChangeText={setEditStreamUrl}
            placeholder="https://..."
            value={editStreamUrl}
          />
          {editError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{editError}</Text> : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      {icon}
      <View className="min-w-0 flex-1">
        <Text className="text-xs text-[#65736c]">{label}</Text>
        <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}
