import { Text, View } from 'react-native';
import type { RankingWithPlayer } from '../../types/player';
import { Badge } from '../ui/Badge';

interface RankingRowProps {
  ranking: RankingWithPlayer;
  position: number;
}

export function RankingRow({ ranking, position }: RankingRowProps) {
  const record = `${ranking.wins}W · ${ranking.losses}L`;

  return (
    <View className="min-h-16 flex-row items-center gap-3 border-b border-[#e7ece8] py-3">
      <Text className="w-8 text-center text-sm font-bold text-[#176b5b]">{position}</Text>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-[#17231f]" numberOfLines={1}>{ranking.display_name}</Text>
        <Text className="mt-1 text-xs text-[#65736c]">{record}</Text>
      </View>
      <Badge label={`${ranking.rating} RP`} tone="accent" />
    </View>
  );
}