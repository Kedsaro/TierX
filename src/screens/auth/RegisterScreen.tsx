import { Check, ChevronLeft, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/AuthProvider';
import { AuthError } from '../../auth/authService';
import { validateRegistration } from '../../auth/validation';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { AuthStackParamList } from '../../navigation/auth/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validateRegistration>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRegister() {
    const values = { username, email, password, confirmPassword, acceptedTerms };
    const validationErrors = validateRegistration(values);
    setErrors(validationErrors);
    setSubmitError(null);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSubmitting(true);
    try {
      const result = await register({ username, email, password, acceptedTerms });
      navigation.replace('Verification', { email: result.email });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to create your account.';
      setSubmitError(cause instanceof AuthError && cause.code === 'EMAIL_PROVIDER_UNAVAILABLE'
        ? message
        : 'An account with this username or email may already exist. Check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8 pt-3" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" className="mb-5 h-11 w-11 items-center justify-center rounded-lg" onPress={() => navigation.goBack()}>
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Text className="text-xs font-bold uppercase tracking-[2px] text-[#176b5b]">TierX account</Text>
        <Text accessibilityRole="header" className="mt-2 text-3xl font-bold text-[#17231f]">Join your arena.</Text>
        <Text className="mt-2 text-sm leading-5 text-[#65736c]">Create an account to enter and organize local tournaments.</Text>

        <Card className="mt-6 gap-4 p-5">
          <Input
            accessibilityLabel="Username"
            autoCapitalize="none"
            autoComplete="username-new"
            error={errors.username}
            label="Username"
            maxLength={24}
            onChangeText={setUsername}
            placeholder="Choose a username"
            value={username}
          />
          <Input
            accessibilityLabel="Email address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
            keyboardType="email-address"
            label="Email address"
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />
          <Input
            accessibilityLabel="Password"
            autoComplete="new-password"
            error={errors.password}
            label="Password"
            onChangeText={setPassword}
            hint="10-128 characters; include uppercase, lowercase and a number."
            placeholder="Create a password"
            secureTextEntry
            value={password}
          />
          <Input
            accessibilityLabel="Confirm password"
            error={errors.confirmPassword}
            label="Confirm password"
            onChangeText={setConfirmPassword}
            placeholder="Enter your password again"
            secureTextEntry
            value={confirmPassword}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: acceptedTerms }}
            className="min-h-12 flex-row items-center gap-3 py-1"
            onPress={() => setAcceptedTerms((value) => !value)}
          >
            <View className={`h-6 w-6 items-center justify-center rounded border ${acceptedTerms ? 'border-[#176b5b] bg-[#176b5b]' : 'border-[#9aa79f] bg-white'}`}>
              {acceptedTerms ? <Check color="#ffffff" size={16} strokeWidth={3} /> : null}
            </View>
            <Text className="flex-1 text-sm leading-5 text-[#4d5d55]">I accept the Terms of Service and Privacy Policy.</Text>
          </Pressable>
          {errors.acceptedTerms ? <Text accessibilityRole="alert" className="-mt-3 text-sm text-[#a93232]">{errors.acceptedTerms}</Text> : null}

          {submitError ? (
            <View accessibilityRole="alert" className="rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
              <Text className="text-sm leading-5 text-[#872822]">{submitError}</Text>
            </View>
          ) : null}
          <Button loading={isSubmitting} onPress={() => void handleRegister()}>Create account</Button>
        </Card>

        <View className="mt-4 flex-row items-start gap-2 px-1">
          <ShieldCheck color="#176b5b" size={17} />
          <Text className="flex-1 text-xs leading-5 text-[#65736c]">Passwords are stored as Argon2id hashes. Email verification requires an online provider.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}