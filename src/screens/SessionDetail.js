import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Share, Dimensions,
} from 'react-native';
import { DataTable } from 'react-native-paper';
import { LineChart } from 'react-native-chart-kit';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatabaseService from '../services/DatabaseService';
import {
  Card, PrimaryButton, SecondaryButton, SectionHeader,
  StatTile, SeverityPill, IconCircle,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const SessionDetail = ({ route, navigation }) => {
  const { sessionId } = route.params;
  const [session, setSession] = useState(null);
  const [features, setFeatures] = useState([]);
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const rowsPerPage = 10;

  useEffect(() => { load(); }, [sessionId]);

  const load = async () => {
    try {
      const [s, f, e] = await Promise.all([
        DatabaseService.getSession(sessionId),
        DatabaseService.getSessionFeatures(sessionId),
        DatabaseService.getSessionEvents(sessionId),
      ]);
      setSession(s);
      setFeatures(f);
      setEvents(e);
    } catch (err) {
      Alert.alert('Error', 'Could not load session');
    } finally {
      setLoading(false);
    }
  };

  const onExport = async () => {
    try {
      const csv = await DatabaseService.exportSessionToCSV(sessionId);
      await Share.share({
        message: csv,
        title: `TremorMonitor Session ${sessionId}`,
      });
    } catch (e) {
      Alert.alert('Export error', e.message);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete session?',
      'This will remove the session and all its data locally. Cloud copies are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await DatabaseService.deleteSession(sessionId);
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading || !session) return null;

  const start = new Date(session.start_time);
  const end = session.end_time ? new Date(session.end_time) : null;

  // Chart — amplitude over session
  const maxPoints = 12;
  const step = Math.max(1, Math.floor(features.length / maxPoints));
  const sampled = features.filter((_, i) => i % step === 0);
  const chartLabels = sampled.map((f, i) => {
    if (i === 0 || i === sampled.length - 1 || i === Math.floor(sampled.length / 2)) {
      return new Date(f.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return '';
  });
  const chartData = sampled.map((f) => f.amplitude);
  const hasChartData = chartData.length > 1;

  const pageStart = page * rowsPerPage;
  const pageEnd = Math.min(pageStart + rowsPerPage, features.length);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Card style={[styles.headerCard, { backgroundColor: colors.primary }]}>
        <Text style={[typography.small, { color: colors.primaryLight, letterSpacing: 1 }]}>
          SESSION {session.id}
        </Text>
        <Text style={[typography.h1, { color: colors.textOnPrimary, marginTop: 4 }]}>
          {start.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
        </Text>
        <Text style={[typography.body, { color: colors.primaryLight, marginTop: 2 }]}>
          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {end && ` — ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        </Text>
        <View style={{ marginTop: spacing.md }}>
          <SeverityPill severity={session.max_severity} />
        </View>
      </Card>

      {/* Stats row 1 */}
      <View style={{ marginTop: spacing.lg }}>
        <Card>
          <View style={styles.metrics}>
            <StatTile
              value={formatDuration(session.total_duration)}
              label="Duration"
              icon={icons.duration}
              color={colors.primary}
            />
            <StatTile
              value={session.tremor_count}
              label="Tremors"
              icon={icons.count}
              color={colors.primary}
            />
          </View>
          <View style={[styles.metrics, { marginTop: spacing.lg }]}>
            <StatTile
              value={session.peak_amplitude.toFixed(2)}
              label="Peak m/s²"
              icon={icons.amplitude}
              color={severityColor(session.max_severity)}
            />
            <StatTile
              value={session.avg_amplitude.toFixed(2)}
              label="Avg m/s² (tremor)"
              icon={icons.amplitude}
              color={colors.textPrimary}
            />
          </View>
        </Card>
      </View>

      {/* Amplitude chart */}
      {hasChartData && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Amplitude Over Time" />
          <Card padding={spacing.sm}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <LineChart
                data={{
                  labels: chartLabels,
                  datasets: [{ data: chartData }],
                }}
                width={Math.max(Dimensions.get('window').width - 64, chartData.length * 50)}
                height={200}
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  decimalPlaces: 2,
                  color: (o = 1) => `rgba(20, 184, 166, ${o})`,
                  labelColor: (o = 1) => `rgba(100, 116, 139, ${o})`,
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: colors.primary,
                  },
                  propsForBackgroundLines: {
                    stroke: colors.border,
                    strokeDasharray: '3',
                  },
                }}
                bezier
                withInnerLines
                withOuterLines={false}
                yAxisSuffix=" m/s²"
                style={{ paddingRight: 0 }}
              />
            </ScrollView>
          </Card>
        </View>
      )}

      {/* Tremor events */}
      {events.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title={`Tremor Events (${events.length})`} />
          <Card padding={0}>
            {events.map((ev, i) => (
              <View
                key={ev.id}
                style={[
                  styles.eventRow,
                  i < events.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <IconCircle icon={icons.tremor} color={colors.accent} size={36} iconSize={16} />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                    Event #{i + 1} — {ev.duration}s
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                    Peak {ev.peak_amplitude.toFixed(2)} m/s² · {new Date(ev.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Raw data */}
      {features.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Packet Data" />
          <Card padding={0}>
            <DataTable>
              <DataTable.Header>
                <DataTable.Title>Time</DataTable.Title>
                <DataTable.Title numeric>Amplitude</DataTable.Title>
                <DataTable.Title numeric>Severity</DataTable.Title>
              </DataTable.Header>
              {features.slice(pageStart, pageEnd).map((f) => {
                const t = new Date(f.timestamp);
                return (
                  <DataTable.Row key={f.id}>
                    <DataTable.Cell>
                      {t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </DataTable.Cell>
                    <DataTable.Cell numeric>{f.amplitude.toFixed(2)}</DataTable.Cell>
                    <DataTable.Cell numeric>
                      {f.tremor_detected ? `${f.severity}/4` : '—'}
                    </DataTable.Cell>
                  </DataTable.Row>
                );
              })}
              <DataTable.Pagination
                page={page}
                numberOfPages={Math.ceil(features.length / rowsPerPage)}
                onPageChange={setPage}
                label={`${pageStart + 1}–${pageEnd} of ${features.length}`}
                numberOfItemsPerPage={rowsPerPage}
              />
            </DataTable>
          </Card>
        </View>
      )}

      {/* Actions */}
      <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <PrimaryButton label="Export as CSV" icon={icons.export} onPress={onExport} />
        <SecondaryButton
          label="Delete Session"
          icon={icons.delete}
          color={colors.error}
          onPress={onDelete}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  headerCard: { paddingVertical: spacing.xl },
  metrics: { flexDirection: 'row', gap: spacing.md },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
});

export default SessionDetail;
