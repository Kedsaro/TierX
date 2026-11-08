import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TournamentsScreen } from '../screens/TournamentsScreen';
import { BracketScreen } from '../screens/events/BracketScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import { TournamentDetailScreen } from '../screens/tournaments/TournamentDetailScreen';
import { TournamentFormScreen } from '../screens/tournaments/TournamentFormScreen';
import { ManageParticipantsScreen } from '../screens/tournaments/ManageParticipantsScreen';
import type { TournamentsStackParamList } from './tournaments/types';

const Stack = createNativeStackNavigator<TournamentsStackParamList>();

/**
 * Keeping `TournamentsMain` mounted below `TournamentDetail` in this stack is
 * what preserves the active segment, search text, filters and scroll
 * position when a tournament detail is opened and closed (RF-18).
 */
export function TournamentsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f4f6f2' },
      }}
    >
      <Stack.Screen name="TournamentsMain" component={TournamentsScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <Stack.Screen name="TournamentForm" component={TournamentFormScreen} />
      <Stack.Screen name="ManageParticipants" component={ManageParticipantsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="Bracket" component={BracketScreen} />
    </Stack.Navigator>
  );
}
