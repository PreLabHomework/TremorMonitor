import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { BarChart } from 'react-native-chart-kit';
import FirebaseService from '../services/FirebaseService';
import {
  Card, SectionHeader, IconCircle, StatTile, EmptyState, Pill,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

const ResearchDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    cohortSize: 0,
    totalSessions: 0,
    totalTremors: 0,
    totalMinutes: 0,
    avgTremorsPerSession: 0,
    severityDistribution: [0, 0, 0, 0, 0],
  });
  const [sessions, setSessions] = useState([]);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    try {
      // Only opted-in patients
      const allPatients = await FirebaseService.getAllPatients();
      const cohort = allPatients.filter(p => p.research_sharing);
      const sess = await FirebaseService.getAllSessionsForResearch();
      setSessions(sess);

      const totalTremors = sess.reduce((sum, s) => sum + (s.tremor_count || 0), 0);
      const totalMinutes = Math.floor(sess.reduce((sum, s) => sum + (s.total_duration || 0), 0) / 60);
      const severityDistribution = [0, 0, 0, 0, 0];
      for (const s of sess) {
        const sev = s.max_severity || 0;
        if (sev >= 0 && sev <= 4) severityDistribution[sev] += 1;
      }

      setStats({
        cohortSize: cohort.length,
        totalSessions: sess.length,
        totalTremors,
        totalMinutes,
        avgTremorsPerSession: sess.length > 0
          ? (totalTremors / sess.length).toFixed(1)
          : '0',
        severityDistribution,
      });
    } catch (e) {
      console.error('ResearchDashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) return null;

  if (stats.cohortSize === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={icons.researcher}
          title="No research data yet"
          description="Patients must opt in to research sharing from their Privacy settings for their data to appear here."
        />
      </View>
    );
  }

  const chartWidth = Dimensions.get('window').width - (spacing.lg * 2) - (spacing.sm * 2);
  const maxCount = Math.max(...stats.severityDistribution, 1);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* Cohort summary */}
      <Card style={[styles.heroCard, { backgroundColor: colors.researcherMode }]}>
        <MaterialCommunityIcons name={icons.researcher} size={30} color={colors.textOnPrimary} />
        <Text style={[typography.small, { color: '#EDE9FE', letterSpacing: 1, marginTop: spacing.md }]}>
          RESEARCH COHORT
        </Text>
        <Text style={[typography.display, { color: colors.textOnPrimary, marginTop: 4 }]}>
          {stats.cohortSize} patient{stats.cohortSize !== 1 ? 's' : ''}
        </Text>
        <Text style={[typography.body, { color: '#EDE9FE', marginTop: 4 }]}>
          {stats.totalSessions} sessions · {stats.totalMinutes} minutes recorded
        </Text>
      </Card>

      {/* Stats grid */}
      <View style={[styles.statsGrid, { marginTop: spacing.lg }]}>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.count} color={colors.accent} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.totalTremors.toLocaleString()}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>TOTAL TREMORS</Text>
        </Card>
        <Card style={styles.statCard}>
          <IconCircle icon={icons.tremor} color={colors.primary} size={36} />
          <Text style={[typography.metric, { color: colors.textPrimary, marginTop: spacing.sm }]}>
            {stats.avgTremorsPerSession}
          </Text>
          <Text style={[typography.small, { color: colors.textSecondary }]}>AVG PER SESSION</Text>
        </Card>
      </View>

      {/* Severity distribution */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Severity Distribution" />
        <Card>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Peak severity per session, across the cohort
          </Text>

          {/* Custom bar chart that uses our severity colors */}
          <View style={styles.severityChart}>
            {stats.severityDistribution.map((count, sev) => {
              const heightPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <View key={sev} style={styles.severityBar}>
                  <View style={styles.barTrack}>
                    <View
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0, right: 0,
                        height: `${Math.max(heightPct, count > 0 ? 4 : 0)}%`,
                        backgroundColor: severityColor(sev),
                        borderRadius: radius.sm,
                      }}
                    />
                  </View>
                  <Text style={[typography.bodyMedium, { color: colors.textPrimary, marginTop: 6 }]}>
                    {count}
                  </Text>
                  <Text style={[typography.small, { color: colors.textSecondary }]}>
                    {severityLabel(sev)}
                  </Text>
                </View>
              );
            })}
          </View>
        </Card>
      </View>

      {/* Methodology note */}
      <View style={{ marginTop: spacing.lg }}>
        <Card style={{ backgroundColor: colors.primarySoft }} elevation="sm">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <MaterialCommunityIcons name={icons.info} size={20} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[typography.bodyMedium, { color: colors.primaryDark }]}>
                About this data
              </Text>
              <Text style={[typography.caption, { color: colors.primaryDark, marginTop: 4 }]}>
                Shows only sessions from patients who have opted into research sharing. Severity is derived from peak amplitude using a UPDRS-inspired scale. Individual patients are not identifiable from this view.
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  heroCard: { paddingVertical: spacing.xl, alignItems: 'flex-start' },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'flex-start',
  },
  severityChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    height: 200,
  },
  severityBar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: '100%',
    height: 140,
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    position: 'relative',
    overflow: 'hidden',
  },
});

export default ResearchDashboard;
