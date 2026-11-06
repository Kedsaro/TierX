import {
  CalendarClock,
  CalendarPlus,
  ChevronLeft,
  Flag,
  Globe2,
  MapPin,
  Pencil,
  ShieldCheck,
  Swords,
  Trophy,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
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
import { eventRepository, registrationRepository, reportRepository, tournamentRepository, userRepository } from '../../database/repositories';
import { notifyTournamentFollowers, notifyUser } from '../../notifications/dispatch';
import { useCurrentPlayer } from '../../hooks/useCurrentPlayer';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import { availableActions, canManageTournament, nextStatusFor } from '../../tournaments/authorization';
import type { TournamentAction } from '../../tournaments/authorization';
import { evaluateRegistrationEligibility } from '../../tournaments/registrationEligibility';
import { minimumScheduleDateTime, parseLocalDateTime } from '../../tournaments/validation';
import type { TournamentEvent, TournamentEventStatus } from '../../types/event';
import { ACTIVE_REGISTRATION_STATUSES } from '../../types/registration';
import type { Registration, RegistrationStatus } from '../../types/registration';
import type { Tournament, TournamentDetails } from '../../types/tournament';

type TournamentDetailScreenProps = NativeStackScreenProps<TournamentDetailParams, 'TournamentDetail'>;

const statusLabels: Record<Tournament['status'], string> = {
  draft: 'Draft',
  published: 'Open',
  ongoing: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusTones = {
  draft: 'neutral',
  published: 'success',
  ongoing: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
} as const;

const scopeLabels: Record<Tournament['scope'], string> = {
  local: 'Local',
  regional: 'Regional',
  national: 'National',
  international: 'International',
};

function formatDateTime(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)} (${timezone})`;
}

const actionLabels: Record<TournamentAction, string> = {
  edit: 'Edit',
  publish: 'Publish',
  unpublish: 'Unpublish',
  cancel: 'Cancel tournament',
  close: 'Close tournament',
};

const actionConfirmations: Partial<Record<TournamentAction, string>> = {
  cancel: 'This will cancel the tournament for everyone. Are you sure?',
  close: 'This will mark the tournament as completed. Are you sure?',
};

const registrationStatusLabels: Record<RegistrationStatus, string> = {
  pending: 'Your registration is pending',
  registered: "You're registered for this tournament",
  waitlisted: "You're on the waitlist",
  cancelled: 'Your registration was cancelled',
  rejected: 'Your registration was rejected',
};

const eventStatusLabels: Record<TournamentEventStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Finished',
  cancelled: 'Cancelled',
};

const eventStatusTones: Record<TournamentEventStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  upcoming: 'neutral',
  active: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export function TournamentDetailScreen({ route, navigation }: TournamentDetailScreenProps) {
  const { tournamentId } = route.params;
  const onClose = () => navigation.goBack();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { player } = useCurrentPlayer();
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TournamentAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [isRegistrationLoading, setIsRegistrationLoading] = useState(true);
  const [isRegistrationModalVisible, setIsRegistrationModalVisible] = useState(false);
  const [isSubmittingRegistration, setIsSubmittingRegistration] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [isCreateEventModalVisible, setIsCreateEventModalVisible] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventStartsAt, setNewEventStartsAt] = useState('');
  const [newEventEndsAt, setNewEventEndsAt] = useState('');
  const [newEventStreamUrl, setNewEventStreamUrl] = useState('');
  const [createEventError, setCreateEventError] = useState<string | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const loadEvents = useCallback(() => {
    eventRepository.listByTournament(db, tournamentId).then(
      (rows) => setEvents(rows),
      () => setEvents([]),
    );
  }, [db, tournamentId]);

  useEffect(() => loadEvents(), [loadEvents]);

  const loadTournament = useCallback(() => {
    let isCurrent = true;
    tournamentRepository.getDetails(db, tournamentId).then(
      (result) => {
        if (!isCurrent) return;
        if (!result) {
          setError('This tournament is no longer available.');
        } else {
          setTournament(result);
        }
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (!isCurrent) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load this tournament.');
        setIsLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [db, tournamentId]);

  useEffect(() => loadTournament(), [loadTournament]);

  // RF-10: tracks the signed-in player's own registration (if any) for this
  // tournament, independently from the tournament details above, so it can
  // be refreshed on its own after registering or cancelling.
  const loadRegistration = useCallback(() => {
    let isCurrent = true;
    const fetchRegistration = player
      ? registrationRepository.getForPlayer(db, tournamentId, player.id)
      : Promise.resolve(null);
    fetchRegistration.then(
      (result) => {
        if (!isCurrent) return;
        setRegistration(result);
        setIsRegistrationLoading(false);
      },
      () => {
        if (!isCurrent) return;
        setRegistration(null);
        setIsRegistrationLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [db, tournamentId, player]);

  useEffect(() => loadRegistration(), [loadRegistration]);

  async function runAction(action: TournamentAction) {
    if (!tournament) return;
    const status = nextStatusFor(action);
    if (!status) return;

    const confirmationMessage = actionConfirmations[action];
    const proceed = confirmationMessage
      ? await new Promise<boolean>((resolve) => {
          Alert.alert(actionLabels[action], confirmationMessage, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: actionLabels[action], style: 'destructive', onPress: () => resolve(true) },
          ]);
        })
      : true;
    if (!proceed) return;

    setPendingAction(action);
    setActionError(null);
    try {
      await tournamentRepository.updateStatus(db, tournament.id, status);
      // RF-15: everyone following this tournament hears about status changes.
      await notifyTournamentFollowers(
        db,
        tournament,
        'tournament_update',
        `${tournament.name} is now ${statusLabels[status].toLowerCase()}`,
        `The organizer ${status === 'cancelled' ? 'cancelled' : status === 'completed' ? 'closed' : 'updated'} "${tournament.name}".`,
        user?.id,
      );
      loadTournament();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this tournament.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRegister() {
    if (!player) return;
    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      await registrationRepository.register(db, tournamentId, player.id);
      if (tournament) {
        await notifyUser(db, tournament.organizer_id, 'registration', 'New registration', `${player.display_name} registered for "${tournament.name}".`);
      }
      setIsRegistrationModalVisible(false);
      loadTournament();
      loadRegistration();
    } catch (cause) {
      setRegistrationError(cause instanceof Error ? cause.message : 'Could not complete your registration.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  }

  async function handleCancelRegistration() {
    if (!player) return;
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert('Cancel registration', 'You will lose your spot in this tournament. Are you sure?', [
        { text: 'Keep my spot', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Cancel registration', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!proceed) return;

    setIsSubmittingRegistration(true);
    setRegistrationError(null);
    try {
      await registrationRepository.cancel(db, tournamentId, player.id);
      if (tournament) {
        await notifyUser(db, tournament.organizer_id, 'registration', 'Registration cancelled', `${player.display_name} cancelled their registration for "${tournament.name}".`);
      }
      loadTournament();
      loadRegistration();
    } catch (cause) {
      setRegistrationError(cause instanceof Error ? cause.message : 'Could not cancel your registration.');
    } finally {
      setIsSubmittingRegistration(false);
    }
  }

  function openCreateEventModal() {
    setNewEventName('');
    setNewEventStartsAt('');
    setNewEventEndsAt('');
    setNewEventStreamUrl('');
    setCreateEventError(null);
    setIsCreateEventModalVisible(true);
  }

  async function handleCreateEvent() {
    if (!newEventName.trim()) {
      setCreateEventError('Enter a name for this event.');
      return;
    }
    const startsAtIso = parseLocalDateTime(newEventStartsAt);
    if (!startsAtIso) {
      setCreateEventError('Select a valid start date and time.');
      return;
    }
    const endsAtIso = newEventEndsAt.trim() ? parseLocalDateTime(newEventEndsAt) : null;
    if (newEventEndsAt.trim() && !endsAtIso) {
      setCreateEventError('Select a valid end date and time.');
      return;
    }
    if (endsAtIso && endsAtIso < startsAtIso) {
      setCreateEventError('The end date must be on or after the start date.');
      return;
    }

    setIsCreatingEvent(true);
    setCreateEventError(null);
    try {
      await eventRepository.create(db, {
        tournament_id: tournamentId,
        name: newEventName.trim(),
        starts_at: startsAtIso,
        ends_at: endsAtIso,
        stream_url: newEventStreamUrl.trim() || null,
      });
      setIsCreateEventModalVisible(false);
      loadEvents();
    } catch (cause) {
      setCreateEventError(cause instanceof Error ? cause.message : 'Could not schedule this event.');
    } finally {
      setIsCreatingEvent(false);
    }
  }

  async function handleSubmitReport() {
    if (!user || !tournament) return;
    if (!reportReason.trim()) {
      setReportError('Describe the reason for your report.');
      return;
    }
    setIsSubmittingReport(true);
    setReportError(null);
    try {
      await reportRepository.create(db, {
        reporter_id: user.id,
        tournament_id: tournament.id,
        reason: reportReason.trim(),
      });
      // RF-15/RF-17: administrators are informed about new reports.
      for (const admin of await userRepository.listByRole(db, 'admin')) {
        await notifyUser(db, admin.id, 'admin', 'New report filed', `${user.username} reported "${tournament.name}": ${reportReason.trim()}`);
      }
      setIsReportModalVisible(false);
      setReportReason('');
      Alert.alert('Report sent', 'Our administrators will review your report.');
    } catch (cause) {
      setReportError(cause instanceof Error ? cause.message : 'Could not send your report.');
    } finally {
      setIsSubmittingReport(false);
    }
  }

  const isOrganizer = tournament ? canManageTournament(tournament, user?.id, user?.role) : false;
  const hasActiveRegistration = registration !== null && ACTIVE_REGISTRATION_STATUSES.includes(registration.status);
  const eligibility = tournament
    ? evaluateRegistrationEligibility(tournament, tournament.participant_count, user?.id)
    : { canRegister: false };
  const minScheduleDate = minimumScheduleDateTime();

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 px-3 pt-2">
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          className="h-11 w-11 items-center justify-center rounded-lg active:bg-[#e1eee8]"
          onPress={onClose}
        >
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Text accessibilityRole="header" className="text-base font-bold text-[#17231f]">
          Tournament details
        </Text>
        {tournament && !isOrganizer ? (
          <Pressable
            accessibilityLabel="Report tournament"
            accessibilityRole="button"
            className="ml-auto h-11 w-11 items-center justify-center rounded-lg active:bg-[#f9e4e2]"
            onPress={() => {
              setReportReason('');
              setReportError(null);
              setIsReportModalVisible(true);
            }}
          >
            <Flag color="#a93232" size={20} />
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <FeedbackState kind="loading" title="Loading tournament" description="Fetching the latest details." />
      ) : error || !tournament ? (
        <FeedbackState
          actionLabel="Go back"
          description={error ?? 'This tournament is no longer available.'}
          kind="error"
          onAction={onClose}
          title="Could not load tournament"
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-2">
          <View className="h-28 w-28 items-center justify-center self-start rounded-2xl bg-[#173d35]">
            <Trophy color="#f2bd56" size={40} />
          </View>
          <Text className="mt-4 text-2xl font-bold text-[#17231f]">{tournament.name}</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Badge label={statusLabels[tournament.status]} tone={statusTones[tournament.status]} />
            <Badge label={scopeLabels[tournament.scope]} tone="accent" />
            <Badge label={tournament.visibility === 'public' ? 'Public' : tournament.visibility === 'private' ? 'Private' : 'Unlisted'} />
          </View>

          {tournament.description ? (
            <Text className="mt-4 text-sm leading-5 text-[#4d5d55]">{tournament.description}</Text>
          ) : null}

          <Card className="mt-5 gap-4 p-4">
            <DetailRow icon={<Users color="#176b5b" size={18} />} label="Organizer" value={tournament.organizer_username} />
            <DetailRow icon={<Trophy color="#176b5b" size={18} />} label="Game" value={tournament.game_name} />
            <DetailRow icon={<MapPin color="#176b5b" size={18} />} label="Country" value={tournament.country_name} />
            <DetailRow
              icon={<Users color="#176b5b" size={18} />}
              label="Participants"
              value={`${tournament.participant_count} / ${tournament.capacity}`}
            />
            <DetailRow icon={<ShieldCheck color="#176b5b" size={18} />} label="Format" value={tournament.format} />
          </Card>

          <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[#65736c]">Calendar</Text>
          <Card className="gap-4 p-4">
            <DetailRow
              icon={<CalendarClock color="#176b5b" size={18} />}
              label="Starts"
              value={formatDateTime(tournament.start_at, tournament.timezone) ?? 'Not set'}
            />
            {tournament.end_at ? (
              <DetailRow
                icon={<CalendarClock color="#176b5b" size={18} />}
                label="Ends"
                value={formatDateTime(tournament.end_at, tournament.timezone) ?? 'Not set'}
              />
            ) : null}
            {tournament.registration_opens_at ? (
              <DetailRow
                icon={<Globe2 color="#176b5b" size={18} />}
                label="Registration opens"
                value={formatDateTime(tournament.registration_opens_at, tournament.timezone) ?? 'Not set'}
              />
            ) : null}
            {tournament.registration_closes_at ? (
              <DetailRow
                icon={<Globe2 color="#176b5b" size={18} />}
                label="Registration closes"
                value={formatDateTime(tournament.registration_closes_at, tournament.timezone) ?? 'Not set'}
              />
            ) : null}
          </Card>

          <View className="mb-2 mt-5 flex-row items-center justify-between">
            <Text className="text-sm font-bold uppercase tracking-wide text-[#65736c]">Events</Text>
            {isOrganizer ? (
              <Pressable accessibilityLabel="Schedule event" accessibilityRole="button" hitSlop={8} onPress={openCreateEventModal}>
                <CalendarPlus color="#176b5b" size={20} />
              </Pressable>
            ) : null}
          </View>
          {events.length === 0 ? (
            <Card className="p-4">
              <Text className="text-sm text-[#65736c]">
                {isOrganizer ? 'Schedule an event to let participants know when to tune in or show up.' : 'No events have been scheduled for this tournament yet.'}
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {events.map((item) => (
                <Card
                  className="flex-row items-center justify-between gap-2 p-4"
                  key={item.id}
                  onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm font-bold text-[#17231f]" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-xs text-[#65736c]">{formatDateTime(item.starts_at, tournament.timezone)}</Text>
                  </View>
                  <Badge label={eventStatusLabels[item.status]} tone={eventStatusTones[item.status]} />
                </Card>
              ))}
            </View>
          )}

          {tournament.requirements ? (
            <TextSection title="Requirements" content={tournament.requirements} />
          ) : null}
          {tournament.rules ? <TextSection title="Rules" content={tournament.rules} /> : null}
          {tournament.prizes ? <TextSection title="Prizes" content={tournament.prizes} /> : null}

          {isOrganizer ? (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-[#65736c]">Manage</Text>
              {actionError ? (
                <View accessibilityRole="alert" className="mb-3 rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
                  <Text className="text-sm leading-5 text-[#872822]">{actionError}</Text>
                </View>
              ) : null}
              <View className="gap-3">
                {availableActions(tournament.status).includes('edit') ? (
                  <Button
                    icon={<Pencil color="#176b5b" size={16} />}
                    onPress={() => navigation.navigate('TournamentForm', { tournamentId: tournament.id })}
                    variant="secondary"
                  >
                    Edit
                  </Button>
                ) : null}
                {availableActions(tournament.status)
                  .filter((action) => action !== 'edit')
                  .map((action) => (
                    <Button
                      key={action}
                      loading={pendingAction === action}
                      onPress={() => void runAction(action)}
                      variant={action === 'cancel' ? 'danger' : action === 'publish' ? 'primary' : 'secondary'}
                    >
                      {actionLabels[action]}
                    </Button>
                  ))}
                <Button
                  icon={<Swords color="#176b5b" size={16} />}
                  onPress={() => navigation.navigate('Bracket', { tournamentId: tournament.id })}
                  variant="secondary"
                >
                  {tournament.status === 'completed' ? 'Bracket results' : 'Manage bracket'}
                </Button>
              </View>
            </View>
          ) : null}

          {tournament.status === 'completed' && !isOrganizer ? (
            <View className="mt-5 gap-3">
              <Text className="text-sm font-bold uppercase tracking-wide text-[#65736c]">Results</Text>
              <Button
                icon={<Swords color="#176b5b" size={16} />}
                onPress={() => navigation.navigate('Bracket', { tournamentId: tournament.id })}
                variant="secondary"
              >
                Bracket results
              </Button>
            </View>
          ) : null}

          {!isOrganizer && !isRegistrationLoading ? (
            <View className="mt-5">
              <Text className="mb-2 text-sm font-bold uppercase tracking-wide text-[#65736c]">Participation</Text>
              {registrationError ? (
                <View accessibilityRole="alert" className="mb-3 rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
                  <Text className="text-sm leading-5 text-[#872822]">{registrationError}</Text>
                </View>
              ) : null}
              {hasActiveRegistration && registration ? (
                <View className="gap-3">
                  <Badge
                    label={registrationStatusLabels[registration.status]}
                    tone={registration.status === 'waitlisted' ? 'warning' : 'success'}
                  />
                  <Button
                    icon={<UserMinus color="#ffffff" size={16} />}
                    loading={isSubmittingRegistration}
                    onPress={() => void handleCancelRegistration()}
                    variant="danger"
                  >
                    Cancel registration
                  </Button>
                </View>
              ) : (
                <View className="gap-2">
                  <Button
                    disabled={!eligibility.canRegister}
                    icon={<UserPlus color="#ffffff" size={16} />}
                    loading={isSubmittingRegistration}
                    onPress={() => setIsRegistrationModalVisible(true)}
                  >
                    Register
                  </Button>
                  {!eligibility.canRegister && eligibility.reason ? (
                    <Text className="text-xs text-[#65736c]">{eligibility.reason}</Text>
                  ) : null}
                </View>
              )}
            </View>
          ) : null}
        </ScrollView>
      )}

      {tournament ? (
        <Modal
          footer={(
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button onPress={() => setIsRegistrationModalVisible(false)} variant="quiet">
                  Cancel
                </Button>
              </View>
              <View className="flex-1">
                <Button loading={isSubmittingRegistration} onPress={() => void handleRegister()}>
                  Confirm
                </Button>
              </View>
            </View>
          )}
          onClose={() => setIsRegistrationModalVisible(false)}
          title="Confirm registration"
          visible={isRegistrationModalVisible}
        >
          <View className="gap-3">
            <Text className="text-sm leading-5 text-[#4d5d55]">
              You are about to register for <Text className="font-bold text-[#17231f]">{tournament.name}</Text>.
            </Text>
            <Text className="text-sm text-[#4d5d55]">
              {tournament.participant_count} / {tournament.capacity} spots taken.
            </Text>
            {tournament.requirements ? (
              <View className="rounded-lg border border-[#dfe7e1] bg-white p-3">
                <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-[#65736c]">Requirements</Text>
                <Text className="text-sm leading-5 text-[#4d5d55]">{tournament.requirements}</Text>
              </View>
            ) : null}
            <Text className="text-xs text-[#65736c]">By confirming, you declare that you meet the requirements above.</Text>
          </View>
        </Modal>
      ) : null}

      <Modal
        footer={(
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button onPress={() => setIsCreateEventModalVisible(false)} variant="quiet">Cancel</Button>
            </View>
            <View className="flex-1">
              <Button loading={isCreatingEvent} onPress={() => void handleCreateEvent()}>Schedule</Button>
            </View>
          </View>
        )}
        onClose={() => setIsCreateEventModalVisible(false)}
        title="Schedule event"
        visible={isCreateEventModalVisible}
      >
        <View className="gap-4">
          <Input label="Name" onChangeText={setNewEventName} placeholder="e.g. Grand Finals Broadcast" value={newEventName} />
          <DateTimeField
            label="Starts"
            minimumDate={minScheduleDate}
            onChange={setNewEventStartsAt}
            value={newEventStartsAt}
          />
          <DateTimeField
            hint="Optional."
            label="Ends"
            minimumDate={minScheduleDate}
            onChange={setNewEventEndsAt}
            value={newEventEndsAt}
          />
          <Input
            autoCapitalize="none"
            label="Channel / link (optional)"
            onChangeText={setNewEventStreamUrl}
            placeholder="https://..."
            value={newEventStreamUrl}
          />
          {createEventError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{createEventError}</Text> : null}
        </View>
      </Modal>

      <Modal
        footer={(
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button onPress={() => setIsReportModalVisible(false)} variant="quiet">Cancel</Button>
            </View>
            <View className="flex-1">
              <Button loading={isSubmittingReport} onPress={() => void handleSubmitReport()} variant="danger">Send report</Button>
            </View>
          </View>
        )}
        onClose={() => setIsReportModalVisible(false)}
        title="Report tournament"
        visible={isReportModalVisible}
      >
        <View className="gap-3">
          <Text className="text-sm leading-5 text-[#4d5d55]">
            Tell the administrators what is wrong with <Text className="font-bold text-[#17231f]">{tournament?.name}</Text>.
          </Text>
          <Input label="Reason" multiline onChangeText={setReportReason} placeholder="e.g. Suspicious organizer, wrong rules" value={reportReason} />
          {reportError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{reportError}</Text> : null}
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

function TextSection({ title, content }: { title: string; content: string }) {
  return (
    <>
      <Text className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-[#65736c]">{title}</Text>
      <Card className="p-4">
        <Text className="text-sm leading-5 text-[#4d5d55]">{content}</Text>
      </Card>
    </>
  );
}
