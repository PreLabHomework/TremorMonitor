import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {
  Card,
  Switch,
  RadioButton,
  Divider,
  Button,
  ProgressBar,
  List,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import DatabaseService from '../services/DatabaseService';
import BLEService from '../services/BLEService';

const Settings = () => {
  // Medication Settings
  const [medicationMode, setMedicationMode] = useState('manual');
  const [severityThreshold, setSeverityThreshold] = useState(2);

  // Notification Settings
  const [tremorAlerts, setTremorAlerts] = useState(true);
  const [medicationReminders, setMedicationReminders] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  // Data & Privacy Settings
  const [researchSharing, setResearchSharing] = useState(false);
  const [doctorPortalAccess, setDoctorPortalAccess] = useState(false);

  // BLE Device Settings
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('Not Connected');
  const [batteryLevel, setBatteryLevel] = useState(100);

  useEffect(() => {
    loadSettings();
    setupBLEListener();
  }, []);

  const setupBLEListener = () => {
    BLEService.setConnectionCallback((connected) => {
      setDeviceConnected(connected);
      if (connected) {
        setDeviceName('TremorSleeve');
        // Battery level would come from BLE in real implementation
        setBatteryLevel(85);
      } else {
        setDeviceName('Not Connected');
        setBatteryLevel(100);
      }
    });
  };

  const loadSettings = async () => {
    try {
      console.log('⚙️ Loading settings...');

      // Load all settings from database
      const medMode = await DatabaseService.getSetting('medication_mode', 'manual');
      const sevThreshold = await DatabaseService.getSetting('severity_threshold', 2);
      const tremorAlertsEnabled = await DatabaseService.getSetting('tremor_alerts', true);
      const medRemindersEnabled = await DatabaseService.getSetting('medication_reminders', true);
      const dailySummaryEnabled = await DatabaseService.getSetting('daily_summary', false);
      const researchEnabled = await DatabaseService.getSetting('research_sharing', false);
      const doctorEnabled = await DatabaseService.getSetting('doctor_portal', false);

      setMedicationMode(medMode);
      setSeverityThreshold(sevThreshold);
      setTremorAlerts(tremorAlertsEnabled);
      setMedicationReminders(medRemindersEnabled);
      setDailySummary(dailySummaryEnabled);
      setResearchSharing(researchEnabled);
      setDoctorPortalAccess(doctorEnabled);

      console.log('✅ Settings loaded');
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    }
  };

  const saveSetting = async (key, value) => {
    try {
      await DatabaseService.setSetting(key, value);
      console.log(`💾 Saved ${key}:`, value);
    } catch (error) {
      console.error(`❌ Error saving ${key}:`, error);
    }
  };

  const handleMedicationModeChange = (mode) => {
    setMedicationMode(mode);
    saveSetting('medication_mode', mode);
  };

  const handleSeverityThresholdChange = (value) => {
    setSeverityThreshold(value);
    saveSetting('severity_threshold', value);
  };

  const handleTremorAlertsChange = (value) => {
    setTremorAlerts(value);
    saveSetting('tremor_alerts', value);
  };

  const handleMedicationRemindersChange = (value) => {
    setMedicationReminders(value);
    saveSetting('medication_reminders', value);
  };

  const handleDailySummaryChange = (value) => {
    setDailySummary(value);
    saveSetting('daily_summary', value);
  };

  const handleResearchSharingChange = (value) => {
    if (value) {
      Alert.alert(
        'Enable Research Sharing?',
        'Your anonymized tremor data will be shared with researchers to help improve Parkinson\'s treatment. You can disable this at any time.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Enable', 
            onPress: () => {
              setResearchSharing(true);
              saveSetting('research_sharing', true);
            }
          },
        ]
      );
    } else {
      setResearchSharing(false);
      saveSetting('research_sharing', false);
    }
  };

  const handleDoctorPortalChange = (value) => {
    if (value) {
      Alert.alert(
        'Enable Doctor Portal Access?',
        'Your healthcare provider will be able to view your tremor data and session history.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Enable', 
            onPress: () => {
              setDoctorPortalAccess(true);
              saveSetting('doctor_portal', true);
            }
          },
        ]
      );
    } else {
      setDoctorPortalAccess(false);
      saveSetting('doctor_portal', false);
    }
  };

  const handleDisconnectDevice = () => {
    Alert.alert(
      'Disconnect Device',
      'Are you sure you want to disconnect from TremorSleeve?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: () => {
            BLEService.disconnect();
            Alert.alert('Disconnected', 'Device disconnected successfully');
          }
        },
      ]
    );
  };

  const handleClearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete ALL sessions and tremor data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All Data', 
          style: 'destructive',
          onPress: async () => {
            try {
              await DatabaseService.clearAllData();
              Alert.alert('Success', 'All data has been cleared');
            } catch (error) {
              console.error('❌ Error clearing data:', error);
              Alert.alert('Error', 'Could not clear data');
            }
          }
        },
      ]
    );
  };

  const getSeverityLabel = (value) => {
    const labels = ['0 - None', '1 - Mild', '2 - Moderate', '3 - Strong', '4 - Severe'];
    return labels[Math.round(value)];
  };

  return (
    <ScrollView style={styles.container}>
      {/* Medication Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Medication Management</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Medication Mode</Text>
            <RadioButton.Group 
              onValueChange={handleMedicationModeChange} 
              value={medicationMode}
            >
              <View style={styles.radioItem}>
                <RadioButton value="manual" />
                <Text style={styles.radioLabel}>Manual - I control when to take medication</Text>
              </View>
              <View style={styles.radioItem}>
                <RadioButton value="auto" />
                <Text style={styles.radioLabel}>Auto - Remind me based on tremor severity</Text>
              </View>
            </RadioButton.Group>
          </View>

          {medicationMode === 'auto' && (
            <>
              <Divider style={styles.divider} />
              <View style={styles.settingItem}>
                <Text style={styles.settingLabel}>Severity Threshold</Text>
                <Text style={styles.settingDescription}>
                  Get medication reminder when tremor reaches this severity
                </Text>
                <View style={styles.sliderContainer}>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={4}
                    step={1}
                    value={severityThreshold}
                    onValueChange={handleSeverityThresholdChange}
                    minimumTrackTintColor="#1976D2"
                    maximumTrackTintColor="#ddd"
                    thumbTintColor="#1976D2"
                  />
                  <Text style={styles.sliderValue}>{getSeverityLabel(severityThreshold)}</Text>
                </View>
              </View>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Notification Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.settingLabel}>Tremor Alerts</Text>
                <Text style={styles.settingDescription}>
                  Notify when tremor is detected
                </Text>
              </View>
              <Switch
                value={tremorAlerts}
                onValueChange={handleTremorAlertsChange}
                color="#1976D2"
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.settingLabel}>Medication Reminders</Text>
                <Text style={styles.settingDescription}>
                  Remind me to take medication
                </Text>
              </View>
              <Switch
                value={medicationReminders}
                onValueChange={handleMedicationRemindersChange}
                color="#1976D2"
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.settingLabel}>Daily Summary</Text>
                <Text style={styles.settingDescription}>
                  Daily report of tremor activity
                </Text>
              </View>
              <Switch
                value={dailySummary}
                onValueChange={handleDailySummaryChange}
                color="#1976D2"
              />
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Data & Privacy */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Data & Privacy</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.settingLabel}>Research Data Sharing</Text>
                <Text style={styles.settingDescription}>
                  Share anonymized data with researchers
                </Text>
              </View>
              <Switch
                value={researchSharing}
                onValueChange={handleResearchSharingChange}
                color="#1976D2"
              />
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.settingItem}>
            <View style={styles.switchRow}>
              <View style={styles.switchLabel}>
                <Text style={styles.settingLabel}>Doctor Portal Access</Text>
                <Text style={styles.settingDescription}>
                  Allow healthcare provider to view data
                </Text>
              </View>
              <Switch
                value={doctorPortalAccess}
                onValueChange={handleDoctorPortalChange}
                color="#1976D2"
              />
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* BLE Device */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Connected Device</Text>
          
          <List.Item
            title={deviceName}
            description={deviceConnected ? 'TremorSleeve' : 'No device connected'}
            left={props => (
              <List.Icon 
                {...props} 
                icon={deviceConnected ? 'bluetooth-connect' : 'bluetooth-off'} 
                color={deviceConnected ? '#4CAF50' : '#999'}
              />
            )}
          />

          {deviceConnected && (
            <>
              <View style={styles.batteryContainer}>
                <Text style={styles.batteryLabel}>Battery Level</Text>
                <Text style={styles.batteryValue}>{batteryLevel}%</Text>
              </View>
              <ProgressBar 
                progress={batteryLevel / 100} 
                color="#4CAF50" 
                style={styles.batteryBar}
              />
              
              <Button 
                mode="outlined" 
                onPress={handleDisconnectDevice}
                style={styles.button}
                textColor="#F44336"
              >
                Disconnect Device
              </Button>
            </>
          )}
        </Card.Content>
      </Card>

      {/* Danger Zone */}
      <Card style={styles.dangerCard}>
        <Card.Content>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          
          <Button 
            mode="contained" 
            onPress={handleClearAllData}
            style={styles.dangerButton}
            buttonColor="#F44336"
            icon="delete-forever"
          >
            Clear All Data
          </Button>
          
          <Text style={styles.dangerDescription}>
            This will permanently delete all sessions and tremor data. This action cannot be undone.
          </Text>
        </Card.Content>
      </Card>

      {/* App Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.infoText}>TremorMonitor v1.0</Text>
          <Text style={styles.infoText}>SLU Senior Design 2026</Text>
          <Text style={styles.infoText}>Team: Hamza, Eric, Samir, Sage</Text>
        </Card.Content>
      </Card>

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
    marginBottom: 8,
  },
  dangerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFEBEE',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  dangerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#F44336',
  },
  settingItem: {
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  radioLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  divider: {
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  sliderContainer: {
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    textAlign: 'center',
    fontSize: 14,
    color: '#1976D2',
    fontWeight: '600',
    marginTop: 4,
  },
  batteryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  batteryLabel: {
    fontSize: 14,
    color: '#666',
  },
  batteryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  batteryBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
  dangerButton: {
    marginBottom: 8,
  },
  dangerDescription: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default Settings;
