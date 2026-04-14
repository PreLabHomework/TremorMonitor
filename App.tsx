import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Provider as PaperProvider } from 'react-native-paper';

// Screens
import ModeSelection from './src/screens/ModeSelection';
import LiveMonitor from './src/screens/LiveMonitor';
import History from './src/screens/History';
import SessionDetail from './src/screens/SessionDetail';
import Settings from './src/screens/Settings';
import DoctorDashboard from './src/screens/DoctorDashboard';
import PatientList from './src/screens/PatientList';
import PatientDetail from './src/screens/PatientDetail';

// Services
import DatabaseService from './src/services/DatabaseService';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Patient Mode Tab Navigator
function PatientTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Live') {
            iconName = 'heart-pulse';
          } else if (route.name === 'History') {
            iconName = 'history';
          } else if (route.name === 'Settings') {
            iconName = 'cog';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Live" 
        component={LiveMonitor}
        options={{ headerShown: false }}
      />
      <Tab.Screen 
        name="History" 
        component={History}
        options={{ headerShown: false }}
      />
      <Tab.Screen 
        name="Settings" 
        component={Settings}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

// Doctor Mode Tab Navigator
function DoctorTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = 'view-dashboard';
          } else if (route.name === 'Patients') {
            iconName = 'account-group';
          } else if (route.name === 'DoctorSettings') {
            iconName = 'cog';
          }

          return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#1976D2',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DoctorDashboard}
        options={{ headerShown: false }}
      />
      <Tab.Screen 
        name="Patients" 
        component={PatientList}
        options={{ headerShown: false }}
      />
      <Tab.Screen 
        name="DoctorSettings" 
        component={Settings}
        options={{ 
          headerShown: false,
          title: 'Settings'
        }}
      />
    </Tab.Navigator>
  );
}

// Patient App Stack
function PatientStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="PatientTabs" 
        component={PatientTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="SessionDetail" 
        component={SessionDetail}
        options={{ title: 'Session Details' }}
      />
    </Stack.Navigator>
  );
}

// Doctor App Stack
function DoctorStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DoctorTabs" 
        component={DoctorTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="PatientDetail" 
        component={PatientDetail}
        options={({ route }) => {
          const params = route.params as { patientName?: string };
          return { title: params?.patientName || 'Patient Details' };
        }}
      />
      <Stack.Screen 
        name="SessionDetail" 
        component={SessionDetail}
        options={{ title: 'Session Details' }}
      />
    </Stack.Navigator>
  );
}

// Main App
function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');
      
      // Initialize database
      await DatabaseService.initDatabase();
      console.log('✅ Database initialized');
      
      // Check if mode has been selected
      const savedMode = await DatabaseService.getSetting('app_mode', null);
      
      if (savedMode === 'patient') {
        setInitialRoute('PatientApp');
      } else if (savedMode === 'doctor') {
        setInitialRoute('DoctorApp');
      } else {
        setInitialRoute('ModeSelection');
      }
      
      setIsReady(true);
      
    } catch (error) {
      console.error('❌ App initialization error:', error);
      setInitialRoute('ModeSelection');
      setIsReady(true);
    }
  };

  if (!isReady || !initialRoute) {
    // You could show a splash screen here
    return null;
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen 
            name="ModeSelection" 
            component={ModeSelection}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="PatientApp" 
            component={PatientStack}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="DoctorApp" 
            component={DoctorStack}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}

export default App;
