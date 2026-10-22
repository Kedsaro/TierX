import { ArrowRight, ShieldCheck, Trophy, Trash2, UserPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/authService';
import { validateLogin } from '../../auth/validation';
import { cleanupTestUsers, listAllUsers, createTestUser } from '../../utils/databaseCleanup';
import { useSQLiteContext } from 'expo-sqlite';
import type { AuthStackParamList } from '../../navigation/auth/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const db = useSQLiteContext();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  async function handleSignIn() {
    const validationError = validateLogin(login, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await signIn(login, password);
    } catch (cause) {
      setError(cause instanceof AuthError ? cause.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleListUsers() {
    try {
      const result = await listAllUsers(db);
      Alert.alert('Users in Database', result.message);
    } catch (error) {
      Alert.alert('Error', 'Failed to list users');
      console.error(error);
    }
  }

  async function handleCleanupUsers() {
    Alert.alert(
      'Delete All Users',
      'This will delete ALL users from the database. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cleanupTestUsers(db);
              Alert.alert('Cleanup Complete', `Deleted ${result.deleted} users`);
            } catch (error) {
              Alert.alert('Error', 'Failed to cleanup users');
              console.error(error);
            }
          },
        },
      ],
    );
  }

  async function handleCreateTestUser() {
    if (!testEmail || !testEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Validate email format (no spaces, proper format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address without spaces');
      return;
    }

    // Clean the email
    const cleanEmail = testEmail.trim().toLowerCase();

    try {
      const result = await createTestUser(db, cleanEmail);
      Alert.alert(
        'Test User Created',
        `Username: ${result.user.username}\nPassword: ${result.password}\nEmail: ${result.user.email}\n\nThe account is active and ready to sign in.`,
      );
      // Pre-fill the login form
      setLogin(result.user.username);
      setPassword(result.password);
      setTestEmail(''); // Clear the test email field
    } catch (error) {
      Alert.alert('Error', 'Failed to create test user');
      console.error(error);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
        <View className="mb-8">
          <View className="mb-5 h-14 w-14 items-center justify-center rounded-2xl bg-[#173d35]">
            <Trophy color="#f2bd56" size={27} />
          </View>
          <Text className="text-xs font-bold uppercase tracking-[2px] text-[#176b5b]">TierX</Text>
          <Text accessibilityRole="header" className="mt-2 text-3xl font-bold text-[#17231f]">
            Welcome back.
          </Text>
          <Text className="mt-2 text-base leading-6 text-[#65736c]">
            Sign in to your local tournament arena.
          </Text>
        </View>

        <Card className="gap-4 p-5">
          <Input
            accessibilityLabel="Username or email"
            autoCapitalize="none"
            autoComplete="username"
            label="Username or email"
            onChangeText={setLogin}
            placeholder="name@example.com"
            returnKeyType="next"
            value={login}
          />
          <Input
            accessibilityLabel="Password"
            autoComplete="password"
            label="Password"
            onChangeText={setPassword}
            placeholder="Enter your password"
            returnKeyType="done"
            secureTextEntry
            value={password}
            onSubmitEditing={() => void handleSignIn()}
          />
          {error ? (
            <View accessibilityRole="alert" className="rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
              <Text className="text-sm leading-5 text-[#872822]">{error}</Text>
            </View>
          ) : null}
          <Button 
            loading={isSubmitting} 
            onPress={() => void handleSignIn()}
          >
            Sign in
          </Button>
        </Card>

        <View className="mt-5 flex-row items-center justify-center gap-2 rounded-lg px-3 py-2">
          <ShieldCheck color="#176b5b" size={16} />
          <Text className="text-xs text-[#65736c]">Your password stays protected on this device.</Text>
        </View>
        <>
          <Pressable className="mt-5 min-h-12 flex-row items-center justify-center gap-2" onPress={() => navigation.navigate('Register')}>
            <Text className="text-sm text-[#4d5d55]">New to TierX?</Text>
            <Text className="text-sm font-bold text-[#176b5b]">Create an account</Text>
            <ArrowRight color="#176b5b" size={16} />
          </Pressable>
          
          {__DEV__ && (
            <View className="mt-8 gap-3">
              <Text className="text-center text-xs font-semibold text-[#65736c] uppercase">Developer Tools</Text>
              
              <View className="flex-row gap-2">
                <Pressable 
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#e1e7e2] px-4 py-3"
                  onPress={() => void handleListUsers()}
                >
                  <Text className="text-sm font-semibold text-[#176b5b]">List Users</Text>
                </Pressable>
                <Pressable 
                  className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-[#f9e4e2] px-4 py-3"
                  onPress={() => void handleCleanupUsers()}
                >
                  <Trash2 color="#872822" size={16} />
                  <Text className="text-sm font-semibold text-[#872822]">Delete All</Text>
                </Pressable>
              </View>

              <Card className="gap-2 p-3">
                <Text className="text-xs font-semibold text-[#65736c]">Create Test User</Text>
                <TextInput
                  className="rounded-lg border border-[#e1e7e2] bg-white px-3 py-2 text-sm"
                  placeholder="Enter email for test user"
                  value={testEmail}
                  onChangeText={setTestEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Pressable 
                  className="flex-row items-center justify-center gap-2 rounded-lg bg-[#176b5b] px-4 py-3"
                  onPress={() => void handleCreateTestUser()}
                >
                  <UserPlus color="white" size={16} />
                  <Text className="text-sm font-semibold text-white">Create Test User</Text>
                </Pressable>
              </Card>
            </View>
          )}
        </>
      </ScrollView>
    </SafeAreaView>
  );
}