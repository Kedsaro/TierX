import { ChevronDown, ChevronLeft, ChevronUp, Plus, Trash2 } from 'lucide-react-native';
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
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { matchRepository, notificationRepository, playerRepository, registrationRepository, rankingRepository, stageRepository, tournamentRepository } from '../../database/repositories';
import { notifyMatchPlayers } from '../../notifications/dispatch';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import { canManageTournament } from '../../tournaments/authorization';
import { availableMatchActions } from '../../tournaments/matchActions';
import { validateMatchResult } from '../../tournaments/matchValidation';
import { parseLocalDateTime } from '../../tournaments/validation';
import type { MatchDetails, Stage } from '../../types/match';
import type { Tournament } from '../../types/tournament';

type Props = NativeStackScreenProps<TournamentDetailParams, 'Bracket'>;
type Participant = { player_id: number; display_name: string };

const stageFormatOptions = ['Single elimination', 'Double elimination', 'Round robin', 'Group stage'];

const matchStatusLabels: Record<MatchDetails['status'], string> = {
  scheduled: 'Scheduled',
  ongoing: 'Ongoing',
  disputed: 'Disputed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const matchStatusTones: Record<MatchDetails['status'], 'neutral' | 'success' | 'warning' | 'danger'> = {
  scheduled: 'neutral',
  ongoing: 'warning',
  disputed: 'danger',
  completed: 'success',
  cancelled: 'neutral',
};

/** Groups a stage's matches into ordered round sections for the bracket summary. */
function groupMatchesByRound(matches: MatchDetails[]): { round: number; matches: MatchDetails[] }[] {
  const byRound = new Map<number, MatchDetails[]>();
  for (const match of matches) {
    const list = byRound.get(match.round_number) ?? [];
    list.push(match);
    byRound.set(match.round_number, list);
  }
  return [...byRound.entries()]
    .sort(([a], [b]) => a - b)
    .map(([round, roundMatches]) => ({
      round,
      matches: roundMatches.sort((a, b) => a.match_number - b.match_number),
    }));
}

/** Players officially eliminated in a match — the persisted list, falling back to winner-based inference for legacy rows. */
function eliminatedIdsFor(match: MatchDetails): number[] {
  if (match.eliminated_ids.length > 0) return match.eliminated_ids;
  if (match.participant_ids.length > 0) return match.participant_ids.filter((id) => id !== match.winner_id);
  const other = match.winner_id === match.player_one_id ? match.player_two_id : match.player_one_id;
  return other != null ? [other] : [];
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function BracketScreen({ route, navigation }: Props) {
  const { tournamentId } = route.params;
  const db = useSQLiteContext();
  const { user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eliminatedPlayerIds, setEliminatedPlayerIds] = useState<number[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [matchesByStage, setMatchesByStage] = useState<Record<number, MatchDetails[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);

  const [newStageName, setNewStageName] = useState('');
  const [newStageFormat, setNewStageFormat] = useState(stageFormatOptions[0]);
  const [stageError, setStageError] = useState<string | null>(null);
  const [isAddingStage, setIsAddingStage] = useState(false);

  const [matchFormStageId, setMatchFormStageId] = useState<number | null>(null);
  const [newPlayerCount, setNewPlayerCount] = useState('2');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [participantsConfirmed, setParticipantsConfirmed] = useState(false);
  const [matchFormError, setMatchFormError] = useState<string | null>(null);
  const [eliminatedIds, setEliminatedIds] = useState<number[]>([]);
  const [eliminationError, setEliminationError] = useState<string | null>(null);
  const [roundMessage, setRoundMessage] = useState<{ stageId: number; matchId: number; playerIds: number[]; eliminatedIds: number[]; winnerId: number } | null>(null);
  const [roundMessageText, setRoundMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const loadAll = useCallback(() => {
    let isCurrent = true;
    Promise.all([
      tournamentRepository.getById(db, tournamentId),
      registrationRepository.listParticipants(db, tournamentId),
      stageRepository.listByTournament(db, tournamentId),
      matchRepository.listEliminatedPlayerIds(db, tournamentId),
    ]).then(
      async ([tournamentRow, participantRows, stageRows, eliminatedRows]) => {
        if (!isCurrent) return;
        if (!tournamentRow) {
          setError('This tournament is no longer available.');
          setIsLoading(false);
          return;
        }
        setTournament(tournamentRow);
        setParticipants(participantRows);
        setStages(stageRows);
        setEliminatedPlayerIds(eliminatedRows);
        // Auto-close: an ongoing tournament with a single un-eliminated
        // participant is already decided. Only flip the status here — the
        // champion's win is awarded when the deciding round is published.
        if (tournamentRow.status === 'ongoing' && participantRows.length > 0) {
          const survivors = participantRows.filter((p) => !eliminatedRows.includes(p.player_id));
          if (survivors.length === 1) {
            await tournamentRepository.updateStatus(db, tournamentId, 'completed');
            tournamentRow = { ...tournamentRow, status: 'completed' };
            setTournament(tournamentRow);
          }
        }
        const entries = await Promise.all(
          stageRows.map((stage) => matchRepository.listByStage(db, stage.id).then((rows) => [stage.id, rows] as const)),
        );
        if (!isCurrent) return;
        setMatchesByStage(Object.fromEntries(entries));
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (!isCurrent) return;
        setError(cause instanceof Error ? cause.message : 'Unable to load the bracket.');
        setIsLoading(false);
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [db, tournamentId]);

  useEffect(() => loadAll(), [loadAll]);

  function refreshStageMatches(stageId: number) {
    matchRepository.listByStage(db, stageId).then((rows) => {
      setMatchesByStage((prev) => ({ ...prev, [stageId]: rows }));
    }).catch(() => {});
  }

  async function handleAddStage() {
    if (!newStageName.trim()) {
      setStageError('Enter a name for this stage.');
      return;
    }
    setIsAddingStage(true);
    setStageError(null);
    try {
      await stageRepository.create(db, {
        tournament_id: tournamentId,
        name: newStageName.trim(),
        position: stages.length + 1,
        format: newStageFormat,
      });
      setNewStageName('');
      loadAll();
    } catch (cause) {
      setStageError(cause instanceof Error ? cause.message : 'Could not create this stage.');
    } finally {
      setIsAddingStage(false);
    }
  }

  async function handleDeleteStage(stage: Stage) {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert('Delete stage', `This removes "${stage.name}" and all of its matches. Are you sure?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!proceed) return;
    await stageRepository.delete(db, stage.id);
    loadAll();
  }

  async function handleCloseStage(stage: Stage) {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert('Close stage', `No more rounds can be added to "${stage.name}". Are you sure?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Close stage', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!proceed) return;
    await stageRepository.close(db, stage.id);
    loadAll();
  }

  async function handleAddRound(stageId: number, startImmediately = false) {
    const stage = stages.find((s) => s.id === stageId);
    const minPlayers = stage?.format.toLowerCase().includes('double') ? 3 : 2;
    const playerCount = Number(newPlayerCount);
    if (!Number.isInteger(playerCount) || playerCount < minPlayers) {
      setMatchFormError(`Minimum ${minPlayers} players must participate.`);
      return;
    }
    if (selectedPlayerIds.length !== playerCount) {
      setMatchFormError(`Select exactly ${playerCount} players for this round.`);
      return;
    }
    if (!participantsConfirmed) {
      setMatchFormError('Confirm the selected participants first.');
      return;
    }
    setMatchFormError(null);
    try {
      const existing = matchesByStage[stageId] ?? [];
      const nextRound = existing.reduce((max, m) => Math.max(max, m.round_number), 0) + 1;
      // A round is a single match card hosting every selected player.
      const matchId = await matchRepository.create(db, {
        stage_id: stageId,
        round_number: nextRound,
        match_number: 1,
        player_one_id: selectedPlayerIds[0] ?? null,
        player_two_id: selectedPlayerIds[1] ?? null,
        participant_ids: selectedPlayerIds,
      });
      if (startImmediately) {
        await matchRepository.markOngoing(db, matchId);
        // The elimination picker is driven by the match itself once it is ongoing.
        setExpandedMatchId(matchId);
        setEliminatedIds([]);
        setEliminationError(null);
      }
      setMatchFormStageId(null);
      setNewPlayerCount('2');
      setSelectedPlayerIds([]);
      setParticipantsConfirmed(false);
      refreshStageMatches(stageId);
    } catch (cause) {
      setMatchFormError(cause instanceof Error ? cause.message : 'Could not create this match.');
    }
  }

  async function handleConfirmElimination(stage: Stage, match: MatchDetails) {
    // The elimination type dictates how many players must be checked off:
    // single elimination knocks out exactly 1 player per round match; other
    // formats eliminate everyone but the single winner.
    const isFixedCount = stage.format.toLowerCase().includes('single');
    const required = isFixedCount ? 1 : match.participant_ids.length - 1;
    if (eliminatedIds.length !== required) {
      setEliminationError(
        isFixedCount ? 'Eliminate exactly 1 player.' : `Eliminate exactly ${required} players — one winner must remain.`,
      );
      return;
    }
    if (eliminatedIds.length >= match.participant_ids.length) {
      setEliminationError('Eliminate at least 1 player and leave at least 1 winner.');
      return;
    }
    const survivors = match.participant_ids.filter((id) => !eliminatedIds.includes(id));
    const winnerId = survivors[0];
    if (winnerId == null) {
      setEliminationError('At least one player must remain as the winner.');
      return;
    }
    setEliminationError(null);
    // Nothing is persisted yet — the elimination only becomes official once the
    // organizer writes and publishes the round details message.
    const picked = [...eliminatedIds];
    setEliminatedIds([]);
    setRoundMessage({ stageId: stage.id, matchId: match.id, playerIds: match.participant_ids, eliminatedIds: picked, winnerId });
    setRoundMessageText('');
  }

  async function handleSendRoundMessage() {
    if (!roundMessage) return;
    const text = roundMessageText.trim();
    if (!text) return;
    setIsSendingMessage(true);
    try {
      // Publishing the message makes the elimination official.
      await matchRepository.recordResult(db, roundMessage.matchId, {
        score_one: 0,
        score_two: 0,
        winner_id: roundMessage.winnerId,
        evidence_uri: null,
      });
      await matchRepository.markEliminated(db, roundMessage.matchId, roundMessage.eliminatedIds);
      await matchRepository.setDetails(db, roundMessage.matchId, text);
      // Every eliminated player takes a loss immediately.
      for (const loserId of roundMessage.eliminatedIds) {
        await rankingRepository.recordLoss(db, tournament!.game_id, loserId);
      }
      // A win is only awarded to the definitive winner — the single player left
      // standing once every other participant of the tournament is eliminated;
      // that also closes the tournament automatically.
      const eliminatedNow = await matchRepository.listEliminatedPlayerIds(db, tournamentId);
      const survivors = participants.filter((p) => !eliminatedNow.includes(p.player_id));
      if (survivors.length === 1 && survivors[0].player_id === roundMessage.winnerId) {
        await rankingRepository.recordWin(db, tournament!.game_id, roundMessage.winnerId);
        await tournamentRepository.updateStatus(db, tournamentId, 'completed');
        setTournament((current) => (current ? { ...current, status: 'completed' } : current));
      }
      const eliminatedNames = roundMessage.eliminatedIds
        .map((id) => participants.find((p) => p.player_id === id)?.display_name ?? `#${id}`)
        .join(', ');
      const message = `${text}\n\nEliminated: ${eliminatedNames}`;
      for (const playerId of roundMessage.playerIds) {
        const player = await playerRepository.getById(db, playerId);
        if (player?.user_id != null) {
          await notificationRepository.create(db, {
            user_id: player.user_id,
            type: 'round_details',
            title: `Round results — ${tournament!.name}`,
            message,
          });
        }
      }
      // Eliminated players additionally get a blocking 'eliminated' alert.
      for (const loserId of roundMessage.eliminatedIds) {
        const loser = await playerRepository.getById(db, loserId);
        if (loser?.user_id != null) {
          await notificationRepository.create(db, {
            user_id: loser.user_id,
            type: 'eliminated',
            title: 'You were eliminated',
            message: `You were eliminated in "${tournament!.name}". ${text}`,
          });
        }
      }
      setRoundMessage(null);
      setRoundMessageText('');
      const eliminated = await matchRepository.listEliminatedPlayerIds(db, tournamentId);
      setEliminatedPlayerIds(eliminated);
      refreshStageMatches(roundMessage.stageId);
    } finally {
      setIsSendingMessage(false);
    }
  }

  async function handleDeleteMatch(stageId: number, match: MatchDetails) {
    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert('Delete match', 'This match will be removed. Are you sure?', [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ]);
    });
    if (!proceed) return;
    await matchRepository.delete(db, match.id);
    refreshStageMatches(stageId);
  }

  function renderMatch(stageId: number, match: MatchDetails) {
    return (
      <MatchRow
        key={match.id}
        expanded={expandedMatchId === match.id}
        match={match}
        onAssign={async (input) => {
          await matchRepository.assign(db, match.id, input);
          // RF-15: players hear about their schedule as soon as it is set or changed.
          if (input.scheduled_at) {
            await notifyMatchPlayers(db, input, 'schedule', 'Match scheduled', `Your match in "${tournament!.name}" was scheduled for ${formatDateTime(input.scheduled_at)}.`);
          }
          refreshStageMatches(stageId);
        }}
        onCancel={async () => {
          // Cancelling removes the match entirely — as if it was never created.
          await matchRepository.delete(db, match.id);
          setRoundMessage((current) => (current?.matchId === match.id ? null : current));
          refreshStageMatches(stageId);
        }}
        onDelete={() => handleDeleteMatch(stageId, match)}
        onDispute={async () => {
          await matchRepository.markDisputed(db, match.id);
          refreshStageMatches(stageId);
        }}
        onPublishResult={async (input) => {
          const { errors, result } = validateMatchResult({
            playerOneId: match.player_one_id,
            playerTwoId: match.player_two_id,
            scoreOneText: input.scoreOneText,
            scoreTwoText: input.scoreTwoText,
          });
          if (!result) {
            return errors.general ?? errors.scoreOne ?? errors.scoreTwo ?? 'Enter a valid result.';
          }
          await matchRepository.recordResult(db, match.id, {
            score_one: result.scoreOne,
            score_two: result.scoreTwo,
            winner_id: result.winnerId,
            evidence_uri: input.evidenceUri.trim() || null,
          });
          await rankingRepository.recordLoss(db, tournament!.game_id, result.loserId);
          const stillIn = await matchRepository.listEliminatedPlayerIds(db, tournamentId);
          const aliveNow = participants.filter((p) => !stillIn.includes(p.player_id));
          if (aliveNow.length === 1 && aliveNow[0].player_id === result.winnerId) {
            await rankingRepository.recordWin(db, tournament!.game_id, result.winnerId);
          }
          await notifyMatchPlayers(db, match, 'result', 'Result published', `Your match in "${tournament!.name}" ended ${result.scoreOne} - ${result.scoreTwo}.`);
          refreshStageMatches(stageId);
        }}
        onPublishWinner={async ({ winnerId, evidenceUri }) => {
          await matchRepository.recordResult(db, match.id, {
            score_one: 0,
            score_two: 0,
            winner_id: winnerId,
            evidence_uri: evidenceUri.trim() || null,
          });
          // Every other participant counts as eliminated by the winner.
          const losers = match.participant_ids.filter((id) => id !== winnerId);
          await matchRepository.markEliminated(db, match.id, losers);
          for (const loserId of losers) {
            await rankingRepository.recordLoss(db, tournament!.game_id, loserId);
          }
          const remaining = await matchRepository.listEliminatedPlayerIds(db, tournamentId);
          const alive = participants.filter((p) => !remaining.includes(p.player_id));
          if (alive.length === 1 && alive[0].player_id === winnerId) {
            await rankingRepository.recordWin(db, tournament!.game_id, winnerId);
          }
          await notifyMatchPlayers(db, match, 'result', 'Result published', `Your match in "${tournament!.name}" was completed.`);
          refreshStageMatches(stageId);
        }}
        onAssignParticipants={async (playerIds) => {
          await matchRepository.replaceParticipants(db, match.id, playerIds);
          refreshStageMatches(stageId);
        }}
        onResolveDispute={async () => {
          await matchRepository.updateStatus(db, match.id, 'ongoing');
          refreshStageMatches(stageId);
        }}
        onStart={async () => {
          await matchRepository.markOngoing(db, match.id);
          await notifyMatchPlayers(db, match, 'match_started', 'Match started', `Your match in "${tournament!.name}" is now ongoing.`);
          refreshStageMatches(stageId);
        }}
        onToggle={() => {
          setEliminatedIds([]);
          setEliminationError(null);
          setExpandedMatchId((current) => (current === match.id ? null : match.id));
        }}
        participants={participants}
        readOnly={!canEdit}
      />
    );
  }

  function renderRoundMessagePanel() {
    if (!roundMessage) return null;
    return (
      <View className="gap-3 rounded-lg border border-[#dfe7e1] bg-[#f4f6f2] p-3">
        <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">
          Round details message
        </Text>
        <Input
          label="Message to participants"
          multiline
          onChangeText={setRoundMessageText}
          placeholder="Write the round details for the players..."
          value={roundMessageText}
        />
        <Button loading={isSendingMessage} onPress={() => void handleSendRoundMessage()}>Send message</Button>
        <Button
          onPress={() => {
            // Go back to the elimination picker — the round stays pending.
            if (roundMessage) {
              setEliminatedIds(roundMessage.eliminatedIds);
            }
            setRoundMessage(null);
            setRoundMessageText('');
          }}
          variant="quiet"
        >
          Back
        </Button>
      </View>
    );
  }

  function renderEliminationPanel(stage: Stage, match: MatchDetails) {
    return (
      <View className="gap-3 rounded-lg border border-[#dfe7e1] bg-[#f4f6f2] p-3">
        <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">
          Select players to eliminate · {stage.format.replace(/_/g, ' ')}
        </Text>
        {match.participant_ids.map((playerId) => {
          const checked = eliminatedIds.includes(playerId);
          const name = participants.find((p) => p.player_id === playerId)?.display_name ?? `#${playerId}`;
          return (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              className="flex-row items-center gap-3 rounded-lg border border-[#dfe7e1] bg-white p-2.5"
              key={playerId}
              onPress={() =>
                setEliminatedIds((current) => {
                  if (checked) return current.filter((id) => id !== playerId);
                  // Cap at the format's elimination count: 1 for single, N-1 otherwise.
                  const cap = stage.format.toLowerCase().includes('single') ? 1 : match.participant_ids.length - 1;
                  return current.length < cap ? [...current, playerId] : current;
                })
              }
            >
              <View className={`h-5 w-5 items-center justify-center rounded border ${checked ? 'border-[#a93232] bg-[#a93232]' : 'border-[#ccd7cf] bg-white'}`}>
                {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
              </View>
              <Text className="flex-1 text-sm text-[#17231f]" numberOfLines={1}>
                {name}
              </Text>
            </Pressable>
          );
        })}
        {eliminationError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{eliminationError}</Text> : null}
        <Button
          disabled={stage.format.toLowerCase().includes('double') && eliminatedIds.length < match.participant_ids.length - 1}
          onPress={() => void handleConfirmElimination(stage, match)}
        >
          {stage.format.toLowerCase().includes('double') ? 'Confirm eliminations' : 'Confirm elimination'}
        </Button>
      </View>
    );
  }

  const isOrganizer = tournament ? canManageTournament(tournament, user?.id, user?.role) : false;
  // Once the tournament is completed the bracket becomes read-only results
  // for everyone — organizers and participants alike (T-086 refinement).
  const isCompleted = tournament?.status === 'completed';
  const canEdit = isOrganizer && !isCompleted;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
        <FeedbackState kind="loading" title="Loading bracket" />
      </SafeAreaView>
    );
  }

  if (error || !tournament) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
        <FeedbackState
          actionLabel="Go back"
          description={error ?? 'This tournament is no longer available.'}
          kind="error"
          onAction={() => navigation.goBack()}
          title="Could not load bracket"
        />
      </SafeAreaView>
    );
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
        <Text accessibilityRole="header" className="text-base font-bold text-[#17231f]" numberOfLines={1}>
          {isCompleted ? 'Bracket results' : 'Bracket'} · {tournament.name}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 pb-8 pt-3">
        {!canEdit ? null : participants.length === 0 ? (
          <Card className="p-4">
            <Text className="text-sm text-[#65736c]">No participants are registered yet. Stages and matches can still be created, but players cannot be assigned until someone registers.</Text>
          </Card>
        ) : null}

        {canEdit ? (
        <Card className="gap-3 p-4">
          <Text className="text-sm font-bold uppercase tracking-wide text-[#65736c]">Add stage</Text>
          <Input label="Name" onChangeText={setNewStageName} placeholder="e.g. Group Stage, Playoffs" value={newStageName} />
          <View className="flex-row flex-wrap gap-2">
            {stageFormatOptions.map((option) => {
              const selected = option === newStageFormat;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  className={`rounded-lg border px-3 py-2 ${selected ? 'border-[#176b5b] bg-[#e1eee8]' : 'border-[#dfe7e1] bg-white'}`}
                  key={option}
                  onPress={() => setNewStageFormat(option)}
                >
                  <Text className={`text-xs font-bold ${selected ? 'text-[#176b5b]' : 'text-[#26352e]'}`}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          {stageError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{stageError}</Text> : null}
          <Button icon={<Plus color="#ffffff" size={16} />} loading={isAddingStage} onPress={() => void handleAddStage()}>
            Add stage
          </Button>
        </Card>
        ) : null}

        {stages.length === 0 ? (
          <FeedbackState
            description={canEdit ? 'Add a stage above (e.g. Group Stage or Playoffs) to start building the bracket.' : 'The organizer has not built the bracket yet.'}
            kind="empty"
            title={canEdit ? 'No stages yet' : 'No bracket yet'}
          />
        ) : (
          stages.map((stage) => (
            <Card className="gap-3 p-4" key={stage.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-2xl font-bold text-[#17231f]">
                    {stage.name}<Text className="text-base font-normal text-[#65736c]">, {stage.format.replace(/_/g, ' ')}</Text>
                  </Text>
                </View>
                {canEdit ? (
                  <Pressable accessibilityLabel="Delete stage" accessibilityRole="button" hitSlop={8} onPress={() => void handleDeleteStage(stage)}>
                    <Trash2 color="#a93232" size={18} />
                  </Pressable>
                ) : null}
              </View>

              <View className="gap-4">
                {groupMatchesByRound(matchesByStage[stage.id] ?? []).map((group) => (
                  <View className="gap-2" key={group.round}>
                    <View className="gap-2">
                      {group.matches.map((match) => (
                        <View className="gap-2" key={match.id}>
                          {renderMatch(stage.id, match)}
                          {canEdit && match.status === 'ongoing' && match.participant_ids.length > 0 && expandedMatchId === match.id ? (
                            renderEliminationPanel(stage, match)
                          ) : null}
                          {canEdit && roundMessage?.matchId === match.id && expandedMatchId === match.id ? (
                            renderRoundMessagePanel()
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              {canEdit ? (matchFormStageId === stage.id ? (
                <View className="gap-3 rounded-lg border border-[#dfe7e1] bg-[#f4f6f2] p-3">
                  {!participantsConfirmed ? (
                  <Input
                    keyboardType="number-pad"
                    label="Players in this round"
                    onChangeText={(text) => {
                      setNewPlayerCount(text);
                      setParticipantsConfirmed(false);
                      const limit = Number(text);
                      if (Number.isInteger(limit)) {
                        setSelectedPlayerIds((current) => current.slice(0, Math.max(0, limit)));
                      }
                    }}
                    value={newPlayerCount}
                  />
                  ) : null}
                  {Number.isInteger(Number(newPlayerCount)) && Number(newPlayerCount) >= (stage.format.toLowerCase().includes('double') ? 3 : 2) ? (
                    <View className="gap-2">
                      <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">
                        Match Players ({selectedPlayerIds.length}/{newPlayerCount})
                      </Text>
                      {participants.filter((p) => eliminatedPlayerIds.includes(p.player_id)).length > 0 ? (
                        <Text className="text-xs text-[#65736c]">Players already eliminated in this tournament are hidden.</Text>
                      ) : null}
                      {participantsConfirmed ? (
                        <View className="gap-1 rounded-lg border border-[#dfe7e1] bg-white p-3">
                          {selectedPlayerIds.map((playerId, index) => (
                            <Text className="text-sm text-[#17231f]" key={playerId}>
                              <Text className="font-bold">Participant {index + 1}:</Text> {participants.find((p) => p.player_id === playerId)?.display_name ?? `#${playerId}`}
                            </Text>
                          ))}
                        </View>
                      ) : participants.filter((p) => !eliminatedPlayerIds.includes(p.player_id)).length === 0 ? (
                        <Text className="text-sm text-[#65736c]">No participants registered yet.</Text>
                      ) : (
                        <>
                          {participants.filter((p) => !eliminatedPlayerIds.includes(p.player_id)).map((participant) => {
                            const checked = selectedPlayerIds.includes(participant.player_id);
                            return (
                              <Pressable
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked }}
                                className={`flex-row items-center gap-3 rounded-lg border border-[#dfe7e1] bg-white p-2.5 ${participantsConfirmed ? 'opacity-60' : ''}`}
                                disabled={participantsConfirmed}
                                key={participant.player_id}
                                onPress={() => {
                                  setParticipantsConfirmed(false);
                                  setSelectedPlayerIds((current) =>
                                    checked
                                      ? current.filter((id) => id !== participant.player_id)
                                      : current.length < Number(newPlayerCount)
                                        ? [...current, participant.player_id]
                                        : current,
                                  );
                                }}
                              >
                              <View className={`h-5 w-5 items-center justify-center rounded border ${checked ? 'border-[#176b5b] bg-[#176b5b]' : 'border-[#ccd7cf] bg-white'}`}>
                                {checked ? <Text className="text-xs font-bold text-white">✓</Text> : null}
                              </View>
                              <Text className="flex-1 text-sm text-[#17231f]" numberOfLines={1}>
                                {participant.display_name}
                              </Text>
                              </Pressable>
                            );
                          })}
                          <Button
                            onPress={() => {
                              const count = Number(newPlayerCount);
                              if (selectedPlayerIds.length !== count) {
                                setMatchFormError(`Select exactly ${count} players for this round.`);
                                setParticipantsConfirmed(false);
                                return;
                              }
                              setMatchFormError(null);
                              setParticipantsConfirmed(true);
                            }}
                            variant="secondary"
                          >
                            Confirm participants
                          </Button>
                        </>
                      )}
                    </View>
                  ) : null}
                  {participantsConfirmed ? (
                    <>
                      <Text className="text-sm font-semibold text-[#176b5b]">Participants confirmed for this match.</Text>
                      <Button onPress={() => void handleAddRound(stage.id, true)} variant="primary">
                        Start match
                      </Button>
                    </>
                  ) : null}
                  {matchFormError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{matchFormError}</Text> : null}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        onPress={() => {
                          // Discarding a round also removes the match created for it, if any.
                          const pendingMatchId = roundMessage?.stageId === stage.id ? roundMessage.matchId : null;
                          if (pendingMatchId != null) {
                            void matchRepository.delete(db, pendingMatchId).then(() => refreshStageMatches(stage.id));
                            setRoundMessage(null);
                          }
                          setMatchFormStageId(null);
                          setSelectedPlayerIds([]);
                          setParticipantsConfirmed(false);
                          setEliminatedIds([]);
                        }}
                        variant="danger"
                      >
                        Discard Round
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button onPress={() => void handleAddRound(stage.id)}>Add round</Button>
                    </View>
                  </View>
                </View>
              ) : stage.closed !== 1 ? (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button onPress={() => void handleCloseStage(stage)} variant="danger">
                      Close Stage
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      icon={<Plus color="#176b5b" size={16} />}
                      onPress={() => {
                        setNewPlayerCount('2');
                        setSelectedPlayerIds([]);
                        setParticipantsConfirmed(false);
                        setMatchFormError(null);
                        setMatchFormStageId(stage.id);
                      }}
                      variant="secondary"
                    >
                      Add round
                    </Button>
                  </View>
                </View>
              ) : null) : null}

              {/* Visible to everyone — participants and spectators alike. */}
              {stage.closed === 1 ? (
                <Text className="text-sm font-semibold text-[#65736c]">Stage closed.</Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

interface MatchRowProps {
  match: MatchDetails;
  participants: Participant[];
  expanded: boolean;
  onToggle: () => void;
  onAssign: (input: { player_one_id: number | null; player_two_id: number | null; scheduled_at: string | null; referee_id: number | null }) => Promise<void>;
  onStart: () => Promise<void>;
  onDispute: () => Promise<void>;
  onResolveDispute: () => Promise<void>;
  onCancel: () => Promise<void>;
  onDelete: () => Promise<void>;
  onPublishResult: (input: { scoreOneText: string; scoreTwoText: string; evidenceUri: string }) => Promise<string | void>;
  /** Publishes a winner for multi-player round matches (free-for-all rounds). */
  onPublishWinner: (input: { winnerId: number; evidenceUri: string }) => Promise<string | void>;
  /** Replaces the participant set of a multi-player match. */
  onAssignParticipants: (playerIds: number[]) => Promise<void>;
  /** Read-only results view — used once the tournament is completed. */
  readOnly?: boolean;
}

const UNASSIGNED = -1;

function MatchRow({
  match,
  participants,
  expanded,
  onToggle,
  onAssign,
  onStart,
  onDispute,
  onResolveDispute,
  onCancel,
  onDelete,
  onPublishResult,
  onPublishWinner,
  onAssignParticipants,
  readOnly = false,
}: MatchRowProps) {
  const [playerOneId, setPlayerOneId] = useState(match.player_one_id ?? UNASSIGNED);
  const [playerTwoId, setPlayerTwoId] = useState(match.player_two_id ?? UNASSIGNED);
  const [multiParticipantIds, setMultiParticipantIds] = useState<number[]>(match.participant_ids);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [scoreOneText, setScoreOneText] = useState('');
  const [scoreTwoText, setScoreTwoText] = useState('');
  const [evidenceUri, setEvidenceUri] = useState('');
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState(false);

  const participantOptions = [{ label: 'Unassigned', value: UNASSIGNED }, ...participants.map((p) => ({ label: p.display_name, value: p.player_id }))];
  const actions = availableMatchActions(match.status);
  const isMultiPlayer = match.participant_ids.length > 0;
  const vsNames = isMultiPlayer
    ? match.participant_names.join(' vs ')
    : `${match.player_one_name ?? 'TBD'} vs ${match.player_two_name ?? 'TBD'}`;

  function nameOf(playerId: number): string {
    const index = match.participant_ids.indexOf(playerId);
    if (index >= 0) return match.participant_names[index] ?? 'Unknown';
    if (playerId === match.player_one_id) return match.player_one_name ?? 'Unknown';
    return match.player_two_name ?? 'Unknown';
  }

  async function saveAssignment() {
    setIsSavingAssignment(true);
    setAssignError(null);
    try {
      await onAssign({
        player_one_id: playerOneId === UNASSIGNED ? null : playerOneId,
        player_two_id: playerTwoId === UNASSIGNED ? null : playerTwoId,
        referee_id: match.referee_id,
        scheduled_at: match.scheduled_at,
      });
      if (isMultiPlayer) {
        await onAssignParticipants(multiParticipantIds);
      }
    } catch (cause) {
      setAssignError(cause instanceof Error ? cause.message : 'Could not save this assignment.');
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function publishResult() {
    setIsPublishing(true);
    setResultError(null);
    try {
      const errorMessage = isMultiPlayer
        ? winnerId == null
          ? 'Select the round winner.'
          : await onPublishWinner({ winnerId, evidenceUri })
        : await onPublishResult({ scoreOneText, scoreTwoText, evidenceUri });
      if (errorMessage) setResultError(errorMessage);
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <View className="rounded-lg border border-[#dfe7e1] bg-[#f9faf8]">
      <Pressable
        accessibilityRole="button"
        className="flex-row items-center justify-between gap-2 p-3"
        onPress={onToggle}
      >
        <View className="min-w-0 flex-1">
          <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">
            Round {match.round_number}
          </Text>
          <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>
            {vsNames}
          </Text>
          {match.status === 'completed' ? (
            <Text className="text-xs text-[#65736c]">
              {match.score_one} - {match.score_two} · Winner: {match.winner_name}
            </Text>
          ) : (
            <Text className="text-xs text-[#65736c]">{formatDateTime(match.scheduled_at)}</Text>
          )}
        </View>
        <Badge label={matchStatusLabels[match.status]} tone={matchStatusTones[match.status]} />
        {expanded ? <ChevronUp color="#65736c" size={18} /> : <ChevronDown color="#65736c" size={18} />}
      </Pressable>

      {expanded && readOnly ? (
        <View className="gap-2 border-t border-[#dfe7e1] p-3">
          {isMultiPlayer ? (
            <View className="gap-1 rounded-lg border border-[#dfe7e1] bg-white p-3">
              {match.participant_ids.map((playerId, index) => (
                <Text className="text-sm text-[#17231f]" key={playerId}>
                  <Text className="font-bold">Participant {index + 1}:</Text> {match.participant_names[index] ?? `#${playerId}`}
                </Text>
              ))}
            </View>
          ) : (
            <>
              <Text className="text-sm text-[#4d5d55]">Player one: {match.player_one_name ?? 'TBD'}</Text>
              <Text className="text-sm text-[#4d5d55]">Player two: {match.player_two_name ?? 'TBD'}</Text>
            </>
          )}
          <Text className="text-sm text-[#4d5d55]">Scheduled: {formatDateTime(match.scheduled_at)}</Text>
          {match.status === 'completed' ? (
            <>
              <Text className="text-sm font-semibold text-[#17231f]">
                {isMultiPlayer
                  ? `Winner${match.participant_ids.filter((id) => !eliminatedIdsFor(match).includes(id)).length === 1 ? '' : 's'}: ${match.participant_ids
                      .filter((id) => !eliminatedIdsFor(match).includes(id))
                      .map((id) => nameOf(id))
                      .join(', ')}`
                  : `Winner: ${match.winner_name}`}
              </Text>
              {match.details ? <Text className="text-sm text-[#4d5d55]">{match.details}</Text> : null}
              {match.winner_id != null
                ? eliminatedIdsFor(match).map((id) => (
                    <Text className="text-sm font-semibold text-[#a93232]" key={id}>
                      {nameOf(id)} Eliminated
                    </Text>
                  ))
                : null}
            </>
          ) : null}
          {match.evidence_uri ? <Text className="text-xs text-[#65736c]" numberOfLines={1}>Evidence: {match.evidence_uri}</Text> : null}
        </View>
      ) : null}

      {expanded && !readOnly ? (
        <View className="gap-4 border-t border-[#dfe7e1] p-3">
          <View className="gap-3">
            {isMultiPlayer ? (
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">
                  Match Players ({multiParticipantIds.length} selected)
                </Text>
                {multiParticipantIds.length > 0 ? (
                  <View className="gap-1 rounded-lg border border-[#dfe7e1] bg-white p-3">
                    {multiParticipantIds.map((playerId, index) => (
                      <Text className="text-sm text-[#17231f]" key={playerId}>
                        <Text className="font-bold">Participant {index + 1}:</Text> {participants.find((p) => p.player_id === playerId)?.display_name ?? `#${playerId}`}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {match.status === 'completed' && match.details ? (
                  <Text className="text-sm text-[#4d5d55]">{match.details}</Text>
                ) : null}
                {match.status === 'completed' && match.winner_id != null
                  ? eliminatedIdsFor(match).map((id) => (
                      <Text className="text-sm font-semibold text-[#a93232]" key={id}>
                        {nameOf(id)} Eliminated
                      </Text>
                    ))
                  : null}
              </View>
            ) : (
              <>
                <Select label="Player one" onChange={setPlayerOneId} options={participantOptions} value={playerOneId} />
                <Select label="Player two" onChange={setPlayerTwoId} options={participantOptions} value={playerTwoId} />
              </>
            )}
            {assignError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{assignError}</Text> : null}
            {!isMultiPlayer ? (
              <Button loading={isSavingAssignment} onPress={() => void saveAssignment()} variant="secondary">
                Save assignment
              </Button>
            ) : null}
          </View>

          {/* "Publish result" section intentionally removed from the match config. */}

          <View className="gap-2 border-t border-[#dfe7e1] pt-3">
            {actions.includes('start') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onStart().finally(() => setIsRunningAction(false)); }} variant="secondary">
                Start match
              </Button>
            ) : null}
            {actions.includes('cancel') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onCancel().finally(() => setIsRunningAction(false)); }} variant="danger">
                Cancel Round
              </Button>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
