import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Searchbar } from 'react-native-paper';
import DatabaseService from '../services/DatabaseService';
import {
  Card, SeverityPill, EmptyState, StatTile, IconCircle,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor,
} from '../theme';

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const getWeekLabel = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  if (diffDays < 14) return 'Last Week';
  if (diffDays < 30) return 'This Month';
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
};

const groupByWeek = (sessions) => {
  const map = {};
  for (const s of sessions) {
    const key = getWeekLabel(s.start_time);
    (map[key] = map[key] || []).push(s);
  }
  return Object.keys(map).map((k) => ({ label: k, sessions: map[k] }));
};

const History = () => {
  const navigation = useNavigation();
  const [sessions, setSessions] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  const load = async () => {
    try {
      const pid = await DatabaseService.getSetting('active_patient_id', null);
      const data = await DatabaseService.getAllSessions(pid);
      setSessions(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onSearch = (text) => {
    setQ(text);
    if (!text.trim()) { setFiltered(sessions); return; }
    const lower = text.toLowerCase();
    setFiltered(sessions.filter((s) => {
      return (
        new Date(s.start_time).toLocaleDateString().toLowerCase().includes(lower) ||
        new Date(s.start_time).toLocaleTimeString().toLowerCase().includes(lower) ||
        (s.notes || '').toLowerCase().includes(lower)
      );
    }));
  };

  const renderSession = (s) => {
    const start = new Date(s.start_time);
    return (
      <Card
        key={s.id}
        onPress={() => navigation.navigate('SessionDetail', { sessionId: s.id })}
        style={{ marginBottom: spacing.sm }}
      >
        <View style={styles.row}>
          <IconCircle
            icon={icons.tremor}
            color={severityColor(s.max_severity)}
            size={44}
            iconSize={22}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              {start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <SeverityPill severity={s.max_severity} />
        </View>

        <View style={styles.metrics}>
          <StatTile
            value={formatDuration(s.total_duration)}
            label="Duration"
            color={colors.textPrimary}
          />
          <StatTile
            value={s.tremor_count}
            label="Tremors"
            color={colors.textPrimary}
          />
          <StatTile
            value={s.peak_amplitude.toFixed(2)}
            label="Peak m/s²"
            color={colors.textPrimary}
          />
        </View>
      </Card>
    );
  };

  if (loading) return null;

  if (sessions.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={icons.history}
          title="No sessions yet"
          description="Recorded sessions will appear here. Go to Live to start your first."
        />
      </View>
    );
  }

  const grouped = groupByWeek(filtered);

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search sessions"
          onChangeText={onSearch}
          value={q}
          style={styles.search}
          inputStyle={{ fontSize: 14 }}
          iconColor={colors.textTertiary}
        />
      </View>

      <FlatList
        data={grouped}
        keyExtractor={(item) => item.label}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.caption, styles.weekLabel]}>
              {item.label.toUpperCase()}
            </Text>
            {item.sessions.map(renderSession)}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  weekLabel: {
    color: colors.textTertiary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  metrics: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default History;
