import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FirebaseService from '../services/FirebaseService';
import DatabaseService from '../services/DatabaseService';
import {
  Card, SectionHeader, IconCircle, Pill, StatTile, SeverityPill, EmptyState, Divider,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const PatientDetail = ({ route }) => {
  const { patientId, patientName } = route.params;
  const navigation = useNavigation();
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [medLogs, setMedLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, [patientId]);

  const load = async () => {
    try {
      // Get patient profile from Firebase (source of truth for sharing prefs)
      const allPatients = await FirebaseService.getAllPatients();
      const p = allPatients.find(x => x.id === patientId);
      setPatient(p);

      const sess = await FirebaseService.getSessionsForPatient(patientId);
      setSessions(sess);

      if (p?.doctor_sharing) {
        const logs = await FirebaseService.getMedicationLogsForPatient(patientId);
        setMedLogs(logs);
      } else {
        setMedLogs([]);
      }
    } catch (e) {
      console.error('PatientDetail load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDeletePatient = () => {
    Alert.alert(
      'Remove patient?',
      `This will remove ${patientName} from the registry. Their session data will remain in Firebase but won't show in the patient list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await FirebaseService.deletePatient(patientId);
            await DatabaseService.deletePatient(patientId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading || !patient) return null;

  // Aggregate stats
  const totalSessions = sessions.length;
  const totalTremors = sessions.reduce((sum, s) => sum + (s.tremor_count || 0), 0);
  const totalMinutes = Math.floor(sessions.reduce((sum, s) => sum + (s.total_duration || 0), 0) / 60);
  const avgSeverity = totalSessions > 0
    ? Math.round(sessions.reduce((sum, s) => sum + (s.max_severity || 0), 0) / totalSessions)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Profile card */}
      <Card>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(patient.name)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.h2, { color: colors.textPrimary }]}>{patient.name}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {patient.age ? `Age ${patient.age}` : 'Age not set'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {patient.doctor_sharing && <Pill label="Sharing enabled" color={colors.success} icon={icons.check} />}
              {patient.research_sharing && <Pill label="Research" color={colors.researcherMode} icon={icons.researcher} />}
            </View>
          </View>
        </View>
        {patient.notes ? (
          <>
            <Divider style={{ marginVertical: spacing.md }} />
            <Text style={[typography.small, { color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 4 }]}>
              NOTES
            </Text>
            <Text style={[typography.body, { color: colors.textPrimary }]}>
              {patient.notes}
            </Text>
          </>
        ) : null}
      </Card>

      {/* Aggregate stats */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Overview" />
        <Card>
          <View style={styles.statsRow}>
            <StatTile value={totalSessions} label="Sessions" icon={icons.history} color={colors.textPrimary} />
            <StatTile value={totalTremors} label="Tremors" icon={icons.count} color={colors.textPrimary} />
          </View>
          <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
            <StatTile value={`${totalMinutes}m`} label="Recorded" icon={icons.duration} color={colors.textPrimary} />
            <View style={{ flex: 1 }}>
              <Text style={[typography.small, { color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 4 }]}>
                AVG SEVERITY
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <SeverityPill severity={avgSeverity} />
              </View>
            </View>
          </View>
        </Card>
      </View>

      {/* Sessions */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title={`Sessions (${sessions.length})`} />
        {sessions.length === 0 ? (
          <Card>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              This patient hasn't recorded any sessions yet.
            </Text>
          </Card>
        ) : (
          <Card padding={0}>
            {sessions.slice(0, 10).map((s, i) => {
              const start = new Date(s.start_time);
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => navigation.navigate('SessionDetail', { sessionId: s.local_session_id })}
                  style={[
                    styles.sessionRow,
                    i < Math.min(sessions.length, 10) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                >
                  <IconCircle
                    icon={icons.tremor}
                    color={severityColor(s.max_severity || 0)}
                    size={40}
                  />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                      {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {s.tremor_count || 0} tremors · {formatDuration(s.total_duration || 0)} · peak {(s.peak_amplitude || 0).toFixed(2)}
                    </Text>
                  </View>
                  <SeverityPill severity={s.max_severity || 0} />
                </TouchableOpacity>
              );
            })}
          </Card>
        )}
      </View>

      {/* Medication log */}
      {patient.doctor_sharing && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={`Medication Log (${medLogs.length})`} />
          {medLogs.length === 0 ? (
            <Card>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
                No medications recorded.
              </Text>
            </Card>
          ) : (
            <Card padding={0}>
              {medLogs.slice(0, 15).map((log, i) => {
                const t = new Date(log.timestamp);
                return (
                  <View
                    key={log.id}
                    style={[
                      styles.logRow,
                      i < Math.min(medLogs.length, 15) - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                    ]}
                  >
                    <IconCircle
                      icon={log.trigger_type === 'auto' ? 'auto-fix' : 'gesture-tap'}
                      color={log.trigger_type === 'auto' ? colors.accent : colors.primary}
                      size={36}
                      iconSize={16}
                    />
                    <View style={{ flex: 1, marginLeft: spacing.md }}>
                      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                        {log.pill_count} pill{log.pill_count > 1 ? 's' : ''} · {log.trigger_type}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                        {t.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      )}

      {/* Danger zone */}
      <View style={{ marginTop: spacing.xl }}>
        <TouchableOpacity onPress={onDeletePatient} style={styles.dangerBtn}>
          <MaterialCommunityIcons name={icons.delete} size={18} color={colors.error} />
          <Text style={[typography.bodyMedium, { color: colors.error, marginLeft: 8 }]}>
            Remove Patient
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.doctorMode + '1A',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.doctorMode },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
});

export default PatientDetail;
