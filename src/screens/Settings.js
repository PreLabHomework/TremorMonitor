import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Text } from 'react-native';
import { Card, Switch, Button, Divider, RadioButton, Slider } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const Settings = ({ navigation }) => {
  // Medication settings
  const [medicationMode, setMedicationMode] = useState('manual'); // 'manual' or 'auto'
  const [severityThreshold, setSeverityThreshold] = useState(2); // 0-4 scale

  // Notification settings
  const [tremorAlerts, setTremorAlerts] = useState(true);
  const [medicationReminders, setMedicationReminders] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);

  // Data & Privacy settings
  const [researchDataSharing, setResearchDataSharing] = useState(false);
  const [doctorPortalAccess, setDoctorPortalAccess] = useState(true);

  // Device info (mock data)
  const [connectedDevice, setConnectedDevice] = useState({
    name: 'Tremor Sleeve',
    battery: 85,
    connected: true,
  });

  const getSeverityLabel = (value) => {
    const labels = ['None', 'Mild', 'Moderate', 'Severe', 'Critical'];
    return labels[Math.round(value)] || 'Moderate';
  };

  const handleDisconnect = () => {
    setConnectedDevice({ ...connectedDevice, connected: false });
  };

  const handleConnect = () => {
    // Will implement BLE scanning later
    console.log('Start BLE scan');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Settings</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Medication Settings */}
        <Text style={styles.sectionTitle}>Medication Settings</Text>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Medication Mode</Text>
            <View style={styles.radioGroup}>
              <View style={styles.radioItem}>
                <RadioButton
                  value="manual"
                  status={medicationMode === 'manual' ? 'checked' : 'unchecked'}
                  onPress={() => setMedicationMode('manual')}
                  color="#2563EB"
                />
                <View style={styles.radioLabel}>
                  <Text style={styles.radioText}>Manual</Text>
                  <Text style={styles.radioSubtext}>You confirm each dose</Text>
                </View>
              </View>
              <View style={styles.radioItem}>
                <RadioButton
                  value="auto"
                  status={medicationMode === 'auto' ? 'checked' : 'unchecked'}
                  onPress={() => setMedicationMode('auto')}
                  color="#2563EB"
                />
                <View style={styles.radioLabel}>
                  <Text style={styles.radioText}>Automatic</Text>
                  <Text style={styles.radioSubtext}>Auto-dispense when threshold met</Text>
                </View>
              </View>
            </View>

            {medicationMode === 'auto' && (
              <>
                <Divider style={styles.divider} />
                <Text style={styles.cardTitle}>Severity Threshold</Text>
                <Text style={styles.thresholdLabel}>
                  Trigger at: {getSeverityLabel(severityThreshold)}
                </Text>
                <View style={styles.sliderContainer}>
                  <Slider
                    value={severityThreshold}
                    onValueChange={setSeverityThreshold}
                    minimumValue={0}
                    maximumValue={4}
                    step={1}
                    minimumTrackTintColor="#2563EB"
                    maximumTrackTintColor="#CBD5E1"
                    thumbTintColor="#2563EB"
                  />
                </View>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>None</Text>
                  <Text style={styles.sliderLabelText}>Mild</Text>
                  <Text style={styles.sliderLabelText}>Moderate</Text>
                  <Text style={styles.sliderLabelText}>Severe</Text>
                  <Text style={styles.sliderLabelText}>Critical</Text>
                </View>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Tremor Alerts</Text>
                <Text style={styles.settingSubtitle}>Notify when tremor detected</Text>
              </View>
              <Switch
                value={tremorAlerts}
                onValueChange={setTremorAlerts}
                color="#2563EB"
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Medication Reminders</Text>
                <Text style={styles.settingSubtitle}>Scheduled dose reminders</Text>
              </View>
              <Switch
                value={medicationReminders}
                onValueChange={setMedicationReminders}
                color="#2563EB"
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Daily Summary</Text>
                <Text style={styles.settingSubtitle}>End of day report</Text>
              </View>
              <Switch
                value={dailySummary}
                onValueChange={setDailySummary}
                color="#2563EB"
              />
            </View>
          </Card.Content>
        </Card>

        {/* Data & Privacy */}
        <Text style={styles.sectionTitle}>Data & Privacy</Text>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Share Data for Research</Text>
                <Text style={styles.settingSubtitle}>Anonymous data contribution</Text>
              </View>
              <Switch
                value={researchDataSharing}
                onValueChange={setResearchDataSharing}
                color="#2563EB"
              />
            </View>

            <Divider style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Doctor Portal Access</Text>
                <Text style={styles.settingSubtitle}>Allow clinician to view data</Text>
              </View>
              <Switch
                value={doctorPortalAccess}
                onValueChange={setDoctorPortalAccess}
                color="#2563EB"
              />
            </View>
          </Card.Content>
        </Card>

        {/* Device */}
        <Text style={styles.sectionTitle}>Device</Text>
        <Card style={styles.card}>
          <Card.Content>
            {connectedDevice.connected ? (
              <>
                <View style={styles.deviceRow}>
                  <Icon name="bluetooth-connect" size={24} color="#2563EB" />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{connectedDevice.name}</Text>
                    <Text style={styles.deviceStatus}>Connected</Text>
                  </View>
                </View>
                <View style={styles.batteryRow}>
                  <Icon name="battery-80" size={20} color="#10B981" />
                  <Text style={styles.batteryText}>{connectedDevice.battery}%</Text>
                </View>
                <Button
                  mode="outlined"
                  onPress={handleDisconnect}
                  style={styles.disconnectButton}
                  textColor="#EF4444"
                >
                  Disconnect
                </Button>
              </>
            ) : (
              <>
                <View style={styles.deviceRow}>
                  <Icon name="bluetooth-off" size={24} color="#94A3B8" />
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>No Device Connected</Text>
                    <Text style={styles.deviceStatus}>Disconnected</Text>
                  </View>
                </View>
                <Button
                  mode="contained"
                  onPress={handleConnect}
                  style={styles.connectButton}
                  icon="bluetooth-search"
                >
                  Connect Device
                </Button>
              </>
            )}
          </Card.Content>
        </Card>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>Tremor Monitor v1.0.0</Text>
          <Text style={styles.appInfoText}>© 2026 Senior Design Team</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    color: '#1E293B',
  },
  card: {
    marginBottom: 24,
    borderRadius: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  radioGroup: {
    gap: 8,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioLabel: {
    flex: 1,
    marginLeft: 8,
  },
  radioText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  radioSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  divider: {
    marginVertical: 16,
  },
  thresholdLabel: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  sliderContainer: {
    paddingHorizontal: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabelText: {
    fontSize: 10,
    color: '#64748B',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  deviceInfo: {
    marginLeft: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  batteryText: {
    fontSize: 14,
    color: '#10B981',
    marginLeft: 8,
  },
  disconnectButton: {
    borderRadius: 8,
    borderColor: '#EF4444',
  },
  connectButton: {
    borderRadius: 8,
    marginTop: 12,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  appInfoText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
});

export default Settings;
