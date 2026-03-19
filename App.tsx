import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import LiveMonitor from './src/screens/LiveMonitor';
import History from './src/screens/History';
import SessionDetail from './src/screens/SessionDetail';
import Settings from './src/screens/Settings';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigator for History tab (to enable navigation to SessionDetail)
const HistoryStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HistoryList" component={History} />
      <Stack.Screen name="SessionDetail" component={SessionDetail} />
    </Stack.Navigator>
  );
};

const App = () => {
  return (
    <PaperProvider>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ focused, color, size }) => {
              let iconName;
              if (route.name === 'Live') {
                iconName = 'pulse';
              } else if (route.name === 'History') {
                iconName = 'history';
              } else if (route.name === 'Settings') {
                iconName = 'cog';
              }
              return <Icon name={iconName} size={size} color={color} />;
            },
            tabBarActiveTintColor: '#2563EB',
            tabBarInactiveTintColor: '#64748B',
            headerShown: false,
          })}
        >
          <Tab.Screen name="Live" component={LiveMonitor} />
          <Tab.Screen name="History" component={HistoryStack} />
          <Tab.Screen name="Settings" component={Settings} />
        </Tab.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
};

export default App;
