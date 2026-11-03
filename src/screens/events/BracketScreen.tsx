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
import { DateTimeField } from '../../components/ui/DateTimeField';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { matchRepository, registrationRepository, rankingRepository, stageRepository, tournamentRepository } from '../../database/repositories';
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
  const [newRoundNumber, setNewRoundNumber] = useState('1');
  const [newMatchNumber, setNewMatchNumber] = useState('1');
  const [matchFormError, setMatchFormError] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    let isCurrent = true;
    Promise.all([
      tournamentRepository.getById(db, tournamentId),
      registrationRepository.listParticipants(db, tournamentId),
      stageRepository.listByTournament(db, tournamentId),
    ]).then(
      async ([tournamentRow, participantRows, stageRows]) => {
        if (!isCurrent) return;
        if (!tournamentRow) {
          setError('This tournament is no longer available.');
          setIsLoading(false);
          return;
        }
        setTournament(tournamentRow);
        setParticipants(participantRows);
        setStages(stageRows);
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
    });
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

  async function handleAddMatch(stageId: number) {
    const roundNumber = Number(newRoundNumber);
    const matchNumber = Number(newMatchNumber);
    if (!Number.isInteger(roundNumber) || roundNumber <= 0 || !Number.isInteger(matchNumber) || matchNumber <= 0) {
      setMatchFormError('Round and match number must be whole numbers greater than 0.');
      return;
    }
    setMatchFormError(null);
    try {
      await matchRepository.create(db, { stage_id: stageId, round_number: roundNumber, match_number: matchNumber });
      setMatchFormStageId(null);
      setNewRoundNumber('1');
      setNewMatchNumber('1');
      refreshStageMatches(stageId);
    } catch (cause) {
      setMatchFormError(cause instanceof Error ? cause.message : 'Could not create this match.');
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

  const isOrganizer = tournament ? canManageTournament(tournament, user?.id) : false;

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

  if (!isOrganizer) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
        <FeedbackState
          actionLabel="Go back"
          description="Only the tournament organizer can configure stages and matches."
          kind="error"
          onAction={() => navigation.goBack()}
          title="Not authorized"
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
          Bracket · {tournament.name}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-4 px-5 pb-8 pt-3">
        {participants.length === 0 ? (
          <Card className="p-4">
            <Text className="text-sm text-[#65736c]">No participants are registered yet. Stages and matches can still be created, but players cannot be assigned until someone registers.</Text>
          </Card>
        ) : null}

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

        {stages.length === 0 ? (
          <FeedbackState
            description="Add a stage above (e.g. Group Stage or Playoffs) to start building the bracket."
            kind="empty"
            title="No stages yet"
          />
        ) : (
          stages.map((stage) => (
            <Card className="gap-3 p-4" key={stage.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-base font-bold text-[#17231f]">{stage.name}</Text>
                  <Text className="text-xs text-[#65736c]">Stage {stage.position} · {stage.format}</Text>
                </View>
                <Pressable accessibilityLabel="Delete stage" accessibilityRole="button" hitSlop={8} onPress={() => void handleDeleteStage(stage)}>
                  <Trash2 color="#a93232" size={18} />
                </Pressable>
              </View>

              <View className="gap-2">
                {(matchesByStage[stage.id] ?? []).map((match) => (
                  <MatchRow
                    key={match.id}
                    expanded={expandedMatchId === match.id}
                    match={match}
                    onAssign={async (input) => {
                      await matchRepository.assign(db, match.id, input);
                      refreshStageMatches(stage.id);
                    }}
                    onCancel={async () => {
                      await matchRepository.updateStatus(db, match.id, 'cancelled');
                      refreshStageMatches(stage.id);
                    }}
                    onDelete={() => handleDeleteMatch(stage.id, match)}
                    onDispute={async () => {
                      await matchRepository.markDisputed(db, match.id);
                      refreshStageMatches(stage.id);
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
                      await rankingRepository.recordMatchOutcome(db, tournament.game_id, result.winnerId, result.loserId);
                      refreshStageMatches(stage.id);
                    }}
                    onResolveDispute={async () => {
                      await matchRepository.updateStatus(db, match.id, 'ongoing');
                      refreshStageMatches(stage.id);
                    }}
                    onStart={async () => {
                      await matchRepository.markOngoing(db, match.id);
                      refreshStageMatches(stage.id);
                    }}
                    onToggle={() => setExpandedMatchId((current) => (current === match.id ? null : match.id))}
                    participants={participants}
                  />
                ))}
              </View>

              {matchFormStageId === stage.id ? (
                <View className="gap-3 rounded-lg border border-[#dfe7e1] bg-[#f4f6f2] p-3">
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Input keyboardType="number-pad" label="Round" onChangeText={setNewRoundNumber} value={newRoundNumber} />
                    </View>
                    <View className="flex-1">
                      <Input keyboardType="number-pad" label="Match #" onChangeText={setNewMatchNumber} value={newMatchNumber} />
                    </View>
                  </View>
                  {matchFormError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{matchFormError}</Text> : null}
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button onPress={() => setMatchFormStageId(null)} variant="quiet">Cancel</Button>
                    </View>
                    <View className="flex-1">
                      <Button onPress={() => void handleAddMatch(stage.id)}>Add</Button>
                    </View>
                  </View>
                </View>
              ) : (
                <Button
                  icon={<Plus color="#176b5b" size={16} />}
                  onPress={() => {
                    const existing = matchesByStage[stage.id] ?? [];
                    setNewRoundNumber('1');
                    setNewMatchNumber(String(existing.length + 1));
                    setMatchFormError(null);
                    setMatchFormStageId(stage.id);
                  }}
                  variant="secondary"
                >
                  Add match
                </Button>
              )}
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
}: MatchRowProps) {
  const [playerOneId, setPlayerOneId] = useState(match.player_one_id ?? UNASSIGNED);
  const [playerTwoId, setPlayerTwoId] = useState(match.player_two_id ?? UNASSIGNED);
  const [refereeId, setRefereeId] = useState(match.referee_id ?? UNASSIGNED);
  const [scheduledAt, setScheduledAt] = useState(match.scheduled_at ? match.scheduled_at.slice(0, 16).replace('T', ' ') : '');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  const [scoreOneText, setScoreOneText] = useState('');
  const [scoreTwoText, setScoreTwoText] = useState('');
  const [evidenceUri, setEvidenceUri] = useState('');
  const [resultError, setResultError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState(false);

  const participantOptions = [{ label: 'Unassigned', value: UNASSIGNED }, ...participants.map((p) => ({ label: p.display_name, value: p.player_id }))];
  const actions = availableMatchActions(match.status);

  async function saveAssignment() {
    setIsSavingAssignment(true);
    setAssignError(null);
    try {
      await onAssign({
        player_one_id: playerOneId === UNASSIGNED ? null : playerOneId,
        player_two_id: playerTwoId === UNASSIGNED ? null : playerTwoId,
        referee_id: refereeId === UNASSIGNED ? null : refereeId,
        scheduled_at: parseLocalDateTime(scheduledAt),
      });
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
      const errorMessage = await onPublishResult({ scoreOneText, scoreTwoText, evidenceUri });
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
            Round {match.round_number} · Match {match.match_number}
          </Text>
          <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>
            {match.player_one_name ?? 'TBD'} vs {match.player_two_name ?? 'TBD'}
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

      {expanded ? (
        <View className="gap-4 border-t border-[#dfe7e1] p-3">
          <View className="gap-3">
            <Select label="Player one" onChange={setPlayerOneId} options={participantOptions} value={playerOneId} />
            <Select label="Player two" onChange={setPlayerTwoId} options={participantOptions} value={playerTwoId} />
            <Select label="Referee" onChange={setRefereeId} options={participantOptions} value={refereeId} />
            <DateTimeField
              hint="Optional."
              label="Scheduled time"
              minimumDate={new Date()}
              onChange={setScheduledAt}
              value={scheduledAt}
            />
            {assignError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{assignError}</Text> : null}
            <Button loading={isSavingAssignment} onPress={() => void saveAssignment()} variant="secondary">
              Save assignment
            </Button>
          </View>

          {actions.includes('recordResult') ? (
            <View className="gap-3 border-t border-[#dfe7e1] pt-3">
              <Text className="text-xs font-bold uppercase tracking-wide text-[#65736c]">Publish result</Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Input keyboardType="number-pad" label={match.player_one_name ?? 'Player one'} onChangeText={setScoreOneText} value={scoreOneText} />
                </View>
                <View className="flex-1">
                  <Input keyboardType="number-pad" label={match.player_two_name ?? 'Player two'} onChangeText={setScoreTwoText} value={scoreTwoText} />
                </View>
              </View>
              <Input autoCapitalize="none" label="Evidence link (optional)" onChangeText={setEvidenceUri} placeholder="https://..." value={evidenceUri} />
              {resultError ? <Text accessibilityRole="alert" className="text-sm text-[#a93232]">{resultError}</Text> : null}
              <Button loading={isPublishing} onPress={() => void publishResult()}>Publish result</Button>
            </View>
          ) : null}

          <View className="flex-row flex-wrap gap-2 border-t border-[#dfe7e1] pt-3">
            {actions.includes('start') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onStart().finally(() => setIsRunningAction(false)); }} variant="secondary">
                Start match
              </Button>
            ) : null}
            {actions.includes('dispute') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onDispute().finally(() => setIsRunningAction(false)); }} variant="secondary">
                Flag as disputed
              </Button>
            ) : null}
            {actions.includes('resolveDispute') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onResolveDispute().finally(() => setIsRunningAction(false)); }} variant="secondary">
                Resolve dispute
              </Button>
            ) : null}
            {actions.includes('cancel') ? (
              <Button loading={isRunningAction} onPress={() => { setIsRunningAction(true); void onCancel().finally(() => setIsRunningAction(false)); }} variant="danger">
                Cancel match
              </Button>
            ) : null}
            <Button onPress={() => void onDelete()} variant="quiet">Delete match</Button>
          </View>
        </View>
      ) : null}
    </View>
  );
}
