import { CalendarDays, MapPin, Users } from 'lucide-react-native';
import { Text, View } from 'react-native';
import type { Tournament } from '../../types/tournament';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface TournamentCardProps {
  tournament: Tournament;
  gameName?: string;
  countryName?: string;
  organizerName?: string;
  onPress?: () => void;
}

const statusLabels: Record<Tournament['status'], string> = {
  draft: 'Draft',
  published: 'Open',
  ongoing: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusTones = {
  draft: 'neutral',
  published: 'success',
  ongoing: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
} as const;

export function TournamentCard({ tournament, gameName, countryName, organizerName, onPress }: TournamentCardProps) {
  const startDate = new Date(tournament.start_at);
  const dateLabel = Number.isNaN(startDate.getTime())
    ? tournament.start_at
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(startDate);

  return (
    <Card className="p-4" onPress={onPress} accessibilityLabel={`Open ${tournament.name}`}>
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-bold text-[#17231f]" numberOfLines={2}>{tournament.name}</Text>
          <Text className="mt-1 text-sm text-[#65736c]" numberOfLines={1}>
            {gameName ?? `Game ${tournament.game_id}`}{organizerName ? ` · ${organizerName}` : ''}
          </Text>
        </View>
        <Badge label={statusLabels[tournament.status]} tone={statusTones[tournament.status]} />
      </View>
      {tournament.description ? (
        <Text className="mt-3 text-sm leading-5 text-[#4d5d55]" numberOfLines={2}>{tournament.description}</Text>
      ) : null}
      <View className="mt-4 flex-row flex-wrap gap-x-4 gap-y-2">
        <Meta icon={<CalendarDays color="#176b5b" size={15} />} label={dateLabel} />
        <Meta icon={<Users color="#176b5b" size={15} />} label={`Up to ${tournament.capacity}`} />
        {countryName ? <Meta icon={<MapPin color="#176b5b" size={15} />} label={countryName} /> : null}
      </View>
    </Card>
  );
}

function Meta({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {icon}
      <Text className="text-xs text-[#65736c]">{label}</Text>
    </View>
  );
}