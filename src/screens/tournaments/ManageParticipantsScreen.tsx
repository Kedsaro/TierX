import { ChevronLeft, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../../auth/AuthProvider';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { registrationRepository, tournamentRepository } from '../../database/repositories';
import { notifyUser } from '../../notifications/dispatch';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import { canManageTournament } from '../../tournaments/authorization';
import type { Registration, RegistrationStatus } from '../../types/registration';
import type { Tournament } from '../../types/tournament';

type ManageParticipantsScreenProps = NativeStackScreenProps<TournamentDetailParams, 'ManageParticipants'>;

type ManagedRegistration = Registration & { display_name: string; user_id: number | null };

const statusLabels: Record<RegistrationStatus, string> = {
  pending: 'Pending',
  registered: 'Registered',
  waitlisted: 'Waitlisted',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const statusTones = {
  pending: 'warning',
  registered: 'success',
  waitlisted: 'warning',
  cancelled: 'neutral',
  rejected: 'danger',
} as const;

export function ManageParticipantsScreen({ navigation, route }: ManageParticipantsScreenProps) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { tournamentId } = route.params;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [registrations, setRegistrations] = useState<ManagedRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingPlayerId, setPendingPlayerId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [details, rows] = await Promise.all([
        tournamentRepository.getDetails(db, tournamentId),
        registrationRepository.listForTournament(db, tournamentId),
      ]);
      setTournament(details);
      setRegistrations(rows);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load participants.');
    } finally {
      setIsLoading(false);
    }
  }, [db, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isOrganizer = tournament ? canManageTournament(tournament, user?.id, user?.role) : false;

  async function updateStatus(registration: ManagedRegistration, status: RegistrationStatus) {
    setPendingPlayerId(registration.player_id);
    setActionError(null);
    try {
      await registrationRepository.setStatus(db, tournamentId, registration.player_id, status);
      if (status === 'rejected' && registration.user_id != null && tournament) {
        await notifyUser(
          db,
          registration.user_id,
          'removal',
          'Removed from tournament',
          `You were removed from "${tournament.name}" by the organizer.`,
        );
      }
      setRegistrations((current) =>
        current.map((item) => (item.player_id === registration.player_id ? { ...item, status } : item)),
      );
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update the registration.');
    } finally {
      setPendingPlayerId(null);
    }
  }

  function actionsFor(registration: ManagedRegistration) {
    switch (registration.status) {
      case 'pending':
        return [
          { label: 'Approve', status: 'registered' as const, variant: 'primary' as const },
          { label: 'Reject', status: 'rejected' as const, variant: 'danger' as const },
        ];
      case 'waitlisted':
        return [{ label: 'Admit', status: 'registered' as const, variant: 'primary' as const }];
      case 'registered':
        return [{ label: 'Remove', status: 'rejected' as const, variant: 'danger' as const }];
      default:
        return [{ label: 'Readmit', status: 'registered' as const, variant: 'secondary' as const }];
    }
  }

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
        <Text accessibilityRole="header" className="text-base font-bold text-[#17231f]">
          Manage participants
        </Text>
      </View>

      {isLoading ? (
        <FeedbackState kind="loading" title="Loading participants" description="Fetching the latest registrations." />
      ) : error || !tournament ? (
        <FeedbackState
          actionLabel="Go back"
          description={error ?? 'This tournament is no longer available.'}
          kind="error"
          onAction={() => navigation.goBack()}
          title="Could not load participants"
        />
      ) : !isOrganizer ? (
        <FeedbackState
          actionLabel="Go back"
          description="Only the organizer can manage participants for this tournament."
          kind="error"
          onAction={() => navigation.goBack()}
          title="Not allowed"
        />
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-2">
          <Text className="text-2xl font-bold text-[#17231f]">{tournament.name}</Text>
          <View className="mt-2 flex-row items-center gap-2">
            <Users color="#176b5b" size={16} />
            <Text className="text-sm text-[#4d5d55]">
              {registrations.filter((item) => item.status !== 'cancelled' && item.status !== 'rejected').length} / {tournament.capacity} spots filled
            </Text>
          </View>

          {actionError ? (
            <View accessibilityRole="alert" className="mt-4 rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
              <Text className="text-sm leading-5 text-[#872822]">{actionError}</Text>
            </View>
          ) : null}

          {registrations.length === 0 ? (
            <Card className="mt-4 p-4">
              <Text className="text-sm text-[#65736c]">No players have registered for this tournament yet.</Text>
            </Card>
          ) : (
            <View className="mt-4 gap-2">
              {registrations.map((registration) => (
                <Card className="gap-3 p-4" key={registration.id}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className="min-w-0 flex-1 text-sm font-bold text-[#17231f]" numberOfLines={1}>
                      {registration.display_name}
                    </Text>
                    <Badge label={statusLabels[registration.status]} tone={statusTones[registration.status]} />
                  </View>
                  <View className="flex-row gap-2">
                    {actionsFor(registration).map((action) => (
                      <View className="flex-1" key={action.label}>
                        <Button
                          loading={pendingPlayerId === registration.player_id}
                          onPress={() => void updateStatus(registration, action.status)}
                          variant={action.variant}
                        >
                          {action.label}
                        </Button>
                      </View>
                    ))}
                  </View>
                </Card>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
