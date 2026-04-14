import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Card } from 'react-native-paper';
import DatabaseService from '../services/DatabaseService';

const ModeSelection = ({ navigation }) => {
  const handleModeSelect = async (mode) => {
    try {
      // Save selected mode to database
      await DatabaseService.setSetting('app_mode', mode);
      console.log('✅ Mode selected:', mode);
      
      // Navigate to appropriate stack
      if (mode === 'patient') {
        navigation.replace('PatientApp');
      } else {
        navigation.replace('DoctorApp');
      }
    } catch (error) {
      console.error('❌ Error saving mode:', error);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>TremorMonitor</Text>
        <Text style={styles.subtitle}>Parkinson's Disease Management System</Text>
      </View>

      {/* Mode Selection Cards */}
      <View style={styles.cardsContainer}>
        {/* Patient Mode */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleModeSelect('patient')}
        >
          <Card style={styles.modeCard}>
            <Card.Content style={styles.cardContent}>
              <Text style={styles.modeIcon}>👤</Text>
              <Text style={styles.modeTitle}>Patient Mode</Text>
              <Text style={styles.modeDescription}>
                Monitor your tremors, track medication, and view your session history
              </Text>
              <View style={styles.featureList}>
                <Text style={styles.feature}>• Live tremor monitoring</Text>
                <Text style={styles.feature}>• Session recording</Text>
                <Text style={styles.feature}>• History & analytics</Text>
                <Text style={styles.feature}>• Medication tracking</Text>
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>

        {/* Doctor Mode */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleModeSelect('doctor')}
        >
          <Card style={styles.modeCard}>
            <Card.Content style={styles.cardContent}>
              <Text style={styles.modeIcon}>👨‍⚕️</Text>
              <Text style={styles.modeTitle}>Doctor Mode</Text>
              <Text style={styles.modeDescription}>
                View patient data, monitor multiple patients, and analyze trends
              </Text>
              <View style={styles.featureList}>
                <Text style={styles.feature}>• Patient dashboard</Text>
                <Text style={styles.feature}>• Multi-patient monitoring</Text>
                <Text style={styles.feature}>• Aggregate analytics</Text>
                <Text style={styles.feature}>• Clinical reports</Text>
              </View>
            </Card.Content>
          </Card>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <Text style={styles.footer}>
        SLU Senior Design 2026 • Team: Hamza, Eric, Samir, Sage
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  modeCard: {
    elevation: 4,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  cardContent: {
    padding: 20,
    alignItems: 'center',
  },
  modeIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  featureList: {
    alignSelf: 'stretch',
    paddingLeft: 20,
  },
  feature: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  footer: {
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    marginTop: 20,
    marginBottom: 10,
  },
});

export default ModeSelection;