import { Text, View } from 'react-native';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-[#edf1ee] text-[#4d5d55]',
  success: 'bg-[#e1eee8] text-[#176b5b]',
  warning: 'bg-[#fff1ce] text-[#785311]',
  danger: 'bg-[#f9e4e2] text-[#9b302b]',
  accent: 'bg-[#f7e8c5] text-[#604619]',
};

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <View className={`self-start rounded-md px-2 py-1 ${toneClasses[tone]}`}>
      <Text className={`text-xs font-bold ${toneClasses[tone].split(' ').at(-1)}`}>{label}</Text>
    </View>
  );
}