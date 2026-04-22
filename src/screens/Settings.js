import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, TextInput, Alert, TouchableOpacity,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';
import NotificationService from '../services/NotificationService';
import {
  Card, SectionHeader, IconCircle, PrimaryButton, SecondaryButton, Divider,
} from '../components/ui';
import { colors, spacing, radius, typography, shadows, icons } from '../theme';
import { seedDemoData, clearDemoData } from '../demo/DemoSeeder';

const Row = ({ icon, iconColor, title, subtitle, right }) => (
  <View style={styles.row}>
    {icon && (
      <IconCircle icon={icon} color={iconColor || colors.primary} size={36} iconSize={18} />
    )}
    <View style={{ flex: 1, marginLeft: icon ? spacing.md : 0 }}>
      <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? (
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right}
  </View>
);

const Settings = () => {
  const navigation = useNavigation();
  const [mode, setMode] = useState('patient');
  const [patient, setPatient] = useState(null);

  // Patient profile editing
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [notes, setNotes] = useState('');

  // Medication
  const [medicationMode, setMedicationMode] = useState('manual');

  // Notifications
  const [notifyTremor, setNotifyTremor] = useState(false);
  const [notifyMed, setNotifyMed] = useState(false);
  const [notifyDaily, setNotifyDaily] = useState(false);

  // Privacy
  const [researchSharing, setResearchSharing] = useState(false);
  const [doctorSharing, setDoctorSharing] = useState(true);

  useFocusEffect(
    useCallback(() => { load(); }, [])
  );

  useEffect(() => {
    NotificationService.init();
  }, []);

  const load = async () => {
    const m = await DatabaseService.getSetting('app_mode', 'patient');
    setMode(m);

    if (m === 'patient') {
      const pid = await DatabaseService.getSetting('active_patient_id', null);
      if (pid) {
        const p = await DatabaseService.getPatient(pid);
        if (p) {
          setPatient(p);
          setName(p.name || '');
          setAge(p.age ? String(p.age) : '');
          setNotes(p.notes || '');
          setResearchSharing(!!p.research_sharing);
          setDoctorSharing(!!p.doctor_sharing);
        }
      }
    }

    setMedicationMode(await DatabaseService.getSetting('medication_mode', 'manual'));
    setNotifyTremor(await DatabaseService.getSetting('notify_tremor', false));
    setNotifyMed(await DatabaseService.getSetting('notify_medication', false));
    setNotifyDaily(await DatabaseService.getSetting('notify_daily', false));
  };

  const saveProfile = async () => {
    if (!patient) return;
    const ageNum = age ? parseInt(age, 10) : null;
    await DatabaseService.updatePatient(patient.id, {
      name: name.trim() || patient.name,
      age: ageNum,
      notes: notes.trim() || null,
    });
    // Sync to Firebase
    const updated = await DatabaseService.getPatient(patient.id);
    setPatient(updated);
    FirebaseService.upsertPatient(updated).catch(() => {});
    setEditingProfile(false);
    Alert.alert('Saved', 'Profile updated.');
  };

  const onToggleMedicationMode = async (v) => {
    const next = v ? 'auto' : 'manual';
    setMedicationMode(next);
    await DatabaseService.setSetting('medication_mode', next);
  };

  const onToggleNotif = async (key, current, setter, label) => {
    const next = !current;
    setter(next);
    await DatabaseService.setSetting(key, next);
    if (next) {
      // Proof of work — fire one real notification
      await NotificationService.toggleEnabledConfirmation(label);
    }
  };

  const onToggleResearch = async (v) => {
    if (!patient) return;
    setResearchSharing(v);
    await DatabaseService.updatePatient(patient.id, { research_sharing: v ? 1 : 0 });
    const updated = await DatabaseService.getPatient(patient.id);
    FirebaseService.upsertPatient(updated).catch(() => {});
  };

  const onToggleDoctor = async (v) => {
    if (!patient) return;
    setDoctorSharing(v);
    await DatabaseService.updatePatient(patient.id, { doctor_sharing: v ? 1 : 0 });
    const updated = await DatabaseService.getPatient(patient.id);
    FirebaseService.upsertPatient(updated).catch(() => {});
  };

  const switchPortal = () => {
    Alert.alert(
      'Switch Portal',
      'Return to the mode selection screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            await DatabaseService.setSetting('app_mode', null);
            // Reset the root navigator
            navigation.getParent()?.getParent()?.reset({
              index: 0,
              routes: [{ name: 'ModeSelection' }],
            });
          },
        },
      ]
    );
  };

  const clearLocalData = () => {
    Alert.alert(
      'Clear all local data?',
      'This removes sessions, patients, and logs from this device only. Cloud data is preserved.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await DatabaseService.clearAllData();
            Alert.alert('Cleared', 'Local data removed.');
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Mode badge */}
      <Card padding={spacing.md} style={styles.modeBadge}>
        <IconCircle
          icon={mode === 'patient' ? icons.patient : mode === 'doctor' ? icons.doctor : icons.researcher}
          color={
            mode === 'patient' ? colors.patientMode :
            mode === 'doctor' ? colors.doctorMode :
            colors.researcherMode
          }
          size={40}
        />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>ACTIVE PORTAL</Text>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {mode === 'patient' ? 'Patient' : mode === 'doctor' ? 'Doctor' : 'Researcher'}
          </Text>
        </View>
      </Card>

      {/* Patient profile (patient mode only) */}
      {mode === 'patient' && patient && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title="Your Profile"
            action={() => setEditingProfile(!editingProfile)}
            actionLabel={editingProfile ? 'Cancel' : 'Edit'}
          />
          <Card>
            {!editingProfile ? (
              <>
                <Row title="Name" subtitle={patient.name} />
                <Divider style={{ marginVertical: spacing.sm }} />
                <Row title="Age" subtitle={patient.age ? String(patient.age) : 'Not set'} />
                <Divider style={{ marginVertical: spacing.sm }} />
                <Row title="Notes" subtitle={patient.notes || 'None'} />
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  style={styles.input}
                  placeholder="Your name"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  value={age}
                  onChangeText={setAge}
                  style={styles.input}
                  placeholder="Age"
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
                  placeholder="Anything you want your doctor to know"
                  multiline
                  placeholderTextColor={colors.textTertiary}
                />
                <PrimaryButton
                  label="Save Changes"
                  icon={icons.check}
                  onPress={saveProfile}
                  style={{ marginTop: spacing.md }}
                />
              </>
            )}
          </Card>
        </View>
      )}

      {/* Medication mode (patient mode only) */}
      {mode === 'patient' && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Medication" />
          <Card>
            <Row
              icon={icons.medication}
              title="Automatic dispensing"
              subtitle={medicationMode === 'auto'
                ? 'A pill is dispensed on each tremor detection'
                : 'You dispense pills manually from the Pills tab'}
              right={
                <Switch
                  value={medicationMode === 'auto'}
                  onValueChange={onToggleMedicationMode}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={medicationMode === 'auto' ? colors.primary : colors.surface}
                />
              }
            />
          </Card>
        </View>
      )}

      {/* Notifications */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Notifications" />
        <Card padding={0}>
          <View style={{ padding: spacing.md }}>
            <Row
              icon={icons.tremor}
              iconColor={colors.accent}
              title="Tremor alerts"
              subtitle="Notify when a tremor is detected"
              right={
                <Switch
                  value={notifyTremor}
                  onValueChange={() => onToggleNotif('notify_tremor', notifyTremor, setNotifyTremor, 'Tremor alerts')}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={notifyTremor ? colors.primary : colors.surface}
                />
              }
            />
          </View>
          <Divider />
          <View style={{ padding: spacing.md }}>
            <Row
              icon={icons.medication}
              title="Medication reminders"
              subtitle="Scheduled dose reminders"
              right={
                <Switch
                  value={notifyMed}
                  onValueChange={() => onToggleNotif('notify_medication', notifyMed, setNotifyMed, 'Medication reminders')}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={notifyMed ? colors.primary : colors.surface}
                />
              }
            />
          </View>
          <Divider />
          <View style={{ padding: spacing.md }}>
            <Row
              icon={icons.chart}
              title="Daily summary"
              subtitle="Evening recap of the day's activity"
              right={
                <Switch
                  value={notifyDaily}
                  onValueChange={() => onToggleNotif('notify_daily', notifyDaily, setNotifyDaily, 'Daily summary')}
                  trackColor={{ false: colors.border, true: colors.primary + '66' }}
                  thumbColor={notifyDaily ? colors.primary : colors.surface}
                />
              }
            />
          </View>
        </Card>
      </View>

      {/* Privacy (patient mode only) */}
      {mode === 'patient' && patient && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Privacy & Sharing" />
          <Card padding={0}>
            <View style={{ padding: spacing.md }}>
              <Row
                icon={icons.doctor}
                iconColor={colors.doctorMode}
                title="Share with doctor"
                subtitle="Your doctor can view sessions and medication logs"
                right={
                  <Switch
                    value={doctorSharing}
                    onValueChange={onToggleDoctor}
                    trackColor={{ false: colors.border, true: colors.primary + '66' }}
                    thumbColor={doctorSharing ? colors.primary : colors.surface}
                  />
                }
              />
            </View>
            <Divider />
            <View style={{ padding: spacing.md }}>
              <Row
                icon={icons.researcher}
                iconColor={colors.researcherMode}
                title="Share for research"
                subtitle="Your anonymized data appears in the research portal"
                right={
                  <Switch
                    value={researchSharing}
                    onValueChange={onToggleResearch}
                    trackColor={{ false: colors.border, true: colors.primary + '66' }}
                    thumbColor={researchSharing ? colors.primary : colors.surface}
                  />
                }
              />
            </View>
          </Card>
        </View>
      )}

      {/* System */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="System" />
        <Card padding={0}>
          <TouchableOpacity style={styles.systemRow} onPress={switchPortal}>
            <IconCircle icon="swap-horizontal" color={colors.primary} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Switch Portal</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Go back to mode selection
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity style={styles.systemRow} onPress={clearLocalData}>
            <IconCircle icon={icons.delete} color={colors.error} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Clear local data</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Remove all sessions from this device
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>
      </View>

      {/* Developer (remove before production) */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Developer" />
        <Card padding={0}>
          <TouchableOpacity
            style={styles.systemRow}
            onPress={async () => {
              try {
                const res = await seedDemoData();
                Alert.alert('Demo data seeded', `${res.patientsAdded} patients, ${res.sessionsAdded} sessions, ${res.logsAdded} med logs`);
              } catch (e) {
                Alert.alert('Seed failed', e.message);
              }
            }}
          >
            <IconCircle icon="database-plus" color={colors.primary} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Seed demo data</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Populate patients, sessions, and med logs
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.systemRow}
            onPress={async () => {
              await clearDemoData();
              Alert.alert('Cleared', 'All demo entries removed');
            }}
          >
            <IconCircle icon="database-remove" color={colors.error} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Clear demo data</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Remove all entries with demo_ prefix
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>
      </View>

      <Text style={[typography.small, { color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xxl }]}>
        TremorMonitor v1.1 · SLU Senior Design 2026
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  modeBadge: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  systemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  inputLabel: {
    ...typography.small,
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
  },
});

export default Settings;
