import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
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
import { countryRepository, gameRepository, tournamentRepository } from '../../database/repositories';
import { canManageTournament } from '../../tournaments/authorization';
import {
  emptyTournamentForm,
  parseLocalDateTime,
  validateTournamentForm,
} from '../../tournaments/validation';
import type { TournamentFormErrors, TournamentFormValues } from '../../tournaments/validation';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import type { Country, Game } from '../../types/catalog';
import type { TournamentScope, TournamentVisibility } from '../../types/tournament';

type Props = NativeStackScreenProps<TournamentDetailParams, 'TournamentForm'>;

const steps = ['General', 'Game & location', 'Dates', 'Format & capacity', 'Rules & prizes', 'Review'] as const;

const formatOptions = [
  { label: 'Single elimination', value: 'single_elimination' },
  { label: 'Double elimination', value: 'double_elimination' },
  { label: 'Round robin', value: 'round_robin' },
];

const visibilityOptions: { label: string; value: TournamentVisibility }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Private', value: 'private' },
];

const scopeOptions: { label: string; value: TournamentScope }[] = [
  { label: 'Local', value: 'local' },
  { label: 'Regional', value: 'regional' },
  { label: 'National', value: 'national' },
  { label: 'International', value: 'international' },
];

function toEditableDateTime(isoValue: string | null): string {
  if (!isoValue) return '';
  return isoValue.slice(0, 16).replace('T', ' ');
}

export function TournamentFormScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const tournamentId = route.params?.tournamentId;
  const isEditing = tournamentId !== undefined;

  const [games, setGames] = useState<Game[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [values, setValues] = useState<TournamentFormValues>(emptyTournamentForm());
  const [errors, setErrors] = useState<TournamentFormErrors>({});
  const [step, setStep] = useState(0);
  const [isLoading, setIsLoading] = useState(isEditing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    Promise.all([
      gameRepository.list(db),
      countryRepository.list(db),
      tournamentId !== undefined ? tournamentRepository.getById(db, tournamentId) : Promise.resolve(null),
    ]).then(
      ([gameRows, countryRows, tournament]) => {
        if (!isCurrent) return;
        setGames(gameRows);
        setCountries(countryRows);

        if (tournamentId !== undefined) {
          if (!tournament || !canManageTournament(tournament, user?.id)) {
            setLoadError('You are not authorized to edit this tournament.');
          } else {
            setExistingStatus(tournament.status);
            setValues({
              name: tournament.name,
              description: tournament.description ?? '',
              imageUri: tournament.image_uri ?? '',
              gameId: tournament.game_id,
              countryId: tournament.country_id,
              timezone: tournament.timezone,
              startAt: toEditableDateTime(tournament.start_at),
              endAt: toEditableDateTime(tournament.end_at),
              registrationOpensAt: toEditableDateTime(tournament.registration_opens_at),
              registrationClosesAt: toEditableDateTime(tournament.registration_closes_at),
              visibility: tournament.visibility,
              scope: tournament.scope,
              format: tournament.format,
              capacity: String(tournament.capacity),
              rules: tournament.rules ?? '',
              requirements: tournament.requirements ?? '',
              prizes: tournament.prizes ?? '',
            });
          }
        }
        setIsLoading(false);
      },
      (cause: unknown) => {
        if (isCurrent) {
          setLoadError(cause instanceof Error ? cause.message : 'Unable to load this form.');
          setIsLoading(false);
        }
      },
    );

    return () => {
      isCurrent = false;
    };
  }, [db, tournamentId, user?.id]);

  function update<K extends keyof TournamentFormValues>(key: K, value: TournamentFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    const validationErrors = validateTournamentForm(values);
    const fieldsByStep: (keyof TournamentFormValues)[][] = [
      ['name'],
      ['gameId', 'countryId', 'timezone'],
      ['startAt', 'endAt', 'registrationOpensAt', 'registrationClosesAt'],
      ['format', 'capacity'],
      [],
      [],
    ];
    const currentStepFields = fieldsByStep[step];
    const stepErrors: TournamentFormErrors = {};
    for (const field of currentStepFields) {
      if (validationErrors[field]) stepErrors[field] = validationErrors[field];
    }
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSave(status: 'draft' | 'published' | 'keep') {
    const validationErrors = validateTournamentForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setStep(0);
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const input = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        image_uri: values.imageUri.trim() || null,
        game_id: values.gameId!,
        country_id: values.countryId!,
        organizer_id: user.id,
        timezone: values.timezone.trim(),
        start_at: parseLocalDateTime(values.startAt)!,
        end_at: parseLocalDateTime(values.endAt),
        registration_opens_at: parseLocalDateTime(values.registrationOpensAt),
        registration_closes_at: parseLocalDateTime(values.registrationClosesAt),
        visibility: values.visibility,
        scope: values.scope,
        format: values.format.trim(),
        capacity: Number(values.capacity),
        rules: values.rules.trim() || null,
        requirements: values.requirements.trim() || null,
        prizes: values.prizes.trim() || null,
        status: status === 'keep' ? (existingStatus as 'draft') : status,
      };

      if (isEditing) {
        await tournamentRepository.update(db, tournamentId, input);
        navigation.navigate('TournamentDetail', { tournamentId });
      } else {
        const newId = await tournamentRepository.create(db, input);
        navigation.replace('TournamentDetail', { tournamentId: newId });
      }
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'Could not save this tournament. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
        <FeedbackState kind="loading" title="Loading form" />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
        <FeedbackState
          actionLabel="Go back"
          description={loadError}
          kind="error"
          onAction={() => navigation.goBack()}
          title="Could not open this tournament"
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
          onPress={goBack}
        >
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Text accessibilityRole="header" className="text-base font-bold text-[#17231f]">
          {isEditing ? 'Edit tournament' : 'Create tournament'}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2 px-5 pt-3">
        {steps.map((label, index) => (
          <Badge key={label} label={label} tone={index === step ? 'success' : index < step ? 'accent' : 'neutral'} />
        ))}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-4" keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <Card className="gap-4 p-5">
            <Input
              error={errors.name}
              label="Tournament name"
              onChangeText={(text) => update('name', text)}
              placeholder="e.g. Winter Valorant Clash"
              value={values.name}
            />
            <Input
              label="Description"
              multiline
              onChangeText={(text) => update('description', text)}
              placeholder="What makes this tournament worth joining?"
              value={values.description}
            />
            <Input
              autoCapitalize="none"
              label="Image URL (optional)"
              onChangeText={(text) => update('imageUri', text)}
              placeholder="https://..."
              value={values.imageUri}
            />
          </Card>
        ) : null}

        {step === 1 ? (
          <Card className="gap-4 p-5">
            <Select
              error={errors.gameId}
              label="Game"
              onChange={(value) => update('gameId', value)}
              options={games.map((game) => ({ label: game.name, value: game.id }))}
              placeholder="Select a game"
              value={values.gameId}
            />
            <Select
              error={errors.countryId}
              label="Country"
              onChange={(value) => update('countryId', value)}
              options={countries.map((country) => ({ label: country.name, value: country.id }))}
              placeholder="Select a country"
              value={values.countryId}
            />
            <Input
              autoCapitalize="none"
              error={errors.timezone}
              hint="Use a UTC offset name, e.g. UTC or America/Bogota."
              label="Timezone"
              onChangeText={(text) => update('timezone', text)}
              placeholder="UTC"
              value={values.timezone}
            />
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="gap-4 p-5">
            <Input
              error={errors.startAt}
              hint="YYYY-MM-DD HH:MM"
              label="Start date and time"
              onChangeText={(text) => update('startAt', text)}
              placeholder="2026-01-01 18:00"
              value={values.startAt}
            />
            <Input
              error={errors.endAt}
              hint="Optional. YYYY-MM-DD HH:MM"
              label="End date and time"
              onChangeText={(text) => update('endAt', text)}
              placeholder="2026-01-02 20:00"
              value={values.endAt}
            />
            <Input
              error={errors.registrationOpensAt}
              hint="Optional. YYYY-MM-DD HH:MM"
              label="Registration opens"
              onChangeText={(text) => update('registrationOpensAt', text)}
              placeholder="2025-12-20 09:00"
              value={values.registrationOpensAt}
            />
            <Input
              error={errors.registrationClosesAt}
              hint="Optional. YYYY-MM-DD HH:MM"
              label="Registration closes"
              onChangeText={(text) => update('registrationClosesAt', text)}
              placeholder="2025-12-31 23:59"
              value={values.registrationClosesAt}
            />
          </Card>
        ) : null}

        {step === 3 ? (
          <Card className="gap-4 p-5">
            <Select
              error={errors.format}
              label="Format"
              onChange={(value) => update('format', value)}
              options={formatOptions}
              placeholder="Select a format"
              value={values.format}
            />
            <Input
              error={errors.capacity}
              keyboardType="number-pad"
              label="Capacity"
              onChangeText={(text) => update('capacity', text.replace(/[^0-9]/g, ''))}
              placeholder="16"
              value={values.capacity}
            />
          </Card>
        ) : null}

        {step === 4 ? (
          <Card className="gap-4 p-5">
            <Input
              label="Rules (optional)"
              multiline
              onChangeText={(text) => update('rules', text)}
              placeholder="How matches are played, tiebreakers, conduct..."
              value={values.rules}
            />
            <Input
              label="Requirements (optional)"
              multiline
              onChangeText={(text) => update('requirements', text)}
              placeholder="Minimum rank, account age, hardware..."
              value={values.requirements}
            />
            <Input
              label="Prizes (optional)"
              multiline
              onChangeText={(text) => update('prizes', text)}
              placeholder="What winners receive"
              value={values.prizes}
            />
            <Select
              label="Visibility"
              onChange={(value) => update('visibility', value)}
              options={visibilityOptions}
              value={values.visibility}
            />
            <Select
              label="Scope"
              onChange={(value) => update('scope', value)}
              options={scopeOptions}
              value={values.scope}
            />
          </Card>
        ) : null}

        {step === 5 ? (
          <View className="gap-4">
            <Card className="gap-3 p-5">
              <Text className="text-lg font-bold text-[#17231f]">{values.name || 'Untitled tournament'}</Text>
              {values.description ? <Text className="text-sm leading-5 text-[#4d5d55]">{values.description}</Text> : null}
              <ReviewRow label="Game" value={games.find((game) => game.id === values.gameId)?.name ?? '—'} />
              <ReviewRow label="Country" value={countries.find((country) => country.id === values.countryId)?.name ?? '—'} />
              <ReviewRow label="Timezone" value={values.timezone} />
              <ReviewRow label="Starts" value={values.startAt || '—'} />
              <ReviewRow label="Ends" value={values.endAt || 'Not set'} />
              <ReviewRow label="Registration window" value={values.registrationOpensAt || values.registrationClosesAt ? `${values.registrationOpensAt || '—'} to ${values.registrationClosesAt || '—'}` : 'Not set'} />
              <ReviewRow label="Format" value={formatOptions.find((option) => option.value === values.format)?.label ?? values.format} />
              <ReviewRow label="Capacity" value={values.capacity || '—'} />
              <ReviewRow label="Visibility" value={visibilityOptions.find((option) => option.value === values.visibility)?.label ?? ''} />
              <ReviewRow label="Scope" value={scopeOptions.find((option) => option.value === values.scope)?.label ?? ''} />
            </Card>

            {submitError ? (
              <View accessibilityRole="alert" className="rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
                <Text className="text-sm leading-5 text-[#872822]">{submitError}</Text>
              </View>
            ) : null}

            {isEditing && existingStatus !== 'draft' ? (
              <Button loading={isSubmitting} onPress={() => void handleSave('keep')}>
                Save changes
              </Button>
            ) : (
              <View className="gap-3">
                <Button loading={isSubmitting} onPress={() => void handleSave('draft')} variant="secondary">
                  Save as draft
                </Button>
                <Button loading={isSubmitting} onPress={() => void handleSave('published')}>
                  Publish
                </Button>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      {step < steps.length - 1 ? (
        <View className="flex-row gap-3 px-5 pb-5 pt-2">
          <View className="flex-1"><Button onPress={goBack} variant="quiet">Back</Button></View>
          <View className="flex-1"><Button onPress={goNext}>Next</Button></View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-[#65736c]">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-[#17231f]" numberOfLines={1}>{value}</Text>
    </View>
  );
}
