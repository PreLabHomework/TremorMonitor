import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Share, RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FirebaseService from '../services/FirebaseService';
import {
  Card, PrimaryButton, SectionHeader, IconCircle, StatTile, EmptyState,
} from '../components/ui';
import { colors, spacing, radius, typography, icons } from '../theme';

// Build CSV from aggregated research sessions
const buildCSV = (sessions) => {
  let csv = '';

  // Summary header
  csv += `# TremorMonitor Research Export\n`;
  csv += `# Generated: ${new Date().toISOString()}\n`;
  csv += `# Sessions: ${sessions.length}\n`;
  csv += `# All patients in this export have opted into research sharing.\n`;
  csv += `\n`;

  // Sessions table
  csv += `--- Sessions ---\n`;
  csv += `session_id,patient_id,start_time,end_time,duration_sec,tremor_count,peak_amplitude,avg_amplitude,max_severity\n`;
  for (const s of sessions) {
    csv += [
      s.id,
      s.patient_id || '',
      s.start_time,
      s.end_time || '',
      s.total_duration || 0,
      s.tremor_count || 0,
      (s.peak_amplitude || 0).toFixed(3),
      (s.avg_amplitude || 0).toFixed(3),
      s.max_severity || 0,
    ].join(',') + '\n';
  }
  csv += `\n`;

  // Features table — all per-packet data across all sessions
  csv += `--- Per-Window Features ---\n`;
  csv += `session_id,patient_id,timestamp,amplitude,tremor_detected,severity\n`;
  for (const s of sessions) {
    const features = s.features || [];
    for (const f of features) {
      csv += [
        s.id,
        s.patient_id || '',
        f.timestamp,
        f.amplitude.toFixed(3),
        f.tremor_detected ? 1 : 0,
        f.severity || 0,
      ].join(',') + '\n';
    }
  }
  csv += `\n`;

  // Events table
  csv += `--- Tremor Events ---\n`;
  csv += `session_id,patient_id,start_time,end_time,duration_sec,peak_amplitude\n`;
  for (const s of sessions) {
    const events = s.tremor_events || [];
    for (const e of events) {
      csv += [
        s.id,
        s.patient_id || '',
        e.start_time,
        e.end_time,
        e.duration || 0,
        (e.peak_amplitude || 0).toFixed(3),
      ].join(',') + '\n';
    }
  }

  return csv;
};

const ResearchExport = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [stats, setStats] = useState({
    sessions: 0,
    packets: 0,
    events: 0,
    bytes: 0,
  });

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    try {
      const sess = await FirebaseService.getAllSessionsForResearch();
      setSessions(sess);

      const packets = sess.reduce((sum, s) => sum + (s.features?.length || 0), 0);
      const events = sess.reduce((sum, s) => sum + (s.tremor_events?.length || 0), 0);
      // Rough estimate: ~80 bytes per feature row + overhead
      const bytes = packets * 90 + sess.length * 200 + events * 120;

      setStats({ sessions: sess.length, packets, events, bytes });
    } catch (e) {
      console.error('ResearchExport load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onExport = async () => {
    if (sessions.length === 0) return;
    setExporting(true);
    try {
      const csv = buildCSV(sessions);
      await Share.share({
        title: `TremorMonitor Research Export (${sessions.length} sessions)`,
        message: csv,
      });
    } catch (e) {
      Alert.alert('Export error', e.message || 'Could not generate export.');
    } finally {
      setExporting(false);
    }
  };

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return null;

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={icons.export}
          title="Nothing to export"
          description="There are no sessions from research-opted patients available for export yet."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <IconCircle icon={icons.export} color={colors.researcherMode} size={64} iconSize={30} />
        <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>
          Bulk Data Export
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg }]}>
          Export all sessions from research-opted patients as CSV.
        </Text>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Export Contents" />
        <Card>
          <View style={styles.statsRow}>
            <StatTile
              value={stats.sessions}
              label="Sessions"
              icon={icons.history}
              color={colors.textPrimary}
            />
            <StatTile
              value={stats.packets.toLocaleString()}
              label="Data Points"
              icon={icons.chart}
              color={colors.textPrimary}
            />
          </View>
          <View style={[styles.statsRow, { marginTop: spacing.lg }]}>
            <StatTile
              value={stats.events}
              label="Tremor Events"
              icon={icons.tremor}
              color={colors.textPrimary}
            />
            <StatTile
              value={formatBytes(stats.bytes)}
              label="Estimated Size"
              icon={icons.table}
              color={colors.textPrimary}
            />
          </View>
        </Card>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="CSV Structure" />
        <Card>
          <View style={styles.structItem}>
            <MaterialCommunityIcons name="table-row" size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Sessions</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                One row per recording session with aggregate stats
              </Text>
            </View>
          </View>
          <View style={[styles.structItem, { marginTop: spacing.md }]}>
            <MaterialCommunityIcons name="table-row" size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Per-window features</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Raw packets: amplitude, tremor flag, and derived severity per 30s window
              </Text>
            </View>
          </View>
          <View style={[styles.structItem, { marginTop: spacing.md }]}>
            <MaterialCommunityIcons name="table-row" size={18} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Tremor events</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Contiguous windows grouped into discrete tremor episodes
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label={`Export ${stats.sessions} Session${stats.sessions !== 1 ? 's' : ''}`}
          icon={icons.export}
          loading={exporting}
          onPress={onExport}
          color={colors.researcherMode}
        />
      </View>

      <Text style={[typography.small, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.lg }]}>
        Patient IDs are included but names are not. No identifying information leaves the app.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  structItem: { flexDirection: 'row', alignItems: 'flex-start' },
});

export default ResearchExport;
