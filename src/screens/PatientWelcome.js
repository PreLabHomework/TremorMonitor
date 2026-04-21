import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';
import { Card, PrimaryButton, EmptyState } from '../components/ui';
import { colors, spacing, radius, typography, shadows, icons } from '../theme';

const initials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const avatarColors = [
  '#14B8A6', '#6366F1', '#F97316', '#8B5CF6', '#EC4899', '#F59E0B',
];

const avatarColorFor = (id) => {
  if (!id) return avatarColors[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

const PatientWelcome = ({ navigation }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadPatients(); }, []);

  const loadPatients = async () => {
    try {
      // Pull fresh from Firebase, cache locally for offline access
      const remote = await FirebaseService.getAllPatients();
      for (const p of remote) {
        await DatabaseService.addPatient({
          id: p.id,
          name: p.name,
          age: p.age,
          notes: p.notes,
        });
        // Preserve sharing preferences from Firebase
        await DatabaseService.updatePatient(p.id, {
          research_sharing: p.research_sharing ? 1 : 0,
          doctor_sharing: p.doctor_sharing ? 1 : 0,
        });
      }
      const local = await DatabaseService.getAllPatients();
      setPatients(local);
    } catch (e) {
      // If Firebase fails, fall back to local only
      const local = await DatabaseService.getAllPatients();
      setPatients(local);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPatients();
    setRefreshing(false);
  };

  const selectPatient = async (patient) => {
    await DatabaseService.setSetting('active_patient_id', patient.id);
    navigation.replace('PatientTabs');
  };

  const goToModeSelection = async () => {
    await DatabaseService.setSetting('app_mode', null);
    navigation.getParent()?.replace('ModeSelection');
  };

  if (loading) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <MaterialCommunityIcons name={icons.patient} size={30} color={colors.primary} />
          </View>
          <Text style={[typography.h1, { color: colors.textPrimary, marginTop: spacing.md }]}>
            Welcome back
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
            Select your profile to continue
          </Text>
        </View>

        {patients.length === 0 ? (
          <View style={{ marginTop: spacing.xxl }}>
            <EmptyState
              icon={icons.patient}
              title="No patients registered"
              description="Ask your doctor to add you from the Doctor portal. Pull down to refresh once added."
              action={goToModeSelection}
              actionLabel="Back to Mode Selection"
            />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {patients.map((p) => {
              const color = avatarColorFor(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  activeOpacity={0.8}
                  onPress={() => selectPatient(p)}
                  style={[styles.patientCard, shadows.sm]}
                >
                  <View style={[styles.avatar, { backgroundColor: color + '1A' }]}>
                    <Text style={[styles.avatarText, { color }]}>{initials(p.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.h3, { color: colors.textPrimary }]}>{p.name}</Text>
                    {p.age ? (
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Age {p.age}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity onPress={goToModeSelection}>
            <Text style={[typography.bodyMedium, { color: colors.primary, textAlign: 'center' }]}>
              Switch to a different portal
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  logoWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  patientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 17, fontWeight: '700' },
  footer: { marginTop: spacing.xxl, alignItems: 'center' },
});

export default PatientWelcome;
