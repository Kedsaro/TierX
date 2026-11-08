import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
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
import { countryRepository, gameRepository, settingsRepository, tournamentRepository, userRepository } from '../../database/repositories';
import { canManageTournament } from '../../tournaments/authorization';
import { timezoneLabel, timezonesForCountryCode } from '../../tournaments/timezones';
import {
  emptyTournamentForm,
  generateAccessCode,
  minimumScheduleDateTime,
  parseLocalDateTime,
  parseScheduleDate,
  validateTournamentForm,
} from '../../tournaments/validation';
import type { TournamentFormErrors, TournamentFormValues } from '../../tournaments/validation';
import type { TournamentDetailParams } from '../../navigation/tournaments/types';
import type { Country, Game } from '../../types/catalog';
import type { TournamentScope, TournamentVisibility } from '../../types/tournament';

type Props = NativeStackScreenProps<TournamentDetailParams, 'TournamentForm'>;

const steps = ['General', 'Game & location', 'Dates', 'Rules & prizes', 'Review'] as const;

const formatOptions = [
  { label: 'Single elimination', value: 'single_elimination' },
  { label: 'Double elimination', value: 'double_elimination' },
  { label: 'Round robin', value: 'round_robin' },
];

const tournamentTypeOptions: { label: string; value: TournamentVisibility }[] = [
  { label: 'Non-competitive', value: 'public' },
  { label: 'Competitive', value: 'private' },
];

const visibilityOptions: { label: string; value: TournamentVisibility }[] = [
  { label: 'Public', value: 'public' },
  { label: 'Unlisted', value: 'unlisted' },
  { label: 'Private', value: 'private' },
];

const scopeOptions: { label: string; value: TournamentScope }[] = [
  { label: 'National', value: 'national' },
  { label: 'International', value: 'international' },
];

function toEditableDateTime(isoValue: string | null): string {
  if (!isoValue) return '';
  return isoValue.slice(0, 16).replace('T', ' ');
}

export function TournamentFormScreen({ route, navigation }: Props) {
  const db = useSQLiteContext();
  const { user, refreshUser } = useAuth();
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
  const minScheduleDate = useMemo(() => minimumScheduleDateTime(), []);
  // Registration (unlike the tournament's own start/end) may open the same
  // day: its only floor is "not earlier than now".
  const nowFloor = useMemo(() => new Date(), []);

  // The tournament must last at least 1 day: the end date/time must be at
  // least 24 hours after the start, on top of the RF-20 "Hoy + 24h" floor.
  // Recompute whenever the start field changes so the end picker's
  // calendar/clock cannot land on a shorter duration.
  const endMinimumDate = useMemo(() => {
    const startDate = parseScheduleDate(values.startAt);
    if (!startDate) return minScheduleDate;
    const oneDayAfterStart = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
    return oneDayAfterStart > minScheduleDate ? oneDayAfterStart : minScheduleDate;
  }, [values.startAt, minScheduleDate]);

  // Registration must close at least 24 hours before the tournament starts
  // (which also guarantees it never lands after the start). The start field
  // is bounded below by "registration closes + 24h", and the registration
  // closing field is bounded above by "start - 24h", so neither picker lets
  // the user choose a combination the validator would reject afterwards.
  const startMinimumDate = useMemo(() => {
    const closesDate = parseScheduleDate(values.registrationClosesAt);
    if (!closesDate) return minScheduleDate;
    const oneDayAfterClose = new Date(closesDate.getTime() + 24 * 60 * 60 * 1000);
    return oneDayAfterClose > minScheduleDate ? oneDayAfterClose : minScheduleDate;
  }, [values.registrationClosesAt, minScheduleDate]);

  const registrationClosesMaximumDate = useMemo(() => {
    const startDate = parseScheduleDate(values.startAt);
    if (!startDate) return undefined;
    return new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  }, [values.startAt]);

  // Registration must stay open for at least 1 hour: the closing field's
  // lower bound is "registration opens + 1h", falling back to "now" when
  // no opening date has been chosen yet.
  const registrationClosesMinimumDate = useMemo(() => {
    const opensDate = parseScheduleDate(values.registrationOpensAt);
    if (!opensDate) return nowFloor;
    const oneHourAfterOpen = new Date(opensDate.getTime() + 60 * 60 * 1000);
    return oneHourAfterOpen > nowFloor ? oneHourAfterOpen : nowFloor;
  }, [values.registrationOpensAt, nowFloor]);

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
          if (!tournament || !canManageTournament(tournament, user?.id, user?.role)) {
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
              accessCode: tournament.access_code ?? '',
              scope: tournament.scope,
              format: tournament.format,
              capacity: String(tournament.capacity),
              rules: tournament.rules ?? '',
              requirements: tournament.requirements ?? '',
              hasPrize: tournament.prizes !== null && tournament.prizes !== '',
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
  }, [db, tournamentId, user?.id, user?.role]);

  function update<K extends keyof TournamentFormValues>(key: K, value: TournamentFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  const selectedCountry = countries.find((country) => country.id === values.countryId);
  const timezoneOptions = timezonesForCountryCode(selectedCountry?.code);

  function handleCountryChange(countryId: number) {
    const country = countries.find((item) => item.id === countryId);
    const allowed = timezonesForCountryCode(country?.code);
    setValues((prev) => ({
      ...prev,
      countryId,
      timezone: allowed.includes(prev.timezone) ? prev.timezone : allowed.length === 1 ? allowed[0] : '',
    }));
  }

  function handleVisibilityChange(visibility: TournamentVisibility) {
    setValues((prev) => ({
      ...prev,
      visibility,
      // Private tournaments gate registration behind an 8-digit code;
      // prefill one so organizers can just share it (still editable).
      accessCode: visibility === 'private' && !prev.accessCode ? generateAccessCode() : prev.accessCode,
    }));
  }

  function goNext() {
    const validationErrors = validateTournamentForm(values, timezoneOptions);
    const fieldsByStep: (keyof TournamentFormValues)[][] = [
      ['name', 'accessCode'],
      ['gameId', 'countryId', 'timezone'],
      ['startAt', 'endAt', 'registrationOpensAt', 'registrationClosesAt'],
      ['format', 'capacity'],
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

  function handleDiscard() {
    Alert.alert('Discard tournament', 'Everything you entered will be lost. Are you sure?', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  }

  function goBack() {
    if (step === 0) {
      navigation.goBack();
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  }

  async function handleSave(status: 'draft' | 'published' | 'keep') {
    const validationErrors = validateTournamentForm(values, timezoneOptions);
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
        access_code: values.visibility === 'private' ? values.accessCode.trim() : null,
        scope: values.scope,
        format: values.format.trim(),
        capacity: Number(values.capacity),
        rules: values.rules.trim() || null,
        requirements: values.requirements.trim() || null,
        prizes: values.hasPrize ? values.prizes.trim() || null : null,
        status: status === 'keep' ? (existingStatus as 'draft') : status,
      };

      if (isEditing) {
        await tournamentRepository.update(db, tournamentId, input);
        navigation.navigate('TournamentDetail', { tournamentId });
      } else {
        if (!(await settingsRepository.isEnabled(db, 'tournament_creation_enabled'))) {
          setSubmitError('Tournament creation is temporarily disabled by an administrator.');
          return;
        }
        const newId = await tournamentRepository.create(db, input);
        // RF-16: creating a tournament promotes a plain user to organizer.
        if (user.role === 'user') {
          await userRepository.updateRole(db, user.id, 'organizer');
          await refreshUser();
        }
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
            <Select
              label="Visibility"
              onChange={handleVisibilityChange}
              options={visibilityOptions}
              value={values.visibility}
            />
            <Select
              label="Tournament type"
              onChange={handleVisibilityChange}
              options={tournamentTypeOptions}
              value={values.visibility}
            />
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
            {values.visibility === 'private' ? (
              <Input
                error={errors.accessCode}
                hint="Players must enter this code to register. Share it only with invited players."
                keyboardType="number-pad"
                label="Access code"
                maxLength={8}
                onChangeText={(text) => update('accessCode', text.replace(/[^0-9]/g, ''))}
                placeholder="8 digits"
                value={values.accessCode}
              />
            ) : null}
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
              onChange={handleCountryChange}
              options={countries.map((country) => ({ label: country.name, value: country.id }))}
              placeholder="Select a country"
              value={values.countryId}
            />
            <Select
              disabled={!selectedCountry}
              label="Scope"
              onChange={(value) => update('scope', value)}
              options={scopeOptions}
              placeholder={selectedCountry ? 'Select a scope' : 'Select a country first'}
              value={values.scope}
            />
            <Select
              error={errors.timezone}
              label="Timezone"
              onChange={(value) => update('timezone', value)}
              options={timezoneOptions.map((timezone) => ({ label: timezoneLabel(timezone), value: timezone }))}
              placeholder={selectedCountry ? 'Select a timezone' : 'Select a country first'}
              value={values.timezone}
            />
          </Card>
        ) : null}

        {step === 2 ? (
          <Card className="gap-4 p-5">
            <DateTimeField
              error={errors.registrationOpensAt}
              hint="The tournament can start today, but not earlier than the current time."
              label="Registration opens"
              minimumDate={nowFloor}
              onChange={(value) => update('registrationOpensAt', value)}
              value={values.registrationOpensAt}
            />
            <DateTimeField
              error={errors.registrationClosesAt}
              hint="The registration must last at least 1 hour."
              label="Registration closes"
              maximumDate={registrationClosesMaximumDate}
              minimumDate={registrationClosesMinimumDate}
              onChange={(value) => update('registrationClosesAt', value)}
              value={values.registrationClosesAt}
            />
            <DateTimeField
              error={errors.startAt}
              hint="The tournament must start at least 24 hours after registration closes."
              label="Start date and time"
              minimumDate={startMinimumDate}
              onChange={(value) => update('startAt', value)}
              value={values.startAt}
            />
            <DateTimeField
              error={errors.endAt}
              hint="The tournament must last at least 24 hours."
              label="End date and time"
              minimumDate={endMinimumDate}
              onChange={(value) => update('endAt', value)}
              value={values.endAt}
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
            <Select
              label="Are there prizes?"
              onChange={(value) => update('hasPrize', value === 'yes')}
              options={[{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]}
              value={values.hasPrize ? 'yes' : 'no'}
            />
            {values.hasPrize ? (
              <Input
                label="Prizes"
                multiline
                onChangeText={(text) => update('prizes', text)}
                placeholder="What winners receive"
                value={values.prizes}
              />
            ) : null}
          </Card>
        ) : null}

        {step === 4 ? (
          <View className="gap-4">
            <Card className="gap-3 p-5">
              <Text className="text-lg font-bold text-[#17231f]">{values.name || 'Untitled tournament'}</Text>
              {values.description ? <Text className="text-sm leading-5 text-[#4d5d55]">{values.description}</Text> : null}
              <ReviewRow label="Game" value={games.find((game) => game.id === values.gameId)?.name ?? '—'} />
              <ReviewRow label="Country" value={countries.find((country) => country.id === values.countryId)?.name ?? '—'} />
              <ReviewRow label="Scope" value={scopeOptions.find((option) => option.value === values.scope)?.label ?? ''} />
              <ReviewRow label="Timezone" value={values.timezone} />
              <ReviewRow label="Registration opens" value={values.registrationOpensAt || 'Not set'} />
              <ReviewRow label="Registration closes" value={values.registrationClosesAt || 'Not set'} />
              <ReviewRow label="Starts" value={values.startAt || '—'} />
              <ReviewRow label="Ends" value={values.endAt || 'Not set'} />
              <ReviewRow label="Format" value={formatOptions.find((option) => option.value === values.format)?.label ?? values.format} />
              <ReviewRow label="Capacity" value={values.capacity || '—'} />
              <ReviewRow label="Tournament type" value={tournamentTypeOptions.find((option) => option.value === values.visibility)?.label ?? '—'} />
              <ReviewRow label="Visibility" value={visibilityOptions.find((option) => option.value === values.visibility)?.label ?? ''} />
              {values.visibility === 'private' ? <ReviewRow label="Access code" value={values.accessCode || '—'} /> : null}
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
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button onPress={handleDiscard} variant="danger">
                      Discard
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button loading={isSubmitting} onPress={() => void handleSave('published')}>
                      Publish
                    </Button>
                  </View>
                </View>
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
