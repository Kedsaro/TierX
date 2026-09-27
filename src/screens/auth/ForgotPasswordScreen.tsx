import { ChevronLeft, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthError } from '../../auth/authService';
import { useAuth } from '../../auth/AuthProvider';
import { validateVerificationCode } from '../../auth/validation';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import type { AuthStackParamList } from '../../navigation/auth/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { authService } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendCode() {
    setMessage(null);
    try {
      await authService.sendPasswordResetCode(email.trim());
      setMessage('A password reset code was sent to your email.');
    } catch (cause) {
      setMessage(cause instanceof AuthError ? cause.message : 'Unable to request password recovery.');
    }
  }

  async function resetPassword() {
    const codeError = validateVerificationCode(code);
    if (codeError) {
      setMessage(codeError);
      return;
    }
    if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setMessage('Use at least 10 characters with lowercase, uppercase and a number.');
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      await authService.resetPassword(email.trim(), code, password);
      setMessage('Password updated. Return to sign in.');
    } catch (cause) {
      setMessage(cause instanceof AuthError ? cause.message : 'Unable to reset the password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" className="mb-7 h-11 w-11 items-center justify-center rounded-lg" onPress={() => navigation.goBack()}>
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Card className="p-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#e1eee8]">
            <KeyRound color="#176b5b" size={25} />
          </View>
          <Text accessibilityRole="header" className="mt-5 text-2xl font-bold text-[#17231f]">Reset your password</Text>
          <Text className="mt-2 text-sm leading-5 text-[#65736c]">Request a code, then enter it with your new password.</Text>
          <View className="mt-5 gap-4">
            <Input accessibilityLabel="Email address" autoCapitalize="none" keyboardType="email-address" label="Email address" onChangeText={setEmail} placeholder="name@example.com" value={email} />
            <Button onPress={() => void sendCode()} variant="secondary">Send recovery code</Button>
            <Input accessibilityLabel="6-digit recovery code" keyboardType="number-pad" label="Recovery code" maxLength={6} onChangeText={(value) => setCode(value.replace(/\D/g, ''))} placeholder="000000" value={code} />
            <Input accessibilityLabel="New password" label="New password" onChangeText={setPassword} placeholder="At least 10 characters" secureTextEntry value={password} />
            {message ? (
              <View accessibilityRole="alert" className="rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
                <Text className="text-sm leading-5 text-[#872822]">{message}</Text>
              </View>
            ) : null}
            <Button loading={isSubmitting} onPress={() => void resetPassword()}>Update password</Button>
            <Text className="text-center text-xs leading-5 text-[#65736c]">Email recovery requires a real online provider. No code is generated or sent locally.</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}