import { db } from './FirebaseConfig';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import DatabaseService from './DatabaseService';

// Helper: log warnings without triggering the red error popup
const logWarn = (msg, e) => console.warn(msg, e?.message || e);

class FirebaseService {

  // -------- Patients --------

  async upsertPatient(patient) {
    try {
      const { id, name, age, notes, research_sharing, doctor_sharing } = patient;
      await setDoc(doc(db, 'patients', id), {
        name,
        age: age || null,
        notes: notes || null,
        research_sharing: !!research_sharing,
        doctor_sharing: !!doctor_sharing,
        updated_at: serverTimestamp(),
      }, { merge: true });
      return id;
    } catch (e) {
      logWarn('upsertPatient error:', e);
      throw e;
    }
  }

  async getAllPatients() {
    try {
      const snap = await getDocs(collection(db, 'patients'));
      const patients = [];
      snap.forEach(d => patients.push({ id: d.id, ...d.data() }));
      return patients;
    } catch (e) {
      logWarn('getAllPatients error:', e);
      return [];
    }
  }

  async deletePatient(patientId) {
    try {
      await deleteDoc(doc(db, 'patients', patientId));
    } catch (e) {
      logWarn('deletePatient error:', e);
      throw e;
    }
  }

  // -------- Sessions --------

  async uploadSession(sessionId) {
    try {
      const session = await DatabaseService.getSession(sessionId);
      if (!session) {
        // Not an error — session was deleted or doesn't exist locally.
        // Silently skip to avoid spamming the LogBox.
        return null;
      }

      const features = await DatabaseService.getSessionFeatures(sessionId);
      const events = await DatabaseService.getSessionEvents(sessionId);

      const payload = {
        local_session_id: session.id,
        patient_id: session.patient_id || null,
        start_time: session.start_time,
        end_time: session.end_time,
        total_duration: session.total_duration,
        tremor_count: session.tremor_count,
        peak_amplitude: session.peak_amplitude,
        avg_amplitude: session.avg_amplitude,
        max_severity: session.max_severity,
        notes: session.notes || null,
        features: features.map(f => ({
          timestamp: f.timestamp,
          amplitude: f.amplitude,
          tremor_detected: !!f.tremor_detected,
          severity: f.severity,
        })),
        tremor_events: events.map(e => ({
          start_time: e.start_time,
          end_time: e.end_time,
          duration: e.duration,
          peak_amplitude: e.peak_amplitude,
        })),
        uploaded_at: serverTimestamp(),
        device_type: 'TremorSleeve',
        app_version: '1.1',
      };

      const docRef = await addDoc(collection(db, 'sessions'), payload);
      return docRef.id;
    } catch (e) {
      logWarn('uploadSession error:', e);
      try {
        await DatabaseService.queueSync('session', sessionId, { retry: true });
      } catch {}
      return null;
    }
  }

  async getSessionsForPatient(patientId) {
    try {
      const q = query(
        collection(db, 'sessions'),
        where('patient_id', '==', patientId)
      );
      const snap = await getDocs(q);
      const sessions = [];
      snap.forEach(d => sessions.push({ id: d.id, ...d.data() }));
      sessions.sort((a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
      return sessions;
    } catch (e) {
      logWarn('getSessionsForPatient error:', e);
      return [];
    }
  }

  async getAllSessionsForResearch() {
    try {
      const patientsSnap = await getDocs(
        query(collection(db, 'patients'), where('research_sharing', '==', true))
      );
      const researchPatientIds = [];
      patientsSnap.forEach(d => researchPatientIds.push(d.id));

      if (researchPatientIds.length === 0) return [];

      const sessions = [];
      for (let i = 0; i < researchPatientIds.length; i += 30) {
        const chunk = researchPatientIds.slice(i, i + 30);
        const q = query(
          collection(db, 'sessions'),
          where('patient_id', 'in', chunk)
        );
        const snap = await getDocs(q);
        snap.forEach(d => sessions.push({ id: d.id, ...d.data() }));
      }

      return sessions;
    } catch (e) {
      logWarn('getAllSessionsForResearch error:', e);
      return [];
    }
  }

  // -------- Medication logs --------

  async uploadMedicationLog(logId) {
    try {
      const logs = await DatabaseService.getMedicationLogs(null, 500);
      const log = logs.find(l => l.id === logId);
      if (!log) {
        // Silently skip — log was deleted or doesn't exist locally
        return null;
      }

      // Check if patient allows doctor to see
      if (log.patient_id) {
        const patient = await DatabaseService.getPatient(log.patient_id);
        if (patient && !patient.doctor_sharing) {
          return null;
        }
      }

      const payload = {
        local_id: log.id,
        patient_id: log.patient_id || null,
        timestamp: log.timestamp,
        pill_count: log.pill_count,
        trigger_type: log.trigger_type,
        session_id: log.session_id || null,
        uploaded_at: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'medication_logs'), payload);
      return docRef.id;
    } catch (e) {
      logWarn('uploadMedicationLog error:', e);
      try {
        await DatabaseService.queueSync('medication_log', logId, { retry: true });
      } catch {}
      return null;
    }
  }

  async getMedicationLogsForPatient(patientId) {
    try {
      const q = query(
        collection(db, 'medication_logs'),
        where('patient_id', '==', patientId)
      );
      const snap = await getDocs(q);
      const logs = [];
      snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
      logs.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      return logs;
    } catch (e) {
      logWarn('getMedicationLogsForPatient error:', e);
      return [];
    }
  }

  // -------- Sync queue processor --------

  async processSyncQueue() {
    let pending;
    try {
      pending = await DatabaseService.getPendingSyncs();
    } catch {
      return { succeeded: 0, failed: 0, total: 0 };
    }
    let succeeded = 0;
    let failed = 0;

    for (const item of pending) {
      try {
        if (item.entity_type === 'session') {
          const firebaseId = await this.uploadSession(item.entity_id);
          if (firebaseId) {
            await DatabaseService.markSyncComplete(
              item.id, firebaseId, 'session', item.entity_id
            );
          } else {
            // Drop from queue — record gone or upload skipped
            await DatabaseService.markSyncComplete(item.id);
          }
          succeeded++;
        } else if (item.entity_type === 'medication_log') {
          const firebaseId = await this.uploadMedicationLog(item.entity_id);
          if (firebaseId) {
            await DatabaseService.markSyncComplete(
              item.id, firebaseId, 'medication_log', item.entity_id
            );
          } else {
            await DatabaseService.markSyncComplete(item.id);
          }
          succeeded++;
        }
      } catch (e) {
        try { await DatabaseService.markSyncFailed(item.id); } catch {}
        failed++;
      }
    }

    return { succeeded, failed, total: pending.length };
  }

  async testConnection() {
    try {
      const testRef = await addDoc(collection(db, '_health'), {
        timestamp: serverTimestamp(),
      });
      await deleteDoc(testRef);
      return true;
    } catch (e) {
      logWarn('Firebase test failed:', e);
      return false;
    }
  }
}

export default new FirebaseService();
