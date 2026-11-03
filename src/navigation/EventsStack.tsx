import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { EventsScreen } from '../screens/EventsScreen';
import { BracketScreen } from '../screens/events/BracketScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import { TournamentDetailScreen } from '../screens/tournaments/TournamentDetailScreen';
import { TournamentFormScreen } from '../screens/tournaments/TournamentFormScreen';
import type { EventsStackParamList } from './events/types';

const Stack = createNativeStackNavigator<EventsStackParamList>();

/**
 * Keeping `EventsMain` mounted below `EventDetail`/`Bracket` is what
 * preserves the active tab and scroll position when an event or its bracket
 * is opened and closed (RF-18). `TournamentDetail`/`TournamentForm` are also
 * registered here (duplicated from `HomeStack`/`TournamentsStack`) so an
 * event's related tournament is reachable without leaving this tab.
 */
export function EventsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f4f6f2' },
      }}
    >
      <Stack.Screen name="EventsMain" component={EventsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="Bracket" component={BracketScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <Stack.Screen name="TournamentForm" component={TournamentFormScreen} />
    </Stack.Navigator>
  );
}
