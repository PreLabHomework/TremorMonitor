import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Card, Button } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DatabaseService from '../services/DatabaseService';

const DoctorDashboard = () => {
  const navigation = useNavigation();
  const [stats, setStats] = useState({
    totalPatients: 0,
    activeSessions: 0,
    highSeverityAlerts: 0,
    todayEpisodes: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      loadDashboardData();
    }, [])
  );

  const loadDashboardData = async () => {
    try {
      // In a real app, this would fetch from a backend
      // For MVP, we'll show demo data
      
      // Get all sessions (simulating multiple patients)
      const allSessions = await DatabaseService.getAllSessions();
      
      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const todaySessions = allSessions.filter(s => 
        new Date(s.start_time) >= today
      );
      
      const highSeverity = allSessions.filter(s => 
        s.peak_amplitude >= 2.0
      );
      
      setStats({
        totalPatients: 5, // Demo data
        activeSessions: todaySessions.length,
        highSeverityAlerts: highSeverity.length,
        todayEpisodes: todaySessions.reduce((sum, s) => sum + s.episode_count, 0),
      });
      
      // Recent activity (last 5 sessions)
      const recent = allSessions.slice(0, 5).map((session, index) => {
        const patientNames = ['John D.', 'Mary S.', 'Robert K.', 'Lisa M.', 'James T.'];
        return {
          id: session.id,
          patientName: patientNames[index % 5],
          activity: session.end_time ? 'Session ended' : 'Active session',
          time: new Date(session.start_time).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          }),
          severity: session.peak_amplitude >= 2.0 ? 'high' : 'normal',
          episodeCount: session.episode_count,
        };
      });
      
      setRecentActivity(recent);
      
    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Doctor Dashboard</Text>
        <Text style={styles.subtitle}>Overview & Monitoring</Text>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text style={styles.statValue}>{stats.totalPatients}</Text>
            <Text style={styles.statLabel}>Total Patients</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text style={styles.statValue}>{stats.activeSessions}</Text>
            <Text style={styles.statLabel}>Active Sessions</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text style={[styles.statValue, { color: '#F44336' }]}>
              {stats.highSeverityAlerts}
            </Text>
            <Text style={styles.statLabel}>High Severity</Text>
          </Card.Content>
        </Card>

        <Card style={styles.statCard}>
          <Card.Content style={styles.statContent}>
            <Text style={styles.statValue}>{stats.todayEpisodes}</Text>
            <Text style={styles.statLabel}>Today's Episodes</Text>
          </Card.Content>
        </Card>
      </View>

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Patients')}
            style={styles.actionButton}
            icon="account-group"
          >
            View All Patients
          </Button>
        </Card.Content>
      </Card>

      {/* Recent Activity */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity</Text>
          ) : (
            recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityPatient}>{activity.patientName}</Text>
                  <Text style={styles.activityTime}>{activity.time}</Text>
                </View>
                <Text style={styles.activityText}>
                  {activity.activity} • {activity.episodeCount} episodes
                </Text>
                {activity.severity === 'high' && (
                  <Text style={styles.severityBadge}>⚠️ High Severity</Text>
                )}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* System Status */}
      <Card style={styles.card}>
        <Card.Content>
          <Text style={styles.sectionTitle}>System Status</Text>
          
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusText}>Database: Connected</Text>
          </View>
          
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.statusText}>Patient Devices: 3/5 Online</Text>
          </View>
          
          <View style={styles.statusItem}>
            <View style={[styles.statusDot, { backgroundColor: '#FFC107' }]} />
            <Text style={styles.statusText}>Sync Queue: 2 pending</Text>
          </View>
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
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#fff',
    elevation: 2,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1976D2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    margin: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  actionButton: {
    marginBottom: 12,
  },
  activityItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  activityPatient: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  activityTime: {
    fontSize: 14,
    color: '#666',
  },
  activityText: {
    fontSize: 14,
    color: '#666',
  },
  severityBadge: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 4,
    fontWeight: '600',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#333',
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

export default DoctorDashboard;