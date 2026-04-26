import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens — Shared
import ModeSelection from './src/screens/ModeSelection';
import SessionDetail from './src/screens/SessionDetail';

// Screens — Patient
import PatientWelcome from './src/screens/PatientWelcome';
import LiveMonitor from './src/screens/LiveMonitor';
import History from './src/screens/History';
import Pills from './src/screens/Pills';
import Settings from './src/screens/Settings';

// Screens — Doctor
import DoctorDashboard from './src/screens/DoctorDashboard';
import PatientList from './src/screens/PatientList';
import PatientDetail from './src/screens/PatientDetail';
import AddPatient from './src/screens/AddPatient';

// Screens — Researcher
import ResearchDashboard from './src/screens/ResearchDashboard';
import ResearchExport from './src/screens/ResearchExport';

// Services
import DatabaseService from './src/services/DatabaseService';
import FirebaseService from './src/services/FirebaseService';
import { colors, icons } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Hook that builds tab options with bottom safe-area inset baked in.
// This pushes the tab bar above the Android gesture bar / navigation pill.
const useTabScreenOptions = () => {
  const insets = useSafeAreaInsets();
  return {
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textTertiary,
    tabBarStyle: {
      backgroundColor: colors.surface,
      borderTopColor: colors.border,
      paddingTop: 6,
      paddingBottom: 6 + insets.bottom,
      height: 62 + insets.bottom,
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
    },
    headerStyle: {
      backgroundColor: colors.surface,
    },
    headerTitleStyle: {
      fontWeight: '700',
      color: colors.textPrimary,
    },
    headerShadowVisible: false,
  };
};

// ============ PATIENT ============

function PatientTabs() {
  const baseOptions = useTabScreenOptions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...baseOptions,
        tabBarIcon: ({ color, size }) => {
          const name = {
            Live: icons.live,
            History: icons.history,
            Pills: icons.pills,
            Settings: icons.settings,
          }[route.name] || 'circle';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Live" component={LiveMonitor} options={{ headerShown: false }} />
      <Tab.Screen name="History" component={History} options={{ title: 'Session History' }} />
      <Tab.Screen name="Pills" component={Pills} options={{ title: 'Medication' }} />
      <Tab.Screen name="Settings" component={Settings} options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}

function PatientStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="PatientWelcome" component={PatientWelcome} options={{ headerShown: false }} />
      <Stack.Screen name="PatientTabs" component={PatientTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetail}
        options={{ title: 'Session Details', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
}

// ============ DOCTOR ============

function DoctorTabs() {
  const baseOptions = useTabScreenOptions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...baseOptions,
        tabBarIcon: ({ color, size }) => {
          const name = {
            Dashboard: icons.dashboard,
            Patients: icons.patients,
            DoctorSettings: icons.settings,
          }[route.name] || 'circle';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DoctorDashboard} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Patients" component={PatientList} options={{ title: 'Patients' }} />
      <Tab.Screen
        name="DoctorSettings"
        component={Settings}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function DoctorStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="DoctorTabs" component={DoctorTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="PatientDetail"
        component={PatientDetail}
        options={({ route }) => {
          const params = route.params as { patientName?: string };
          return { title: params?.patientName || 'Patient' };
        }}
      />
      <Stack.Screen
        name="AddPatient"
        component={AddPatient}
        options={{ title: 'Add Patient' }}
      />
      <Stack.Screen
        name="SessionDetail"
        component={SessionDetail}
        options={{ title: 'Session Details' }}
      />
    </Stack.Navigator>
  );
}

// ============ RESEARCHER ============

function ResearcherTabs() {
  const baseOptions = useTabScreenOptions();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...baseOptions,
        tabBarIcon: ({ color, size }) => {
          const name = {
            Overview: icons.research,
            Export: icons.export,
            ResearcherSettings: icons.settings,
          }[route.name] || 'circle';
          return <MaterialCommunityIcons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Overview" component={ResearchDashboard} options={{ title: 'Research' }} />
      <Tab.Screen name="Export" component={ResearchExport} options={{ title: 'Data Export' }} />
      <Tab.Screen
        name="ResearcherSettings"
        component={Settings}
        options={{ title: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

function ResearcherStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShadowVisible: false }}>
      <Stack.Screen name="ResearcherTabs" component={ResearcherTabs} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// ============ ROOT ============

function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => { initializeApp(); }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initDatabase();

      // Try to flush anything pending in the sync queue on launch
      FirebaseService.processSyncQueue().catch(() => {});

      const savedMode = await DatabaseService.getSetting('app_mode', null);
      if (savedMode === 'patient') setInitialRoute('PatientApp');
      else if (savedMode === 'doctor') setInitialRoute('DoctorApp');
      else if (savedMode === 'researcher') setInitialRoute('ResearcherApp');
      else setInitialRoute('ModeSelection');

      setIsReady(true);
    } catch (error) {
      console.error('App init error:', error);
      setInitialRoute('ModeSelection');
      setIsReady(true);
    }
  };

  if (!isReady || !initialRoute) {
    return (
      <SafeAreaProvider>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <PaperProvider>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initialRoute} screenOptions={{ headerShown: false }}>
            <Stack.Screen name="ModeSelection" component={ModeSelection} />
            <Stack.Screen name="PatientApp" component={PatientStack} />
            <Stack.Screen name="DoctorApp" component={DoctorStack} />
            <Stack.Screen name="ResearcherApp" component={ResearcherStack} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

export default App;
