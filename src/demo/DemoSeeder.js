// src/demo/DemoSeeder.js
// Run from Settings screen or a hidden button. Injects realistic fake data
// into both SQLite and Firebase so the whole app looks populated for poster screenshots.

import DatabaseService from '../services/DatabaseService';
import FirebaseService from '../services/FirebaseService';

const FAKE_PATIENTS = [
  { id: 'demo_p01', name: 'Eleanor Voss', age: 67, notes: 'Stage 2 PD, diagnosed 2023', research_sharing: 1, doctor_sharing: 1 },
  { id: 'demo_p02', name: 'Marcus Chen', age: 72, notes: 'Essential tremor, bilateral', research_sharing: 1, doctor_sharing: 1 },
  { id: 'demo_p03', name: 'Priya Raman', age: 58, notes: 'Early-onset PD', research_sharing: 0, doctor_sharing: 1 },
  { id: 'demo_p04', name: 'James Okafor', age: 69, notes: 'Post-DBS surgery', research_sharing: 1, doctor_sharing: 0 },
];

// Generate a realistic session with amplitude-over-time data
function generateSession(patientId, daysAgo, severityProfile) {
  const now = Date.now();
  const start = now - daysAgo * 24 * 60 * 60 * 1000 - Math.random() * 6 * 3600 * 1000;
  const durationMin = 3 + Math.random() * 12; // 3 to 15 min sessions
  const end = start + durationMin * 60 * 1000;

  const packetCount = Math.floor(durationMin * 2); // every 30s
  let tremorCount = 0;
  let peakAmp = 0;
  let maxSev = 0;
  const events = [];

  // severityProfile: 'mild', 'moderate', 'severe', 'intermittent'
  for (let i = 0; i < packetCount; i++) {
    let amp;
    switch (severityProfile) {
      case 'severe':
        amp = 1.8 + Math.random() * 2.5; // 1.8 to 4.3
        break;
      case 'moderate':
        amp = 0.8 + Math.random() * 1.4; // 0.8 to 2.2
        break;
      case 'intermittent':
        amp = Math.random() < 0.4 ? (1.0 + Math.random() * 2) : (0.1 + Math.random() * 0.3);
        break;
      default: // mild
        amp = 0.3 + Math.random() * 0.7;
    }
    const isTremor = amp > 0.5;
    if (isTremor) tremorCount++;
    if (amp > peakAmp) peakAmp = amp;

    let sev = 0;
    if (amp >= 3.0) sev = 4;
    else if (amp >= 1.5) sev = 3;
    else if (amp >= 0.5) sev = 2;
    else if (amp >= 0.15) sev = 1;
    if (sev > maxSev) maxSev = sev;

    events.push({
      timestamp: start + i * 30 * 1000,
      amplitude: parseFloat(amp.toFixed(3)),
      tremor: isTremor ? 1 : 0,
      severity: sev,
    });
  }

  return {
    id: `demo_s_${patientId}_${daysAgo}`,
    patient_id: patientId,
    start_time: start,
    end_time: end,
    duration_sec: Math.floor((end - start) / 1000),
    packet_count: packetCount,
    tremor_count: tremorCount,
    peak_amplitude: parseFloat(peakAmp.toFixed(3)),
    max_severity: maxSev,
    avg_severity: parseFloat((events.reduce((s, e) => s + e.severity, 0) / events.length).toFixed(2)),
    events,
  };
}

const SESSION_PLAN = [
  // patient_id, daysAgo, profile
  ['demo_p01', 0, 'moderate'],
  ['demo_p01', 1, 'mild'],
  ['demo_p01', 2, 'intermittent'],
  ['demo_p01', 4, 'moderate'],
  ['demo_p01', 6, 'severe'],
  ['demo_p02', 0, 'mild'],
  ['demo_p02', 1, 'mild'],
  ['demo_p02', 3, 'intermittent'],
  ['demo_p03', 0, 'severe'],
  ['demo_p03', 2, 'moderate'],
  ['demo_p04', 1, 'mild'],
  ['demo_p04', 3, 'intermittent'],
  ['demo_p04', 5, 'mild'],
];

const FAKE_MED_LOGS = [
  { patient_id: 'demo_p01', daysAgo: 0, dose: 1, triggered_by: 'auto' },
  { patient_id: 'demo_p01', daysAgo: 0, dose: 1, triggered_by: 'manual' },
  { patient_id: 'demo_p01', daysAgo: 1, dose: 1, triggered_by: 'auto' },
  { patient_id: 'demo_p01', daysAgo: 2, dose: 2, triggered_by: 'manual' },
  { patient_id: 'demo_p02', daysAgo: 0, dose: 1, triggered_by: 'manual' },
  { patient_id: 'demo_p03', daysAgo: 0, dose: 1, triggered_by: 'auto' },
  { patient_id: 'demo_p03', daysAgo: 0, dose: 1, triggered_by: 'auto' },
];

export async function seedDemoData(options = { firebase: true, sqlite: true }) {
  console.log('[DemoSeeder] Starting...');
  let patientsAdded = 0, sessionsAdded = 0, logsAdded = 0;

  // Patients
  for (const p of FAKE_PATIENTS) {
    if (options.sqlite) {
      try {
        await DatabaseService.addPatient(p);
      } catch (e) {
        await DatabaseService.updatePatient(p.id, p);
      }
    }
    if (options.firebase) {
      await FirebaseService.upsertPatient(p);
    }
    patientsAdded++;
  }

  // Sessions
  for (const [pid, daysAgo, profile] of SESSION_PLAN) {
    const s = generateSession(pid, daysAgo, profile);
    if (options.sqlite) {
      try {
        await DatabaseService.insertSession(s);
        for (const ev of s.events) {
          await DatabaseService.insertEvent({ ...ev, session_id: s.id });
        }
      } catch (e) {
        console.warn('Session insert failed:', e.message);
      }
    }
    if (options.firebase) {
      await FirebaseService.uploadSession(s.id).catch(() => {
        // Fallback: upload directly via a custom method if needed
      });
    }
    sessionsAdded++;
  }

  // Med logs
  const now = Date.now();
  for (const log of FAKE_MED_LOGS) {
    const entry = {
      id: `demo_ml_${log.patient_id}_${log.daysAgo}_${Math.random().toString(36).slice(2, 6)}`,
      patient_id: log.patient_id,
      timestamp: now - log.daysAgo * 24 * 3600 * 1000,
      dose: log.dose,
      triggered_by: log.triggered_by,
    };
    if (options.sqlite) {
      try { await DatabaseService.insertMedLog(entry); } catch (e) {}
    }
    if (options.firebase) {
      await FirebaseService.uploadMedicationLog(entry.id).catch(() => {});
    }
    logsAdded++;
  }

  console.log(`[DemoSeeder] Done. Patients: ${patientsAdded}, Sessions: ${sessionsAdded}, MedLogs: ${logsAdded}`);
  return { patientsAdded, sessionsAdded, logsAdded };
}

export async function clearDemoData() {
  // Deletes anything with an id starting with 'demo_'
  // Safe because real data uses UUIDs
  const patients = await DatabaseService.getAllPatients();
  for (const p of patients) {
    if (p.id.startsWith('demo_')) {
      await DatabaseService.deletePatient(p.id);
      await FirebaseService.deletePatient(p.id).catch(() => {});
    }
  }
  console.log('[DemoSeeder] Cleared demo data');
}
