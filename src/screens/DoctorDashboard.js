import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FirebaseService from '../services/FirebaseService';
import {
  Card, SectionHeader, IconCircle, Pill, StatTile, EmptyState,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

const DoctorDashboard = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState([]);
  const [sessionsByPatient, setSessionsByPatient] = useState({});
  const [stats, setStats] = useState({
    totalPatients: 0,
    sessionsToday: 0,
    highSeverity: 0,
    tremorsToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  const load = async () => {
    try {
      const pts = await FirebaseService.getAllPatients();
      setPatients(pts);

      // Pull sessions for each patient
      const allSessions = [];
      const byPatient = {};
      for (const p of pts) {
        const sessions = await FirebaseService.getSessionsForPatient(p.id);
        byPatient[p.id] = sessions;
        sessions.forEach(s => allSessions.push({ ...s, patient_name: p.name }));
      }
      setSessionsByPatient(byPatient);

      // Compute stats
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);

      const todaySessions = allSessions.filter(s => new Date(s.start_time) >= today);
      const weekHighSev = allSessions.filter(s =>
        new Date(s.start_time) >= weekAgo && (s.max_severity || 0) >= 3
      );
      const tremorsToday = todaySessions.reduce((sum, s) => sum + (s.tremor_count || 0), 0);

      setStats({
        totalPatients: pts.length,
        sessionsToday: todaySessions.length,
        highSeverity: weekHighSev.length,
        tremorsToday,
      });

      // Recent activity — last 5 sessions across all patients
      const recent = allSessions
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
        .slice(0, 5);
      setRecentActivity(recent);

    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openPatient = (patientId, patientName) => {
    navigation.navigate('PatientDetail', { patientId, patientName });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.patients} color={colors.doctorMode} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.totalPatients}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>PATIENTS</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.history} color={colors.primary} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.sessionsToday}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>TODAY'S SESSIONS</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.warning} color={colors.error} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.highSeverity}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>HIGH SEVERITY · 7D</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.tremor} color={colors.accent} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.tremorsToday}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>TREMORS TODAY</Text>
        </Card>
      </View>

      {/* Recent activity */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader
          title="Recent Activity"
          action={() => navigation.navigate('Patients')}
          actionLabel="See all"
        />
        {recentActivity.length === 0 ? (
          <Card>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              No sessions have been uploaded yet.
            </Text>
          </Card>
        ) : (
          <Card padding={0}>
            {recentActivity.map((s, i) => {
              const start = new Date(s.start_time);
              const patient = patients.find(p => p.id === s.patient_id);
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => openPatient(s.patient_id, patient?.name || 'Patient')}
                  style={[
                    styles.activityRow,
                    i < recentActivity.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <IconCircle
                    icon={icons.tremor}
                    color={severityColor(s.max_severity || 0)}
                    size={40}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {s.patient_name}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {(s.tremor_count || 0)} tremors · {Math.floor((s.total_duration || 0) / 60)}m · {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <Pill label={severityLabel(s.max_severity || 0)} color={severityColor(s.max_severity || 0)} />
                </TouchableOpacity>
              );
            })}
          </Card>
        )}
      </View>

      {/* System status */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="System Status" />
        <Card padding={0}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[typography.body, { color: colors.textPrimary }]}>Cloud sync connected</Text>
          </View>
          <View style={[styles.statusRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              {patients.length} patient{patients.length !== 1 ? 's' : ''} registered
            </Text>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    alignItems: 'flex-start',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  statusDot: {
    width: 10, height: 10, borderRadius: 5,
    marginRight: spacing.md,
  },
});

export default DoctorDashboard;
