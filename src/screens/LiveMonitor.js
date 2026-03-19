import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, ScrollView, Alert, PermissionsAndroid, Platform } from 'react-native';
import { Card, Button, ActivityIndicator } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import BLEService from '../services/BLEService';

const LiveMonitor = () => {
  // BLE connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Latest tremor data (received every 60s if tremor detected)
  const [latestPacket, setLatestPacket] = useState(null);
  const [lastUpdateTime, setLastUpdateTime] = useState(null);

  // Today's summary (accumulated throughout the day)
  const [todaySummary, setTodaySummary] = useState({
    episodeCount: 0,
    totalDuration: 0,
    peakAmplitude: 0,
    avgFrequency: 0,
  });

  useEffect(() => {
    // Initialize BLE service
    initializeBLE();

    // Set up callbacks
    BLEService.onConnectionChange = handleConnectionChange;
    BLEService.onTremorPacket = handleTremorPacket;

    // Cleanup on unmount
    return () => {
      BLEService.disconnect();
    };
  }, []);

  const initializeBLE = async () => {
    try {
      // Request permissions on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);

        const allGranted = Object.values(granted).every(
          status => status === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          Alert.alert(
            'Permissions Required',
            'Please grant Bluetooth permissions to connect to your device.'
          );
          return;
        }
      }

      await BLEService.initialize();
      console.log('BLE initialized');
    } catch (error) {
      console.error('BLE initialization error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const handleConnectionChange = (connected) => {
    setIsConnected(connected);
    setIsConnecting(false);
    
    if (!connected) {
      Alert.alert('Disconnected', 'Device has been disconnected');
    }
  };

  const handleTremorPacket = (packet) => {
    if (!packet) return;

    console.log('Tremor packet received:', packet);
    
    setLatestPacket(packet);
    setLastUpdateTime(packet.receivedAt);
    
    // Update today's summary
    setTodaySummary(prev => ({
      episodeCount: prev.episodeCount + 1,
      totalDuration: prev.totalDuration + packet.duration,
      peakAmplitude: Math.max(prev.peakAmplitude, packet.maxAmplitude),
      avgFrequency: prev.avgFrequency === 0 
        ? packet.dominantFreq 
        : (prev.avgFrequency + packet.dominantFreq) / 2,
    }));
  };

  const startScan = async () => {
    setIsScanning(true);
    
    try {
      await BLEService.scanForDevices(
        async (device) => {
          // Found device - ask user to connect
          Alert.alert(
            'Device Found',
            `Found ${device.name}. Connect now?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { 
                text: 'Connect', 
                onPress: () => connectToDevice(device.id) 
              },
            ]
          );
          
          setIsScanning(false);
          BLEService.stopScan();
        },
        'TremorSleeve' // Device name to look for
      );
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Scan Error', error.message);
      setIsScanning(false);
    }
  };

  const connectToDevice = async (deviceId) => {
    setIsConnecting(true);
    
    try {
      await BLEService.connectToDevice(deviceId);
      Alert.alert('Connected', 'Successfully connected to Tremor Sleeve');
    } catch (error) {
      console.error('Connection error:', error);
      Alert.alert('Connection Failed', error.message);
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    await BLEService.disconnect();
  };

  const getTimeSinceUpdate = () => {
    if (!lastUpdateTime) return 'Never';
    const seconds = Math.floor((Date.now() - lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const hasTremor = latestPacket !== null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Monitor</Text>
        <View style={styles.connectionStatus}>
          <Icon 
            name={isConnected ? 'bluetooth-connect' : 'bluetooth-off'} 
            size={20} 
            color={isConnected ? '#10B981' : '#94A3B8'} 
          />
          <Text style={[styles.statusText, { color: isConnected ? '#10B981' : '#94A3B8' }]}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Connection Card (only show if not connected) */}
        {!isConnected && (
          <Card style={styles.connectionCard}>
            <Card.Content>
              <View style={styles.connectionContent}>
                <Icon name="bluetooth-settings" size={48} color="#2563EB" />
                <Text style={styles.connectionTitle}>Connect to Tremor Sleeve</Text>
                <Text style={styles.connectionSubtitle}>
                  {isScanning 
                    ? 'Scanning for devices...' 
                    : 'Start monitoring by connecting to your device'}
                </Text>
                {isConnecting || isScanning ? (
                  <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
                ) : (
                  <Button 
                    mode="contained" 
                    onPress={startScan}
                    style={styles.connectButton}
                    icon="bluetooth-connect"
                  >
                    Scan for Device
                  </Button>
                )}
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Tremor Status Card */}
        {isConnected && (
          <Card style={[styles.statusCard, hasTremor ? styles.tremorCard : styles.noTremorCard]}>
            <Card.Content>
              <View style={styles.statusHeader}>
                <Icon 
                  name={hasTremor ? 'alert-circle' : 'check-circle'} 
                  size={32} 
                  color="#FFFFFF" 
                />
                <View style={styles.statusTextContainer}>
                  <Text style={styles.statusTitle}>
                    {hasTremor ? 'TREMOR DETECTED' : 'NO TREMOR'}
                  </Text>
                  <Text style={styles.statusSubtitle}>
                    Last checked: {getTimeSinceUpdate()}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Tremor Details (only if tremor detected) */}
        {isConnected && hasTremor && latestPacket && (
          <Card style={styles.detailsCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Last 60 Seconds</Text>
              
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Icon name="waves" size={24} color="#2563EB" />
                  <Text style={styles.metricLabel}>Max Amplitude</Text>
                  <Text style={styles.metricValue}>
                    {latestPacket.maxAmplitude.toFixed(2)} m/s²
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Icon name="sine-wave" size={24} color="#2563EB" />
                  <Text style={styles.metricLabel}>Frequency</Text>
                  <Text style={styles.metricValue}>
                    {latestPacket.dominantFreq.toFixed(1)} Hz
                  </Text>
                </View>

                <View style={styles.metric}>
                  <Icon name="timer-outline" size={24} color="#2563EB" />
                  <Text style={styles.metricLabel}>Duration</Text>
                  <Text style={styles.metricValue}>
                    {latestPacket.duration}s
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* Today's Summary */}
        {isConnected && (
          <Card style={styles.summaryCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Today's Summary</Text>
              
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{todaySummary.episodeCount}</Text>
                  <Text style={styles.summaryLabel}>Episodes</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {Math.floor(todaySummary.totalDuration / 60)}m {todaySummary.totalDuration % 60}s
                  </Text>
                  <Text style={styles.summaryLabel}>Total Duration</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {todaySummary.peakAmplitude.toFixed(2)} m/s²
                  </Text>
                  <Text style={styles.summaryLabel}>Peak Amplitude</Text>
                </View>

                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>
                    {todaySummary.avgFrequency.toFixed(1)} Hz
                  </Text>
                  <Text style={styles.summaryLabel}>Avg Frequency</Text>
                </View>
              </View>

              <Button 
                mode="outlined" 
                onPress={disconnect}
                style={styles.disconnectButton}
                textColor="#EF4444"
              >
                Disconnect
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Instructions */}
        {isConnected && !hasTremor && (
          <Card style={styles.infoCard}>
            <Card.Content>
              <View style={styles.infoContent}>
                <Icon name="information-outline" size={24} color="#2563EB" />
                <Text style={styles.infoText}>
                  Your device is monitoring for tremor activity. You'll receive an update every 60 seconds if tremor is detected.
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  connectionCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  connectionContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  connectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
  },
  connectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  loader: {
    marginTop: 24,
  },
  connectButton: {
    marginTop: 24,
    borderRadius: 8,
  },
  statusCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  noTremorCard: {
    backgroundColor: '#10B981',
  },
  tremorCard: {
    backgroundColor: '#EF4444',
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  detailsCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 16,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 4,
  },
  summaryCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  disconnectButton: {
    borderRadius: 8,
    borderColor: '#EF4444',
    marginTop: 8,
  },
  infoCard: {
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  infoContent: {
    flexDirection: 'row',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
});

export default LiveMonitor;