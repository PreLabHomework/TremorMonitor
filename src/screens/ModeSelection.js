import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatabaseService from '../services/DatabaseService';
import { colors, spacing, radius, typography, shadows, icons } from '../theme';

const ModeSelection = ({ navigation }) => {
  const handleModeSelect = async (mode) => {
    try {
      await DatabaseService.setSetting('app_mode', mode);
      if (mode === 'patient') navigation.replace('PatientApp');
      else if (mode === 'doctor') navigation.replace('DoctorApp');
      else navigation.replace('ResearcherApp');
    } catch (error) {
      console.error('Error saving mode:', error);
    }
  };

  const modes = [
    {
      id: 'patient',
      title: 'Patient',
      description: 'Monitor your tremors, manage medication, and track your sessions.',
      features: ['Live tremor monitoring', 'Medication dispenser control', 'Session history'],
      color: colors.patientMode,
      icon: icons.patient,
    },
    {
      id: 'doctor',
      title: 'Doctor',
      description: 'Review patients, analyze session data, and adjust care plans.',
      features: ['Patient dashboard', 'Individual patient records', 'Medication logs'],
      color: colors.doctorMode,
      icon: icons.doctor,
    },
    {
      id: 'researcher',
      title: 'Researcher',
      description: 'Aggregate data from consenting patients for clinical research.',
      features: ['Cohort-wide analytics', 'Bulk data export', 'Anonymized sessions'],
      color: colors.researcherMode,
      icon: icons.researcher,
    },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <MaterialCommunityIcons name="pulse" size={32} color={colors.primary} />
          </View>
          <Text style={[typography.display, { color: colors.textPrimary, marginTop: spacing.md }]}>
            TremorMonitor
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
            Clinical monitoring for Parkinson's care
          </Text>
        </View>

        <Text style={[typography.caption, { color: colors.textTertiary, textAlign: 'center', marginBottom: spacing.lg, letterSpacing: 0.5 }]}>
          SELECT YOUR ROLE TO CONTINUE
        </Text>

        <View style={{ gap: spacing.md }}>
          {modes.map((m) => (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.85}
              onPress={() => handleModeSelect(m.id)}
              style={[styles.card, shadows.md]}
            >
              <View style={[styles.accentBar, { backgroundColor: m.color }]} />
              <View style={styles.cardBody}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconWrap, { backgroundColor: m.color + '1A' }]}>
                    <MaterialCommunityIcons name={m.icon} size={26} color={m.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.h2, { color: colors.textPrimary }]}>{m.title}</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                      {m.description}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
                </View>
                <View style={styles.features}>
                  {m.features.map((f, i) => (
                    <View key={i} style={styles.featureRow}>
                      <MaterialCommunityIcons name="check" size={14} color={m.color} />
                      <Text style={[typography.caption, { color: colors.textSecondary, marginLeft: 6 }]}>
                        {f}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[typography.small, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xxl }]}>
          SLU Senior Design 2026 · Hamza · Eric · Samir · Sage
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.xxxl, paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logoWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentBar: { width: 4, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    marginRight: spacing.md,
  },
  features: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 6,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center' },
});

export default ModeSelection;
