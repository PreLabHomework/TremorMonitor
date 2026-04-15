import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { Card, Button } from 'react-native-paper';
import BLEService from '../services/BLEService';
import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';

const LiveMonitor = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  
  const [tremorData, setTremorData] = useState({
    tremor: false,
    maxAmplitude: 0,
    dominantFreq: 0,
    duration: 0,
    lastChecked: 'Never',
  });

  const [todaySummary, setTodaySummary] = useState({
    episodes: 0,
    totalDuration: 0,
    peakAmplitude: 0,
    avgFrequency: 0,
  });

  // Initialize database on mount
  useEffect(() => {
    initializeApp();
    
    return () => {
      BLEService.disconnect();
    };
  }, []);

  const initializeApp = async () => {
    try {
      console.log('🚀 Initializing app...');
      await DatabaseService.initDatabase();
      console.log('✅ Database initialized');
      
      // Load today's summary from database
      await loadTodaySummary();
      
      // Set up BLE callbacks
      BLEService.setConnectionCallback(handleConnectionChange);
      BLEService.setTremorCallback(handleTremorPacket);
      
    } catch (error) {
      console.error('❌ App initialization error:', error);
      Alert.alert('Initialization Error', error.message);
    }
  };

  const loadTodaySummary = async () => {
    try {
      const summary = await DatabaseService.getTodaySummary();
      setTodaySummary(summary);
      console.log('📊 Loaded today\'s summary:', summary);
    } catch (error) {
      console.error('❌ Error loading summary:', error);
    }
  };

  const handleConnectionChange = (connected) => {
    console.log('🔌 Connection status changed:', connected);
    setIsConnected(connected);
    
    if (!connected && isRecording) {
      // Connection lost during recording - stop session
      handleStopRecording();
    }
  };

  const handleTremorPacket = async (packet) => {
    console.log('📊 Received tremor data:', packet);
    
    const now = new Date().toLocaleTimeString();
    
    // Update UI
    setTremorData({
      tremor: packet.tremor,
      maxAmplitude: packet.maxAmplitude,
      dominantFreq: packet.dominantFreq,
      duration: packet.duration,
      lastChecked: now,
    });

    // Save to database if recording
    if (isRecording && currentSessionId) {
      try {
        const timestamp = new Date().toISOString();
        
        // Add feature (tremor metrics)
        await DatabaseService.addFeature(currentSessionId, {
          timestamp: timestamp,
          frequency: packet.dominantFreq,
          amplitude: packet.maxAmplitude,
          severity: calculateSeverity(packet.maxAmplitude),
        });

        // Add tremor event if tremor detected
        if (packet.tremor) {
          await DatabaseService.addTremorEvent(currentSessionId, {
            start_time: timestamp,
            duration: packet.duration,
            peak_amplitude: packet.maxAmplitude,
            dominant_frequency: packet.dominantFreq,
          });
        }

        console.log('💾 Saved to database');
        
        // Reload today's summary
        await loadTodaySummary();
        
      } catch (error) {
        console.error('❌ Error saving to database:', error);
      }
    }
  };

  const calculateSeverity = (amplitude) => {
    // UPDRS scale 0-4 based on amplitude
    if (amplitude < 0.5) return 0;
    if (amplitude < 1.0) return 1;
    if (amplitude < 2.0) return 2;
    if (amplitude < 4.0) return 3;
    return 4;
  };

  const handleScan = async () => {
    try {
      setIsScanning(true);
      console.log('🔍 Starting scan...');
      
      const device = await BLEService.scanForDevices();
      
      if (device) {
        Alert.alert(
          'Device Found',
          'TremorSleeve found! Connect now?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Connect', onPress: () => handleConnect(device) },
          ]
        );
      } else {
        Alert.alert('No Device Found', 'Could not find TremorSleeve. Make sure it is powered on and nearby.');
      }
    } catch (error) {
      console.error('❌ Scan error:', error);
      Alert.alert('Scan Error', error.message);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConnect = async (device) => {
    try {
      const success = await BLEService.connectToDevice(device);
      if (success) {
        Alert.alert('Connected', 'Successfully connected to TremorSleeve!');
      } else {
        Alert.alert('Connection Failed', 'Could not connect to device.');
      }
    } catch (error) {
      console.error('❌ Connection error:', error);
      Alert.alert('Connection Error', error.message);
    }
  };

  const handleDisconnect = () => {
    if (isRecording) {
      Alert.alert(
        'Recording Active',
        'Stop recording before disconnecting?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Stop & Disconnect', 
            onPress: async () => {
              await handleStopRecording();
              BLEService.disconnect();
            }
          },
        ]
      );
    } else {
      BLEService.disconnect();
      Alert.alert('Disconnected', 'Device disconnected successfully.');
    }
  };

  const handleStartRecording = async () => {
    if (!isConnected) {
      Alert.alert('Not Connected', 'Please connect to TremorSleeve first.');
      return;
    }

    try {
      console.log('🔴 Starting recording...');
      const sessionId = await DatabaseService.createSession();
      setCurrentSessionId(sessionId);
      setIsRecording(true);
      console.log('✅ Recording started, session:', sessionId);
      Alert.alert('Recording Started', 'Tremor data is now being recorded.');
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      Alert.alert('Recording Error', error.message);
    }
  };

  const handleStopRecording = async () => {
    if (!currentSessionId) return;

    try {
      console.log('⏹️ Stopping recording...');
      await DatabaseService.endSession(currentSessionId);
      
      // Upload to Firebase Cloud
      try {
        console.log('☁️ Uploading to cloud...');
        const sessionData = await DatabaseService.getSession(currentSessionId);
        const features = await DatabaseService.getSessionFeatures(currentSessionId);
        const events = await DatabaseService.getSessionEvents(currentSessionId);
        
        await FirebaseService.uploadSession(sessionData, features, events);
        console.log('✅ Session uploaded to cloud');
      } catch (firebaseError) {
        console.error('❌ Firebase upload failed (continuing anyway):', firebaseError);
        // Don't block the user if Firebase fails - session is still saved locally
      }
      
      setIsRecording(false);
      setCurrentSessionId(null);
      console.log('✅ Recording stopped');
      
      Alert.alert(
        'Recording Stopped', 
        'Session saved locally and uploaded to cloud. View it in the History tab.'
      );
      
      // Reload summary
      await loadTodaySummary();
      
    } catch (error) {
      console.error('❌ Error stopping recording:', error);
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Live Monitor</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, isConnected ? styles.connectedDot : styles.disconnectedDot]} />
          <Text style={styles.statusText}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      {/* Recording Status */}
      {isRecording && (
        <Card style={styles.recordingCard}>
          <Card.Content style={styles.recordingContent}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Recording in progress...</Text>
          </Card.Content>
        </Card>
      )}

      {/* Current Status Card */}
      <Card style={[styles.card, tremorData.tremor ? styles.tremorCard : styles.noTremorCard]}>
        <Card.Content>
          <Text style={styles.statusIcon}>{tremorData.tremor ? '⚠️' : '✓'}</Text>
          <Text style={styles.statusText}>
            {tremorData.tremor ? 'TREMOR DETECTED' : 'NO TREMOR'}
          </Text>
          <Text style={styles.lastChecked}>Last checked: {tremorData.lastChecked}</Text>

          {tremorData.tremor && (
            <View style={styles.dataContainer}>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Max Amplitude:</Text>
                <Text style={styles.dataValue}>{tremorData.maxAmplitude.toFixed(2)} m/s²</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Frequency:</Text>
                <Text style={styles.dataValue}>{tremorData.dominantFreq.toFixed(1)} Hz</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Duration:</Text>
                <Text style={styles.dataValue}>{tremorData.duration} sec</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Severity:</Text>
                <Text style={styles.dataValue}>
                  {calculateSeverity(tremorData.maxAmplitude)}/4 (UPDRS)
                </Text>
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      {/* Today's Summary Card */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Text style={styles.summaryTitle}>Today's Summary</Text>
          
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todaySummary.episodes}</Text>
              <Text style={styles.summaryLabel}>Episodes</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{Math.floor(todaySummary.totalDuration / 60)} min</Text>
              <Text style={styles.summaryLabel}>Total Duration</Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todaySummary.peakAmplitude.toFixed(1)} m/s²</Text>
              <Text style={styles.summaryLabel}>Peak Amplitude</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todaySummary.avgFrequency.toFixed(1)} Hz</Text>
              <Text style={styles.summaryLabel}>Avg Frequency</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Connection Controls */}
      <View style={styles.controls}>
        {!isConnected ? (
          <Button 
            mode="contained" 
            onPress={handleScan}
            loading={isScanning}
            disabled={isScanning}
            style={styles.button}
          >
            {isScanning ? 'Scanning...' : 'Scan for Device'}
          </Button>
        ) : (
          <>
            <Button 
              mode="outlined" 
              onPress={handleDisconnect}
              style={styles.button}
              textColor="#ff4444"
            >
              Disconnect
            </Button>
            
            <View style={styles.spacer} />
            
            {!isRecording ? (
              <Button 
                mode="contained" 
                onPress={handleStartRecording}
                style={[styles.button, styles.recordButton]}
                buttonColor="#4CAF50"
              >
                Start Recording Session
              </Button>
            ) : (
              <Button 
                mode="contained" 
                onPress={handleStopRecording}
                style={[styles.button, styles.stopButton]}
                buttonColor="#ff4444"
              >
                Stop Recording
              </Button>
            )}
          </>
        )}
      </View>

      {/* Info Card */}
      {isConnected && (
        <Card style={styles.infoCard}>
          <Card.Content>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              {isRecording 
                ? 'Recording tremor data. Data is being saved locally and will upload to cloud when you stop. Press "Stop Recording" when finished.'
                : 'Device is monitoring for tremor activity. Press "Start Recording Session" to save data locally and upload to cloud for your doctor.'
              }
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectedDot: {
    backgroundColor: '#4CAF50',
  },
  disconnectedDot: {
    backgroundColor: '#999',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recordingCard: {
    marginBottom: 12,
    backgroundColor: '#ff4444',
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#fff',
    marginRight: 8,
  },
  recordingText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  noTremorCard: {
    backgroundColor: '#E8F5E9',
  },
  tremorCard: {
    backgroundColor: '#FFEBEE',
  },
  statusIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 8,
  },
  lastChecked: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  dataContainer: {
    marginTop: 16,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dataLabel: {
    fontSize: 16,
    color: '#666',
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    marginBottom: 16,
    backgroundColor: '#424242',
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#fff',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 4,
  },
  controls: {
    marginBottom: 16,
  },
  button: {
    borderRadius: 8,
  },
  spacer: {
    height: 12,
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#ff4444',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
  },
});

export default LiveMonitor;