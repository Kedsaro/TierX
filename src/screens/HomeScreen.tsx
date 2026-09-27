import { ArrowRight, CalendarDays, Sparkles } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../navigation/RootNavigator';

type Props = BottomTabScreenProps<RootTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2]" edges={['top']}>
      <ScrollView className="flex-1" contentContainerClassName="px-5 pb-8">
        <View className="flex-row items-center justify-between py-5">
          <View>
            <Text className="text-xs font-bold uppercase tracking-[2px] text-[#176b5b]">TierX</Text>
            <Text className="mt-1 text-2xl font-bold text-[#17231f]">Your local arena</Text>
          </View>
          <View className="h-11 w-11 items-center justify-center rounded-full bg-[#e1eee8]">
            <TrophyMark />
          </View>
        </View>

        <View className="rounded-2xl bg-[#173d35] p-5">
          <View className="flex-row items-center gap-2">
            <Sparkles color="#f2bd56" size={17} />
            <Text className="text-xs font-bold uppercase tracking-[1.5px] text-[#c7ddd3]">Tournament desk</Text>
          </View>
          <Text className="mt-4 text-2xl font-bold text-white">Make your next match count.</Text>
          <Text className="mt-2 text-sm leading-5 text-[#d4e4dc]">
            Keep local competitions, schedules and player rankings in one place.
          </Text>
          <Pressable
            accessibilityRole="button"
            className="mt-5 min-h-12 flex-row items-center justify-center gap-2 rounded-xl bg-[#f2bd56] px-4"
            onPress={() => navigation.navigate('Tournaments')}
          >
            <Text className="font-bold text-[#20281f]">Explore tournaments</Text>
            <ArrowRight color="#20281f" size={18} />
          </Pressable>
        </View>

        <View className="mt-8 flex-row items-center justify-between">
          <Text className="text-lg font-bold text-[#17231f]">Upcoming</Text>
          <CalendarDays color="#176b5b" size={20} />
        </View>
        <View className="mt-3 rounded-xl border border-[#dfe7e1] bg-white px-4 py-5">
          <Text className="font-semibold text-[#17231f]">No upcoming tournaments</Text>
          <Text className="mt-1 text-sm leading-5 text-[#65736c]">
            Tournaments you join or organize will appear here.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TrophyMark() {
  return <Text className="text-base font-bold text-[#176b5b]">TX</Text>;
}