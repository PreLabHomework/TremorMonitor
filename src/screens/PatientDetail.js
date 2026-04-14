import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Card, Avatar, Chip } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import DatabaseService from '../services/DatabaseService';

const PatientDetail = ({ route }) => {
  const { patientId, patientName } = route.params;
  const navigation = useNavigation();
  const [sessions, setSessions] = useState([]);
  const [patientStats, setPatientStats] = useState({
    totalSessions: 0,
    avgSeverity: 0,
    totalEpisodes: 0,
    peakAmplitude: 0,
  });

  useEffect(() => {
    loadPatientData();
  }, []);

  const loadPatientData = async () => {
    try {
      // In real app, filter by patient ID
      // For MVP, showing all sessions as if they're from this patient
      const allSessions = await DatabaseService.getAllSessions();
      
      setSessions(allSessions);
      
      // Calculate stats
      const total = allSessions.length;
      const avgSev = total > 0
        ? allSessions.reduce((sum, s) => sum + (s.peak_amplitude / 4 * 4), 0) / total
        : 0;
      const episodes = allSessions.reduce((sum, s) => sum + s.episode_count, 0);
      const peak = Math.max(...allSessions.map(s => s.peak_amplitude), 0);
      
      setPatientStats({
        totalSessions: total,
        avgSeverity: avgSev,
        totalEpisodes: episodes,
        peakAmplitude: peak,
      });
      
    } catch (error) {
      console.error('❌ Error loading patient data:', error);
    }
  };

  const getSeverityColor = (amplitude) => {
    if (amplitude < 0.5) return '#4CAF50';
    if (amplitude < 1.0) return '#8BC34A';
    if (amplitude < 2.0) return '#FFC107';
    if (amplitude < 4.0) return '#FF9800';
    return '#F44336';
  };

  const getSeverityLabel = (amplitude) => {
    if (amplitude < 0.5) return 'Mild';
    if (amplitude < 1.0) return 'Light';
    if (amplitude < 2.0) return 'Moderate';
    if (amplitude < 4.0) return 'Strong';
    return 'Severe';
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const getInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase();
  };

  return (
    <ScrollView style={styles.container}>
      {/* Patient Header */}
      <Card style={styles.headerCard}>
        <Card.Content style={styles.headerContent}>
          <Avatar.Text
            size={72}
            label={getInitials(patientName)}
            style={styles.avatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.patientName}>{patientName}</Text>
            <Text style={styles.patientId}>ID: {patientId}</Text>
            <Chip style={styles.activeChip} textStyle={styles.activeText}>
              Active Patient
            </Chip>
          </View>
        </Card.Content>
      </Card>

      {/* Stats Overview */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Overall Statistics</Text>
          
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{patientStats.totalSessions}</Text>
              <Text style={styles.statLabel}>Total Sessions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{patientStats.avgSeverity.toFixed(1)}</Text>
              <Text style={styles.statLabel}>Avg Severity</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{patientStats.totalEpisodes}</Text>
              <Text style={styles.statLabel}>Total Episodes</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: getSeverityColor(patientStats.peakAmplitude) }]}>
                {patientStats.peakAmplitude.toFixed(1)}
              </Text>
              <Text style={styles.statLabel}>Peak Amplitude</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Sessions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>
            Recent Sessions ({sessions.length})
          </Text>
          
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions recorded</Text>
          ) : (
            sessions.slice(0, 10).map((session) => {
              const startDate = new Date(session.start_time);
              const severityColor = getSeverityColor(session.peak_amplitude);
              const severityLabel = getSeverityLabel(session.peak_amplitude);
              
              return (
                <TouchableOpacity
                  key={session.id}
                  onPress={() => navigation.navigate('SessionDetail', { sessionId: session.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.sessionItem}>
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionDate}>
                        {startDate.toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.sessionTime}>
                        {startDate.toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Chip
                        style={[styles.severityChip, { backgroundColor: severityColor }]}
                        textStyle={styles.severityText}
                      >
                        {severityLabel}
                      </Chip>
                    </View>
                    
                    <View style={styles.sessionStats}>
                      <Text style={styles.sessionStat}>
                        {formatDuration(session.total_duration)}
                      </Text>
                      <Text style={styles.sessionStat}>
                        {session.episode_count} episodes
                      </Text>
                      <Text style={styles.sessionStat}>
                        {session.peak_amplitude.toFixed(1)} m/s²
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
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
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#1976D2',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    backgroundColor: '#fff',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  patientName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  patientId: {
    fontSize: 14,
    color: '#E3F2FD',
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: '#4CAF50',
    alignSelf: 'flex-start',
  },
  activeText: {
    color: '#fff',
    fontSize: 12,
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  sessionItem: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionTime: {
    fontSize: 14,
    color: '#666',
  },
  severityChip: {
    height: 24,
  },
  severityText: {
    color: '#fff',
    fontSize: 11,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  sessionStat: {
    fontSize: 13,
    color: '#666',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 20,
  },
  bottomSpacer: {
    height: 32,
  },
});

export default PatientDetail;