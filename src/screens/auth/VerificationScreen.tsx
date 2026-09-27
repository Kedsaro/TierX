import { ChevronLeft, MailCheck } from 'lucide-react-native';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'Verification'>;

export function VerificationScreen({ navigation, route }: Props) {
  const { authService } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const email = route.params.email;

  async function handleVerify() {
    const validationError = validateVerificationCode(code);
    if (validationError) {
      setMessage(validationError);
      return;
    }
    setIsSubmitting(true);
    try {
      await authService.verifyEmail(email, code);
      setMessage('Email verified. You can now sign in.');
    } catch (cause) {
      setMessage(cause instanceof AuthError ? cause.message : 'Unable to verify this code.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    try {
      await authService.sendVerificationCode(email);
      setMessage('A new verification code was sent.');
    } catch (cause) {
      setMessage(cause instanceof AuthError ? cause.message : 'Unable to send a verification code.');
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top', 'bottom']}>
      <ScrollView className="flex-1" contentContainerClassName="grow justify-center px-6 py-8" keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityLabel="Back to registration" className="mb-7 h-11 w-11 items-center justify-center rounded-lg" onPress={() => navigation.goBack()}>
          <ChevronLeft color="#26352e" size={24} />
        </Pressable>
        <Card className="items-center p-6">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-[#e1eee8]">
            <MailCheck color="#176b5b" size={27} />
          </View>
          <Text accessibilityRole="header" className="mt-5 text-center text-2xl font-bold text-[#17231f]">Verify your email</Text>
          <Text className="mt-2 text-center text-sm leading-5 text-[#65736c]">Enter the 6-digit code sent to {email}.</Text>
          <View className="mt-6 w-full">
            <Input
              accessibilityLabel="6-digit verification code"
              autoComplete="one-time-code"
              error={message && /^Enter the/.test(message) ? message : undefined}
              keyboardType="number-pad"
              label="Verification code"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
              placeholder="000000"
              textContentType="oneTimeCode"
              value={code}
            />
          </View>
          {message && !/^Enter the/.test(message) ? (
            <View accessibilityRole="alert" className="mt-4 w-full rounded-lg border border-[#efc5c1] bg-[#f9e4e2] p-3">
              <Text className="text-sm leading-5 text-[#872822]">{message}</Text>
            </View>
          ) : null}
          <View className="mt-5 w-full"><Button loading={isSubmitting} onPress={() => void handleVerify()}>Verify email</Button></View>
          <Pressable className="mt-4 min-h-11 items-center justify-center px-3" onPress={() => void handleResend()}>
            <Text className="text-sm font-semibold text-[#176b5b]">Resend code</Text>
          </Pressable>
          <Text className="mt-3 text-center text-xs leading-5 text-[#65736c]">Email delivery is not configured yet. Your account remains unverified until a real verification provider is connected.</Text>
          <Pressable className="mt-4 min-h-11 justify-center" onPress={() => navigation.popToTop()}>
            <Text className="text-sm font-semibold text-[#176b5b]">Back to sign in</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}