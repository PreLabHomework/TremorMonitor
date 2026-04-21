import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Alert, Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';
import {
  Card, PrimaryButton, SectionHeader, IconCircle, Divider,
} from '../components/ui';
import { colors, spacing, radius, typography, icons } from '../theme';

const AddPatient = () => {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [notes, setNotes] = useState('');
  const [doctorSharing, setDoctorSharing] = useState(true);
  const [researchSharing, setResearchSharing] = useState(false);
  const [saving, setSaving] = useState(false);

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a patient name.');
      return;
    }

    setSaving(true);
    try {
      const id = `pt_${Date.now()}`;
      const ageNum = age ? parseInt(age, 10) : null;

      await DatabaseService.addPatient({
        id,
        name: name.trim(),
        age: ageNum,
        notes: notes.trim() || null,
      });
      await DatabaseService.updatePatient(id, {
        research_sharing: researchSharing ? 1 : 0,
        doctor_sharing: doctorSharing ? 1 : 0,
      });

      await FirebaseService.upsertPatient({
        id,
        name: name.trim(),
        age: ageNum,
        notes: notes.trim() || null,
        research_sharing: researchSharing,
        doctor_sharing: doctorSharing,
      });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Save failed', e.message || 'Could not save patient.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
        <IconCircle icon={icons.patient} color={colors.doctorMode} size={64} iconSize={30} />
        <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.md }]}>
          New Patient
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: spacing.lg }]}>
          The patient will appear in the Patient portal sign-in screen once saved.
        </Text>
      </Card>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Profile" />
        <Card>
          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholder="e.g. Jane Doe"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Age</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            style={styles.input}
            placeholder="Optional"
            keyboardType="number-pad"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
            placeholder="Clinical notes, diagnosis, observations"
            multiline
            placeholderTextColor={colors.textTertiary}
          />
        </Card>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Default Sharing Preferences" />
        <Card padding={0}>
          <View style={styles.switchRow}>
            <IconCircle icon={icons.doctor} color={colors.doctorMode} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Doctor access</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Session and medication data visible to their doctor
              </Text>
            </View>
            <Switch
              value={doctorSharing}
              onValueChange={setDoctorSharing}
              trackColor={{ false: colors.border, true: colors.primary + '66' }}
              thumbColor={doctorSharing ? colors.primary : colors.surface}
            />
          </View>
          <Divider />
          <View style={styles.switchRow}>
            <IconCircle icon={icons.researcher} color={colors.researcherMode} size={36} iconSize={18} />
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>Research data sharing</Text>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
                Anonymized data included in research aggregates
              </Text>
            </View>
            <Switch
              value={researchSharing}
              onValueChange={setResearchSharing}
              trackColor={{ false: colors.border, true: colors.primary + '66' }}
              thumbColor={researchSharing ? colors.primary : colors.surface}
            />
          </View>
        </Card>
        <Text style={[typography.small, { color: colors.textTertiary, marginTop: spacing.sm, paddingHorizontal: spacing.sm }]}>
          The patient can change these preferences from their own settings at any time.
        </Text>
      </View>

      <View style={{ marginTop: spacing.xl }}>
        <PrimaryButton
          label="Save Patient"
          icon={icons.check}
          loading={saving}
          onPress={onSave}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  label: {
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
});

export default AddPatient;
