import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Searchbar } from 'react-native-paper';
import FirebaseService from '../services/FirebaseService';
import { Card, IconCircle, Pill, EmptyState, PrimaryButton } from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const avatarColors = ['#14B8A6', '#6366F1', '#F97316', '#8B5CF6', '#EC4899', '#F59E0B'];
const colorFor = (id) => {
  let hash = 0;
  for (let i = 0; i < (id || '').length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const timeAgo = (iso) => {
  if (!iso) return 'No sessions yet';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const PatientList = () => {
  const navigation = useNavigation();
  const [patients, setPatients] = useState([]);
  const [aggregates, setAggregates] = useState({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, []));

  const load = async () => {
    try {
      const pts = await FirebaseService.getAllPatients();
      setPatients(pts);

      // Compute per-patient stats
      const agg = {};
      for (const p of pts) {
        const sessions = await FirebaseService.getSessionsForPatient(p.id);
        const totalSev = sessions.reduce((sum, s) => sum + (s.max_severity || 0), 0);
        agg[p.id] = {
          sessionCount: sessions.length,
          lastSessionTime: sessions[0]?.start_time || null,
          avgSeverity: sessions.length > 0 ? Math.round(totalSev / sessions.length) : 0,
          lastSeverity: sessions[0]?.max_severity || 0,
        };
      }
      setAggregates(agg);
    } catch (e) {
      console.error('PatientList load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = !q.trim() ? patients : patients.filter(p =>
    p.name?.toLowerCase().includes(q.toLowerCase())
  );

  const renderPatient = ({ item: p }) => {
    const stats = aggregates[p.id] || { sessionCount: 0, lastSessionTime: null, lastSeverity: 0 };
    const color = colorFor(p.id);
    return (
      <Card
        onPress={() => navigation.navigate('PatientDetail', { patientId: p.id, patientName: p.name })}
        style={{ marginBottom: spacing.sm }}
      >
        <View style={styles.row}>
          <View style={[styles.avatar, { backgroundColor: color + '1A' }]}>
            <Text style={[styles.avatarText, { color }]}>{initials(p.name)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>{p.name}</Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {p.age ? `Age ${p.age} · ` : ''}{stats.sessionCount} session{stats.sessionCount !== 1 ? 's' : ''}
            </Text>
            <Text style={[typography.small, { color: colors.textTertiary, marginTop: 2 }]}>
              {timeAgo(stats.lastSessionTime)}
            </Text>
          </View>
          {stats.lastSessionTime && (
            <Pill label={severityLabel(stats.lastSeverity)} color={severityColor(stats.lastSeverity)} />
          )}
        </View>
      </Card>
    );
  };

  if (loading) return null;

  if (patients.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon={icons.patients}
          title="No patients yet"
          description="Add your first patient to start tracking their tremor data."
          action={() => navigation.navigate('AddPatient')}
          actionLabel="Add Patient"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchWrap}>
        <Searchbar
          placeholder="Search patients"
          value={q}
          onChangeText={setQ}
          style={styles.search}
          inputStyle={{ fontSize: 14 }}
          iconColor={colors.textTertiary}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        renderItem={renderPatient}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListEmptyComponent={
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxl }]}>
            No patients match "{q}"
          </Text>
        }
      />

      <TouchableOpacity
        style={[styles.fab, shadows.lg]}
        onPress={() => navigation.navigate('AddPatient')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name={icons.add} size={26} color={colors.textOnPrimary} />
      </TouchableOpacity>
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 16, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});

export default PatientList;
