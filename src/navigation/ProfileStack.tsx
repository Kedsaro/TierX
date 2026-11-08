import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AdminScreen } from '../screens/admin/AdminScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { BracketScreen } from '../screens/events/BracketScreen';
import { EventDetailScreen } from '../screens/events/EventDetailScreen';
import { TournamentDetailScreen } from '../screens/tournaments/TournamentDetailScreen';
import { TournamentFormScreen } from '../screens/tournaments/TournamentFormScreen';
import { ManageParticipantsScreen } from '../screens/tournaments/ManageParticipantsScreen';
import type { ProfileStackParamList } from './tournaments/types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

/**
 * Keeping `ProfileMain` mounted below `TournamentDetail` preserves the
 * profile's scroll position when a tournament from the history, the
 * "created" or the "participating" lists is opened and closed (RF-18).
 */
export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#f4f6f2' },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="Admin" component={AdminScreen} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
      <Stack.Screen name="TournamentForm" component={TournamentFormScreen} />
      <Stack.Screen name="ManageParticipants" component={ManageParticipantsScreen} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} />
      <Stack.Screen name="Bracket" component={BracketScreen} />
    </Stack.Navigator>
  );
}
