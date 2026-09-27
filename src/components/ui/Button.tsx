import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';

interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  className?: string;
}

const variantClasses: Record<ButtonVariant, { container: string; text: string }> = {
  primary: { container: 'bg-[#176b5b]', text: 'text-white' },
  secondary: { container: 'bg-[#e1eee8]', text: 'text-[#17483e]' },
  quiet: { container: 'bg-transparent', text: 'text-[#176b5b]' },
  danger: { container: 'bg-[#a93232]', text: 'text-white' },
};

export function Button({
  children,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  className = '',
}: ButtonProps) {
  const styles = variantClasses[variant];
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-lg px-4 py-2 ${styles.container} ${unavailable ? 'opacity-50' : 'active:opacity-80'} ${className}`}
      disabled={unavailable}
      onPress={onPress}
    >
      {loading ? <ActivityIndicator color={variant === 'secondary' || variant === 'quiet' ? '#176b5b' : '#ffffff'} /> : icon}
      <Text className={`text-sm font-bold ${styles.text}`}>{children}</Text>
    </Pressable>
  );
}