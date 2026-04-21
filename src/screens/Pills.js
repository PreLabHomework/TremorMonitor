import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';
import { DispenserBLE } from '../services/BLEService';
import {
  Card, PrimaryButton, SecondaryButton, SectionHeader,
  IconCircle, Pill, EmptyState, Divider,
} from '../components/ui';
import { colors, spacing, radius, typography, shadows, icons } from '../theme';

const formatTimestamp = (iso) => {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (d >= today) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' · ' +
         d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Pills = () => {
  const [patient, setPatient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [pillCount, setPillCount] = useState(1);
  const [medicationMode, setMedicationMode] = useState('manual');
  const [recentLogs, setRecentLogs] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      loadAll();
    }, [])
  );

  useEffect(() => {
    DispenserBLE.setOnConnection(setConnected);
  }, []);

  const loadAll = async () => {
    const pid = await DatabaseService.getSetting('active_patient_id', null);
    if (pid) {
      const p = await DatabaseService.getPatient(pid);
      setPatient(p);
      const logs = await DatabaseService.getMedicationLogs(pid, 10);
      setRecentLogs(logs);
    }
    const mode = await DatabaseService.getSetting('medication_mode', 'manual');
    setMedicationMode(mode);
  };

  const toggleMode = async () => {
    const next = medicationMode === 'manual' ? 'auto' : 'manual';
    setMedicationMode(next);
    await DatabaseService.setSetting('medication_mode', next);
  };

  const scanAndConnect = async () => {
    setScanning(true);
    try {
      const device = await DispenserBLE.scan();
      if (!device) {
        Alert.alert('No dispenser found', 'Make sure PillDispenser is powered on and nearby.');
        return;
      }
      await DispenserBLE.connect(device);
    } catch (e) {
      Alert.alert('Connection error', e.message);
    } finally {
      setScanning(false);
    }
  };

  const disconnect = async () => {
    await DispenserBLE.disconnect();
  };

  const dispensePills = async () => {
    if (!connected) {
      Alert.alert('Not connected', 'Connect the dispenser first.');
      return;
    }
    setDispensing(true);
    try {
      await DispenserBLE.dispense(pillCount);
      const logId = await DatabaseService.logMedication({
        patientId: patient?.id,
        pillCount,
        triggerType: 'manual',
      });
      // Attempt upload if patient allows doctor sharing
      FirebaseService.uploadMedicationLog(logId).catch(() => {});
      // Refresh log
      const logs = await DatabaseService.getMedicationLogs(patient?.id, 10);
      setRecentLogs(logs);
    } catch (e) {
      Alert.alert('Dispense failed', e.message);
    } finally {
      setDispensing(false);
    }
  };

  const inc = () => setPillCount(Math.min(5, pillCount + 1));
  const dec = () => setPillCount(Math.max(1, pillCount - 1));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadAll} />}
    >
      {/* Connection status */}
      <Card>
        <View style={styles.row}>
          <IconCircle
            icon={icons.medication}
            color={connected ? colors.primary : colors.textTertiary}
            size={44}
            iconSize={22}
          />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={[typography.h3, { color: colors.textPrimary }]}>
              Pill Dispenser
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 2 }]}>
              {connected ? 'Connected and ready' : 'Not connected'}
            </Text>
          </View>
          <Pill
            label={connected ? 'Online' : 'Offline'}
            color={connected ? colors.success : colors.textTertiary}
          />
        </View>

        <View style={{ marginTop: spacing.md }}>
          {!connected ? (
            <PrimaryButton
              label="Scan for Dispenser"
              icon={icons.scan}
              loading={scanning}
              onPress={scanAndConnect}
            />
          ) : (
            <SecondaryButton
              label="Disconnect"
              icon={icons.disconnect}
              color={colors.textSecondary}
              onPress={disconnect}
            />
          )}
        </View>
      </Card>

      {/* Medication mode */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Medication Mode" />
        <Card>
          <View style={styles.modeGrid}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { if (medicationMode !== 'manual') toggleMode(); }}
              style={[
                styles.modeBtn,
                medicationMode === 'manual' && styles.modeBtnActive,
              ]}
            >
              <MaterialCommunityIcons
                name="gesture-tap"
                size={22}
                color={medicationMode === 'manual' ? colors.primary : colors.textTertiary}
              />
              <Text style={[
                typography.bodyMedium,
                { color: medicationMode === 'manual' ? colors.primary : colors.textSecondary, marginTop: 4 },
              ]}>
                Manual
              </Text>
              <Text style={[typography.small, { color: colors.textTertiary, marginTop: 2, textAlign: 'center' }]}>
                You choose when
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { if (medicationMode !== 'auto') toggleMode(); }}
              style={[
                styles.modeBtn,
                medicationMode === 'auto' && styles.modeBtnActive,
              ]}
            >
              <MaterialCommunityIcons
                name="auto-fix"
                size={22}
                color={medicationMode === 'auto' ? colors.primary : colors.textTertiary}
              />
              <Text style={[
                typography.bodyMedium,
                { color: medicationMode === 'auto' ? colors.primary : colors.textSecondary, marginTop: 4 },
              ]}>
                Automatic
              </Text>
              <Text style={[typography.small, { color: colors.textTertiary, marginTop: 2, textAlign: 'center' }]}>
                On tremor detection
              </Text>
            </TouchableOpacity>
          </View>

          {medicationMode === 'auto' && (
            <View style={styles.autoInfo}>
              <MaterialCommunityIcons name={icons.info} size={16} color={colors.info} />
              <Text style={[typography.caption, { color: colors.info, marginLeft: 6, flex: 1 }]}>
                One pill will be dispensed each time a tremor is detected during a recording session.
              </Text>
            </View>
          )}
        </Card>
      </View>

      {/* Manual dispense */}
      {medicationMode === 'manual' && (
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader title="Dispense" />
          <Card>
            <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
              Number of pills
            </Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                onPress={dec}
                style={[styles.counterBtn, pillCount <= 1 && { opacity: 0.4 }]}
                disabled={pillCount <= 1}
              >
                <MaterialCommunityIcons name="minus" size={22} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{pillCount}</Text>
              <TouchableOpacity
                onPress={inc}
                style={[styles.counterBtn, pillCount >= 5 && { opacity: 0.4 }]}
                disabled={pillCount >= 5}
              >
                <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <PrimaryButton
              label={`Dispense ${pillCount} Pill${pillCount > 1 ? 's' : ''}`}
              icon={icons.medication}
              loading={dispensing}
              disabled={!connected}
              onPress={dispensePills}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        </View>
      )}

      {/* Recent log */}
      <View style={{ marginTop: spacing.lg }}>
        <SectionHeader title="Recent Dispenses" />
        {recentLogs.length === 0 ? (
          <Card>
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center' }]}>
              No dispenses recorded yet
            </Text>
          </Card>
        ) : (
          <Card padding={0}>
            {recentLogs.map((log, i) => (
              <View key={log.id}>
                <View style={styles.logRow}>
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
                      {formatTimestamp(log.timestamp)}
                    </Text>
                  </View>
                </View>
                {i < recentLogs.length - 1 && <Divider style={{ marginLeft: 56 }} />}
              </View>
            ))}
          </Card>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center' },
  modeGrid: { flexDirection: 'row', gap: spacing.md },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  modeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  autoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.info + '10',
    borderRadius: radius.md,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    gap: spacing.xl,
  },
  counterBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  counterValue: {
    fontSize: 40,
    fontWeight: '700',
    color: colors.textPrimary,
    minWidth: 60,
    textAlign: 'center',
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
});

export default Pills;
