import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

interface CardProps {
  children: ReactNode;
  className?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Card({ children, className = '', onPress, accessibilityLabel }: CardProps) {
  const classes = `rounded-xl border border-[#dfe7e1] bg-white ${className}`;

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={`${classes} active:opacity-80`}
        onPress={onPress}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={classes}>{children}</View>;
}