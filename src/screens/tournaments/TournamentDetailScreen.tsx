import {
  CalendarClock,
  ChevronLeft,
  Globe2,
  MapPin,
  Pencil,
  ShieldCheck,
  Trophy,
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
import { FeedbackState } from '../../components/ui/FeedbackState';
import { tournamentRepository } from '../../database/repositories';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import { availableActions, canManageTournament, nextStatusFor } from '../../tournaments/authorization';
import type { TournamentAction } from '../../tournaments/authorization';
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

export function TournamentDetailScreen({ route, navigation }: TournamentDetailScreenProps) {
  const { tournamentId } = route.params;
  const onClose = () => navigation.goBack();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const [tournament, setTournament] = useState<TournamentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<TournamentAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
      loadTournament();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update this tournament.');
    } finally {
      setPendingAction(null);
    }
  }

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

          {tournament.requirements ? (
            <TextSection title="Requirements" content={tournament.requirements} />
          ) : null}
          {tournament.rules ? <TextSection title="Rules" content={tournament.rules} /> : null}
          {tournament.prizes ? <TextSection title="Prizes" content={tournament.prizes} /> : null}

          {canManageTournament(tournament, user?.id) && availableActions(tournament.status).length > 0 ? (
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
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
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
