import { CalendarDays } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function EventsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-[#f4f6f2] px-5" edges={['top']}>
      <Text className="py-5 text-2xl font-bold text-[#17231f]">Events</Text>
      <View className="mt-3 items-center rounded-xl border border-[#dfe7e1] bg-white px-6 py-10">
        <CalendarDays color="#176b5b" size={28} />
        <Text className="mt-4 text-base font-semibold text-[#17231f]">No events yet</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-[#65736c]">
          Match schedules and tournament results will appear here.
        </Text>
      </View>
    </SafeAreaView>
  );
}