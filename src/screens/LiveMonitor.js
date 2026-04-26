import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import DatabaseService, { amplitudeToSeverity } from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';
import { SleeveBLE, DispenserBLE } from '../services/BLEService';
import {
  Card, PrimaryButton, SecondaryButton, StatTile, SectionHeader,
  IconCircle, Pill, SeverityPill,
} from '../components/ui';
import {
  colors, spacing, radius, typography, shadows, icons,
  severityColor, severityLabel,
} from '../theme';

// =========================================================================
// DEMO MODE - set to false before commit/production use.
// When true, fakes BLE connection and streams realistic packets for demo
// screenshots and poster/class presentations. No real BLE calls are made.
// =========================================================================
const DEMO_MODE = false;

// 30s-apart "packets" at realistic Parkinsonian tremor amplitudes (g).
const DEMO_PACKETS = [
  { amplitude: 0.28, tremorDetected: false },
  { amplitude: 0.41, tremorDetected: false },
  { amplitude: 0.67, tremorDetected: true },
  { amplitude: 1.24, tremorDetected: true },
  { amplitude: 2.11, tremorDetected: true },
  { amplitude: 2.84, tremorDetected: true },
  { amplitude: 3.12, tremorDetected: true },
  { amplitude: 2.56, tremorDetected: true },
  { amplitude: 1.89, tremorDetected: true },
  { amplitude: 1.03, tremorDetected: true },
  { amplitude: 0.54, tremorDetected: true },
  { amplitude: 0.33, tremorDetected: false },
];
const DEMO_INTERVAL_MS = 2000;

const formatDuration = (s) => {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const LiveMonitor = ({ navigation }) => {
  const [patient, setPatient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionStart, setSessionStart] = useState(null);
  const [lastPacket, setLastPacket] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    packetCount: 0,
    tremorCount: 0,
    peakAmplitude: 0,
    maxSeverity: 0,
    currentSeverity: 0,
  });
  const [todaySummary, setTodaySummary] = useState({
    sessions: 0, tremorCount: 0, totalDuration: 0,
    peakAmplitude: 0, maxSeverity: 0,
  });
  const [elapsedSec, setElapsedSec] = useState(0);

  const sessionIdRef = useRef(null);
  const patientRef = useRef(null);
  const recordingRef = useRef(false);
  const statsRef = useRef(sessionStats);
  const demoIntervalRef = useRef(null);
  const demoIdxRef = useRef(0);

  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { patientRef.current = patient; }, [patient]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { statsRef.current = sessionStats; }, [sessionStats]);

  // Re-sync connection state on focus — handles cases where the sleeve was
  // disconnected while the user was on another screen, or where the screen
  // mounted after the connection event fired.
  useFocusEffect(
    React.useCallback(() => {
      loadActivePatient();
      loadTodaySummary();
      if (!DEMO_MODE) {
        setConnected(SleeveBLE.isConnected());
      }
    }, [])
  );

  // Wire up BLE callbacks once
  useEffect(() => {
    if (!DEMO_MODE) {
      SleeveBLE.setOnConnection((isConnected) => {
        setConnected(isConnected);
        // If the sleeve dropped while we were recording, gracefully end the
        // session so we don't keep showing "Recording" with a dead connection.
        if (!isConnected && recordingRef.current && sessionIdRef.current) {
          stopRecordingFromDisconnect();
        }
      });
      SleeveBLE.setOnPacket(handlePacket);
      // Initial sync in case connection happened before mount
      setConnected(SleeveBLE.isConnected());
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      if (recordingRef.current && sessionIdRef.current && !DEMO_MODE) {
        DatabaseService.endSession(sessionIdRef.current).catch(() => {});
      }
    };
  }, []);

  // Elapsed timer while recording
  useEffect(() => {
    if (!recording || !sessionStart) return;
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - sessionStart) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [recording, sessionStart]);

  const loadActivePatient = async () => {
    const pid = await DatabaseService.getSetting('active_patient_id', null);
    if (!pid) return;
    const p = await DatabaseService.getPatient(pid);
    setPatient(p);
  };

  const loadTodaySummary = async () => {
    const pid = await DatabaseService.getSetting('active_patient_id', null);
    if (!pid) return;
    const summary = await DatabaseService.getTodaySummary(pid);
    setTodaySummary(summary);
  };

  const handlePacket = async (packet) => {
    setLastPacket(packet);
    const currentSeverity = packet.tremorDetected
      ? amplitudeToSeverity(packet.amplitude)
      : 0;

    if (DEMO_MODE) {
      setSessionStats((prev) => ({
        packetCount: prev.packetCount + 1,
        tremorCount: prev.tremorCount + (packet.tremorDetected ? 1 : 0),
        peakAmplitude: Math.max(prev.peakAmplitude, packet.amplitude),
        maxSeverity: Math.max(prev.maxSeverity, currentSeverity),
        currentSeverity,
      }));
      return;
    }

    if (recordingRef.current && sessionIdRef.current) {
      try {
        await DatabaseService.addFeature(sessionIdRef.current, {
          amplitude: packet.amplitude,
          tremorDetected: packet.tremorDetected,
        });
      } catch (e) {
        console.warn('addFeature failed:', e?.message || e);
      }

      setSessionStats((prev) => ({
        packetCount: prev.packetCount + 1,
        tremorCount: prev.tremorCount + (packet.tremorDetected ? 1 : 0),
        peakAmplitude: Math.max(prev.peakAmplitude, packet.amplitude),
        maxSeverity: Math.max(prev.maxSeverity, currentSeverity),
        currentSeverity,
      }));

      // Auto-dispense if configured and tremor detected
      if (packet.tremorDetected && DispenserBLE.isConnected()) {
        const medMode = await DatabaseService.getSetting('medication_mode', 'manual');
        if (medMode === 'auto') {
          try {
            await DispenserBLE.dispense(1);
            await DatabaseService.logMedication({
              patientId: patientRef.current?.id,
              pillCount: 1,
              triggerType: 'auto',
              sessionId: sessionIdRef.current,
            });
          } catch (e) {
            console.warn('Auto-dispense failed:', e?.message || e);
          }
        }
      }
    }
  };

  // Internal: end a recording because the sleeve dropped, not because the
  // user tapped Stop. Keeps the data we already captured but doesn't try to
  // alert the user mid-flow.
  const stopRecordingFromDisconnect = async () => {
    setRecording(false);
    if (!sessionIdRef.current) return;
    try {
      await DatabaseService.endSession(sessionIdRef.current);
      FirebaseService.uploadSession(sessionIdRef.current).catch(() => {});
    } catch (e) {
      console.warn('End session on disconnect error:', e?.message || e);
    }
    setSessionId(null);
    setSessionStart(null);
    await loadTodaySummary();
  };

  const scanAndConnect = async () => {
    if (DEMO_MODE) {
      setScanning(true);
      await new Promise((r) => setTimeout(r, 900));
      setConnected(true);
      setScanning(false);
      return;
    }
    setScanning(true);
    try {
      const device = await SleeveBLE.scan();
      if (!device) {
        Alert.alert('No sleeve found', 'Make sure TremorSleeve is powered on and nearby.');
        return;
      }
      await SleeveBLE.connect(device);
    } catch (e) {
      Alert.alert('Connection error', e.message);
    } finally {
      setScanning(false);
    }
  };

  const disconnect = async () => {
    if (DEMO_MODE) {
      if (recording) await stopRecording();
      setConnected(false);
      return;
    }
    if (recording) await stopRecording();
    await SleeveBLE.disconnect();
  };

  const startRecording = async () => {
    if (!patient) {
      Alert.alert('No active patient', 'Return to Welcome to select a patient first.');
      return;
    }

    if (DEMO_MODE) {
      const fakeId = 'demo_live_' + Date.now();
      setSessionId(fakeId);
      setSessionStart(Date.now());
      setElapsedSec(0);
      setSessionStats({ packetCount: 0, tremorCount: 0, peakAmplitude: 0, maxSeverity: 0, currentSeverity: 0 });
      setRecording(true);
      demoIdxRef.current = 0;

      demoIntervalRef.current = setInterval(() => {
        const packet = DEMO_PACKETS[demoIdxRef.current % DEMO_PACKETS.length];
        demoIdxRef.current += 1;
        handlePacket(packet);
      }, DEMO_INTERVAL_MS);
      return;
    }

    try {
      const id = await DatabaseService.createSession(patient.id);
      setSessionId(id);
      setSessionStart(Date.now());
      setElapsedSec(0);
      setSessionStats({ packetCount: 0, tremorCount: 0, peakAmplitude: 0, maxSeverity: 0, currentSeverity: 0 });
      setRecording(true);
    } catch (e) {
      Alert.alert('Could not start session', e?.message || 'Database error.');
    }
  };

  const stopRecording = async () => {
    setRecording(false);

    if (DEMO_MODE) {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
      setSessionId(null);
      setSessionStart(null);
      return;
    }

    if (!sessionIdRef.current) return;
    try {
      await DatabaseService.endSession(sessionIdRef.current);
      FirebaseService.uploadSession(sessionIdRef.current).catch(() => {});
    } catch (e) {
      console.warn('End session error:', e?.message || e);
    }
    setSessionId(null);
    setSessionStart(null);
    await loadTodaySummary();
  };

  const severityColorNow = severityColor(sessionStats.currentSeverity);
  const isTremoring = sessionStats.currentSeverity > 0 && recording;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadTodaySummary} />}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Hello,</Text>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>
            {patient?.name || 'No patient selected'}
          </Text>
        </View>
        <Pill
          label={connected ? 'Connected' : 'Disconnected'}
          color={connected ? colors.success : colors.textTertiary}
          icon={connected ? icons.connect : icons.disconnect}
        />
      </View>

      {/* Status hero */}
      <Card elevation="md" style={[styles.heroCard, isTremoring && { backgroundColor: severityColorNow + '10' }]}>
        <View style={styles.heroIconWrap}>
          <View style={[styles.heroIcon, { backgroundColor: isTremoring ? severityColorNow + '22' : colors.primarySoft }]}>
            <MaterialCommunityIcons
              name={icons.tremor}
              size={36}
              color={isTremoring ? severityColorNow : colors.primary}
            />
          </View>
        </View>
        <Text style={[typography.h1, { color: isTremoring ? severityColorNow : colors.textPrimary, textAlign: 'center' }]}>
          {!connected ? 'Not Connected' :
           !recording ? 'Ready to Record' :
           isTremoring ? 'Tremor Detected' : 'No Tremor'}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
          {!connected ? 'Connect the sleeve to begin monitoring' :
           !recording ? 'Start a session to begin recording data' :
           `Session running · ${formatDuration(elapsedSec)}`}
        </Text>

        {recording && (
          <View style={styles.heroSeverity}>
            <SeverityPill severity={sessionStats.currentSeverity} />
          </View>
        )}
      </Card>

      {/* Controls */}
      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {!connected ? (
          <PrimaryButton
            label="Scan for Sleeve"
            icon={icons.scan}
            loading={scanning}
            onPress={scanAndConnect}
          />
        ) : !recording ? (
          <>
            <PrimaryButton
              label="Start Recording"
              icon={icons.record}
              onPress={startRecording}
              disabled={!patient}
            />
            <SecondaryButton
              label="Disconnect"
              icon={icons.disconnect}
              onPress={disconnect}
              color={colors.textSecondary}
            />
          </>
        ) : (
          <PrimaryButton
            label="Stop Recording"
            icon={icons.stop}
            color={colors.accent}
            onPress={stopRecording}
          />
        )}
      </View>

      {/* Current session stats */}
      {recording && (
        <View style={{ marginTop: spacing.xl }}>
          <SectionHeader title="This Session" />
          <Card>
            <View style={styles.statsRow}>
              <StatTile
                value={formatDuration(elapsedSec)}
                label="Duration"
                icon={icons.duration}
                color={colors.primary}
              />
              <StatTile
                value={sessionStats.tremorCount}
                label="Tremors"
                icon={icons.count}
                color={colors.primary}
              />
              <StatTile
                value={sessionStats.peakAmplitude.toFixed(2)}
                label="Peak m/s²"
                icon={icons.amplitude}
                color={colors.primary}
              />
            </View>
          </Card>
        </View>
      )}

      {/* Today's summary */}
      <View style={{ marginTop: spacing.xl }}>
        <SectionHeader title="Today" />
        <Card>
          <View style={styles.statsRow}>
            <StatTile
              value={todaySummary.sessions}
              label="Sessions"
              icon={icons.history}
              color={colors.textPrimary}
            />
            <StatTile
              value={todaySummary.tremorCount}
              label="Tremors"
              icon={icons.count}
              color={colors.textPrimary}
            />
            <StatTile
              value={formatDuration(todaySummary.totalDuration)}
              label="Recorded"
              icon={icons.duration}
              color={colors.textPrimary}
            />
          </View>
          {todaySummary.maxSeverity > 0 && (
            <View style={styles.todaySeverityRow}>
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                Highest severity today
              </Text>
              <SeverityPill severity={todaySummary.maxSeverity} />
            </View>
          )}
        </Card>
      </View>

      {lastPacket && !recording && (
        <View style={{ marginTop: spacing.md }}>
          <Card elevation="sm" padding={spacing.md}>
            <Text style={[typography.small, { color: colors.textTertiary }]}>
              LAST RECEIVED PACKET
            </Text>
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
              Amplitude {lastPacket.amplitude.toFixed(3)} m/s² · {lastPacket.tremorDetected ? 'Tremor' : 'No tremor'}
            </Text>
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heroCard: { alignItems: 'center', paddingVertical: spacing.xl },
  heroIconWrap: { marginBottom: spacing.md },
  heroIcon: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  heroSeverity: { marginTop: spacing.md },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  todaySeverityRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default LiveMonitor;
