import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from './Button';
import { Card } from './Card';

type FeedbackKind = 'loading' | 'empty' | 'error';

interface FeedbackStateProps {
  kind: FeedbackKind;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function FeedbackState({ kind, title, description, actionLabel, onAction }: FeedbackStateProps) {
  const Icon = kind === 'empty' ? Inbox : kind === 'error' ? AlertCircle : LoaderCircle;
  const iconColor = kind === 'error' ? '#a93232' : '#176b5b';

  return (
    <Card className="w-full items-center px-5 py-8">
      {kind === 'loading' ? <ActivityIndicator color={iconColor} size="large" /> : <Icon color={iconColor} size={27} />}
      <Text accessibilityRole="header" className="mt-4 text-center text-base font-bold text-[#17231f]">{title}</Text>
      {description ? <Text className="mt-2 max-w-sm text-center text-sm leading-5 text-[#65736c]">{description}</Text> : null}
      {actionLabel && onAction ? (
        <View className="mt-4 min-w-36">
          <Button onPress={onAction} variant="secondary">{actionLabel}</Button>
        </View>
      ) : null}
    </Card>
  );
}