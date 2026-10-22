import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from '../screens/HomeScreen';
import { TournamentDetailScreen } from '../screens/tournaments/TournamentDetailScreen';
import { TournamentFormScreen } from '../screens/tournaments/TournamentFormScreen';
import type { HomeStackParamList } from './tournaments/types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

/**
 * Keeping `HomeMain` mounted below `TournamentDetail` in this stack is what
 * preserves Home's scroll position and search state when a tournament
 * detail is opened and closed (RF-18).
 */
export function HomeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f4f6f2' },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <Stack.Screen name="TournamentForm" component={TournamentFormScreen} />
    </Stack.Navigator>
  );
}
