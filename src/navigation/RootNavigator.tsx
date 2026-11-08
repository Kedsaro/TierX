import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, House, Trophy, UserRound } from 'lucide-react-native';
import { useAuth } from '../auth/AuthProvider';
import { EventsStack } from './EventsStack';
import { HomeStack } from './HomeStack';
import { ProfileStack } from './ProfileStack';
import { TournamentsStack } from './TournamentsStack';

export type RootTabParamList = {
  Home: undefined;
  Tournaments: undefined;
  Events: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const tabIcons = {
  Home: House,
  Tournaments: Trophy,
  Events: CalendarDays,
  Profile: UserRound,
};

export function RootNavigator() {
  const { user } = useAuth();
  // Keying by user id forces every tab screen to remount on login/logout, so
  // all lists and screens fetch fresh data for the new session.
  return (
    <Tab.Navigator
      key={user?.id ?? 'guest'}
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const Icon = tabIcons[route.name];

        return {
          headerShown: false,
          tabBarActiveTintColor: '#176b5b',
          tabBarActiveBackgroundColor: '#dfe7e1',
          tabBarInactiveTintColor: '#718079',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
          tabBarStyle: {
            height: 68,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopColor: '#e1e7e2',
            backgroundColor: '#ffffff',
          },
          tabBarIcon: ({ color, size }) => <Icon color={color} size={size} strokeWidth={2} />,
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Tournaments" component={TournamentsStack} />
      <Tab.Screen name="Events" component={EventsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}