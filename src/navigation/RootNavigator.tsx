import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CalendarDays, House, Trophy, UserRound } from 'lucide-react-native';
import { EventsScreen } from '../screens/EventsScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TournamentsScreen } from '../screens/TournamentsScreen';

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
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const Icon = tabIcons[route.name];

        return {
          headerShown: false,
          tabBarActiveTintColor: '#176b5b',
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Tournaments" component={TournamentsScreen} />
      <Tab.Screen name="Events" component={EventsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}