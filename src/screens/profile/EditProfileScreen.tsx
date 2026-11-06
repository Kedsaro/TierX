import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../../auth/AuthProvider';
import { Button } from '../../components/ui/Button';
import { FeedbackState } from '../../components/ui/FeedbackState';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { countryRepository, gameRepository, playerRepository, preferencesRepository, userRepository } from '../../database/repositories';
import { useCurrentPlayer } from '../../hooks/useCurrentPlayer';
import type { ProfileStackParamList } from '../../navigation/tournaments/types';
import { validateProfileForm } from '../../profile/validation';
import type { ProfileFormErrors } from '../../profile/validation';
import type { Country, Game } from '../../types/catalog';
import type { ProfilePrivacy } from '../../types/profile';

type EditProfileNavigation = NativeStackNavigationProp<ProfileStackParamList, 'EditProfile'>;

const privacyOptions = [
  { label: 'Public — other players can see your profile', value: 'public' as ProfilePrivacy },
  { label: 'Private — only you can see your details', value: 'private' as ProfilePrivacy },
];

/** RF-14: edits the allowed account fields (username/email), the player profile (name, avatar, bio, country, favorite game) and the privacy/notification preferences. */
export function EditProfileScreen() {
  const db = useSQLiteContext();
  const navigation = useNavigation<EditProfileNavigation>();
  const { user, refreshUser } = useAuth();
  const { player, isLoading: isPlayerLoading } = useCurrentPlayer();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState('');
  const [countryId, setCountryId] = useState<number | undefined>(undefined);
  const [favoriteGameId, setFavoriteGameId] = useState<number | undefined>(undefined);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>('public');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [countries, setCountries] = useState<Country[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user || !player) return;
    let active = true;

    Promise.all([
      countryRepository.list(db),
      gameRepository.list(db),
      preferencesRepository.getForUser(db, user.id),
    ]).then(([countryList, gameList, preferences]) => {
      if (!active) return;
      setCountries(countryList);
      setGames(gameList);
      setUsername(user.username);
      setEmail(user.email);
      setDisplayName(player.display_name);
      setBio(player.bio ?? '');
      setAvatarUri(player.avatar_uri ?? '');
      setCountryId(player.country_id ?? undefined);
      setFavoriteGameId(player.favorite_game_id ?? undefined);
      setPrivacy(preferences.privacy);
      setNotificationsEnabled(preferences.notifications_enabled === 1);
      setIsReady(true);
    }).catch((error: unknown) => {
      console.error('Failed to load profile form.', error);
      Alert.alert('Error', 'We could not load your profile. Try again.');
      navigation.goBack();
    });

    return () => {
      active = false;
    };
  }, [db, user, player, navigation]);

  async function handleSave() {
    if (!user || !player) return;

    const validationErrors = validateProfileForm({ username, email, displayName, bio, avatarUri });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSaving(true);

    try {
      const trimmedUsername = username.trim();
      const trimmedEmail = email.trim();
      const conflictingUser = await userRepository.getByLogin(db, trimmedUsername);
      const conflictingEmail = await userRepository.getByLogin(db, trimmedEmail);
      if ((conflictingUser && conflictingUser.id !== user.id) || (conflictingEmail && conflictingEmail.id !== user.id)) {
        setErrors({ username: 'That username or email is already taken.' });
        return;
      }

      await userRepository.updateProfile(db, user.id, { username: trimmedUsername, email: trimmedEmail });
      await playerRepository.update(db, player.id, {
        display_name: displayName,
        bio,
        avatar_uri: avatarUri,
        country_id: countryId ?? null,
        favorite_game_id: favoriteGameId ?? null,
      });
      await preferencesRepository.update(db, user.id, { privacy, notifications_enabled: notificationsEnabled });
      await refreshUser();
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save profile.', error);
      Alert.alert('Error', 'We could not save your profile. Try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isPlayerLoading || !isReady) {
    return (
      <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
        <Text className="py-5 text-2xl font-bold text-[#17231f]">Edit profile</Text>
        <FeedbackState kind="loading" title="Loading your profile" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top']}>
      <ScrollView contentContainerClassName="px-5 pb-8" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 py-5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to profile"
            className="h-10 w-10 items-center justify-center rounded-lg bg-[#e1e7e2]"
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft color="#17231f" size={20} />
          </Pressable>
          <Text className="text-2xl font-bold text-[#17231f]">Edit profile</Text>
        </View>

        <View className="gap-4">
          <Text className="text-sm font-bold uppercase text-[#65736c]">Account</Text>
          <Input
            autoCapitalize="none"
            error={errors.username}
            label="Username"
            onChangeText={setUsername}
            value={username}
          />
          <Input
            autoCapitalize="none"
            error={errors.email}
            keyboardType="email-address"
            label="Email"
            onChangeText={setEmail}
            value={email}
          />

          <Text className="mt-2 text-sm font-bold uppercase text-[#65736c]">Player profile</Text>
          <Input
            error={errors.displayName}
            label="Display name"
            onChangeText={setDisplayName}
            value={displayName}
          />
          <Input
            error={errors.bio}
            hint={`${bio.length}/280`}
            label="Description"
            multiline
            onChangeText={setBio}
            value={bio}
          />
          <Input
            autoCapitalize="none"
            error={errors.avatarUri}
            hint="Paste an image URL; leave empty to use your initials."
            keyboardType="url"
            label="Avatar URL"
            onChangeText={setAvatarUri}
            value={avatarUri}
          />
          <Select<number>
            label="Country"
            onChange={setCountryId}
            options={countries.map((country) => ({ label: country.name, value: country.id }))}
            placeholder="Select a country"
            value={countryId}
          />
          <Select<number>
            label="Favorite game"
            onChange={setFavoriteGameId}
            options={games.map((game) => ({ label: game.name, value: game.id }))}
            placeholder="Select a game"
            value={favoriteGameId}
          />

          <Text className="mt-2 text-sm font-bold uppercase text-[#65736c]">Preferences</Text>
          <Select<ProfilePrivacy>
            label="Privacy"
            onChange={setPrivacy}
            options={privacyOptions}
            value={privacy}
          />
          <View className="flex-row items-center justify-between rounded-lg border border-[#ccd7cf] bg-white px-3 py-2.5">
            <Text className="text-base text-[#17231f]">Notifications</Text>
            <Switch
              accessibilityLabel="Notifications"
              onValueChange={setNotificationsEnabled}
              thumbColor={notificationsEnabled ? '#176b5b' : '#85928b'}
              trackColor={{ false: '#dfe7e1', true: '#bcd8cd' }}
              value={notificationsEnabled}
            />
          </View>

          <View className="mt-2 gap-3">
            <Button loading={isSaving} onPress={() => void handleSave()}>Save changes</Button>
            <Button disabled={isSaving} onPress={() => navigation.goBack()} variant="secondary">Cancel</Button>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
