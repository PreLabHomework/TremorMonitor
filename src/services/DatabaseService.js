import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(false);
SQLite.enablePromise(true);

const DATABASE_NAME = 'TremorMonitor.db';
// Bump this any time the schema changes — forces a clean recreation.
const SCHEMA_VERSION = 2;

// Convert peak amplitude to a 0-4 severity scale (UPDRS-like)
// Thresholds tuned against Eric's RMS tremor output (m/s^2).
// Adjust these as we collect real tremor samples.
export const amplitudeToSeverity = (amp) => {
  if (!amp || amp <= 0) return 0;
  if (amp < 0.5) return 1;  // mild
  if (amp < 1.5) return 2;  // moderate
  if (amp < 3.0) return 3;  // strong
  return 4;                  // severe
};

export const severityLabel = (sev) => {
  return ['None', 'Mild', 'Moderate', 'Strong', 'Severe'][sev] || 'Unknown';
};

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initDatabase() {
    try {
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        location: 'default',
      });
      await this.migrateSchemaIfNeeded();
      await this.createTables();
      return true;
    } catch (error) {
      console.error('DB init error:', error);
      throw error;
    }
  }

  // Check the stored schema version. If it's older (or missing), drop every
  // known table so createTables() can rebuild them from scratch. We do this
  // rather than writing individual ALTER migrations because the app is
  // pre-production and we'd rather not carry migration tech debt yet.
  async migrateSchemaIfNeeded() {
    // Create the meta table first so we can read/write the version
    await this.db.executeSql(
      `CREATE TABLE IF NOT EXISTS schema_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`
    );

    const [result] = await this.db.executeSql(
      `SELECT value FROM schema_meta WHERE key = 'version'`
    );
    const storedVersion = result.rows.length > 0
      ? parseInt(result.rows.item(0).value, 10)
      : 0;

    if (storedVersion < SCHEMA_VERSION) {
      console.log(`Migrating DB from v${storedVersion} to v${SCHEMA_VERSION}`);
      // Drop every table we know about. Order matters because of FK cascades.
      const dropList = [
        'sync_queue',
        'medication_logs',
        'tremor_events',
        'features',
        'sessions',
        'patients',
        'user_settings',
        // legacy tables from older schemas that may still exist
        'tremor_sessions',
        'readings',
      ];
      for (const t of dropList) {
        try {
          await this.db.executeSql(`DROP TABLE IF EXISTS ${t}`);
        } catch (e) {
          console.warn(`Could not drop ${t}:`, e.message);
        }
      }

      // Record the new version
      await this.db.executeSql(
        `INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', ?)`,
        [String(SCHEMA_VERSION)]
      );
    }
  }

  async createTables() {
    const tables = [
      // Patients (managed by Doctor mode)
      `CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age INTEGER,
        notes TEXT,
        research_sharing INTEGER DEFAULT 0,
        doctor_sharing INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,

      // Sessions are now tied to a patient
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_duration INTEGER DEFAULT 0,
        tremor_count INTEGER DEFAULT 0,
        peak_amplitude REAL DEFAULT 0,
        avg_amplitude REAL DEFAULT 0,
        max_severity INTEGER DEFAULT 0,
        notes TEXT,
        firebase_id TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id)
      )`,

      // One row per BLE packet received
      `CREATE TABLE IF NOT EXISTS features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        amplitude REAL NOT NULL,
        tremor_detected INTEGER NOT NULL DEFAULT 0,
        severity INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,

      // Contiguous runs of tremor_detected=1 packets get grouped into events at session end
      `CREATE TABLE IF NOT EXISTS tremor_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER DEFAULT 0,
        peak_amplitude REAL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,

      // Medication dispense log (both auto + manual)
      `CREATE TABLE IF NOT EXISTS medication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id TEXT,
        timestamp TEXT NOT NULL,
        pill_count INTEGER DEFAULT 1,
        trigger_type TEXT NOT NULL,
        session_id INTEGER,
        firebase_id TEXT,
        FOREIGN KEY (patient_id) REFERENCES patients(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )`,

      // Global key/value for app-level settings (active mode, last patient, etc.)
      `CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // Pending Firebase uploads for offline resilience
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_attempt TEXT,
        attempts INTEGER DEFAULT 0
      )`,
    ];

    for (const stmt of tables) {
      await this.db.executeSql(stmt);
    }
  }

  // ============ PATIENTS ============

  async addPatient({ id, name, age, notes }) {
    const now = new Date().toISOString();
    await this.db.executeSql(
      `INSERT OR REPLACE INTO patients (id, name, age, notes, research_sharing, doctor_sharing, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 1, ?, ?)`,
      [id, name, age || null, notes || null, now, now]
    );
    return id;
  }

  async updatePatient(id, fields) {
    const now = new Date().toISOString();
    const allowed = ['name', 'age', 'notes', 'research_sharing', 'doctor_sharing'];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (keys.length === 0) return;

    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(now, id);

    await this.db.executeSql(
      `UPDATE patients SET ${setClause}, updated_at = ? WHERE id = ?`,
      values
    );
  }

  async getAllPatients() {
    const [results] = await this.db.executeSql(
      `SELECT * FROM patients ORDER BY created_at DESC`
    );
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  async getPatient(id) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM patients WHERE id = ?`, [id]
    );
    return results.rows.length > 0 ? results.rows.item(0) : null;
  }

  async deletePatient(id) {
    await this.db.executeSql(`DELETE FROM patients WHERE id = ?`, [id]);
  }

  // ============ SESSIONS ============

  async createSession(patientId) {
    const now = new Date().toISOString();
    const [result] = await this.db.executeSql(
      `INSERT INTO sessions (patient_id, start_time) VALUES (?, ?)`,
      [patientId, now]
    );
    return result.insertId;
  }

  async endSession(sessionId) {
    const now = new Date().toISOString();

    // Aggregate stats from the features that were actually saved.
    // Uses CASE WHEN rather than FILTER for maximum SQLite version compatibility.
    const [statsResult] = await this.db.executeSql(
      `SELECT
        COALESCE(SUM(CASE WHEN tremor_detected = 1 THEN 1 ELSE 0 END), 0) as tremor_count,
        COALESCE(MAX(amplitude), 0) as peak_amplitude,
        COALESCE(AVG(CASE WHEN tremor_detected = 1 THEN amplitude ELSE NULL END), 0) as avg_amplitude,
        COALESCE(MAX(severity), 0) as max_severity
      FROM features WHERE session_id = ?`,
      [sessionId]
    );
    const stats = statsResult.rows.item(0);

    const [sessionResult] = await this.db.executeSql(
      `SELECT start_time FROM sessions WHERE id = ?`, [sessionId]
    );
    if (sessionResult.rows.length === 0) return null;

    const startTime = new Date(sessionResult.rows.item(0).start_time);
    const duration = Math.floor((new Date(now) - startTime) / 1000);

    await this.db.executeSql(
      `UPDATE sessions SET
        end_time = ?,
        total_duration = ?,
        tremor_count = ?,
        peak_amplitude = ?,
        avg_amplitude = ?,
        max_severity = ?
      WHERE id = ?`,
      [
        now,
        duration,
        stats.tremor_count || 0,
        stats.peak_amplitude || 0,
        stats.avg_amplitude || 0,
        stats.max_severity || 0,
        sessionId,
      ]
    );

    // Build event rows from contiguous runs
    await this.deriveTremorEvents(sessionId);

    return this.getSession(sessionId);
  }

  // Group runs of tremor_detected=1 packets into events
  async deriveTremorEvents(sessionId) {
    const features = await this.getSessionFeatures(sessionId);
    if (features.length === 0) return;

    // Clear prior events for this session (idempotent)
    await this.db.executeSql(
      `DELETE FROM tremor_events WHERE session_id = ?`, [sessionId]
    );

    let currentEvent = null;
    for (const f of features) {
      if (f.tremor_detected === 1) {
        if (!currentEvent) {
          currentEvent = {
            start: f.timestamp,
            end: f.timestamp,
            peak: f.amplitude,
            count: 1,
          };
        } else {
          currentEvent.end = f.timestamp;
          currentEvent.peak = Math.max(currentEvent.peak, f.amplitude);
          currentEvent.count += 1;
        }
      } else if (currentEvent) {
        await this.saveTremorEvent(sessionId, currentEvent);
        currentEvent = null;
      }
    }
    if (currentEvent) {
      await this.saveTremorEvent(sessionId, currentEvent);
    }
  }

  async saveTremorEvent(sessionId, event) {
    const duration = Math.floor(
      (new Date(event.end) - new Date(event.start)) / 1000
    );
    await this.db.executeSql(
      `INSERT INTO tremor_events (session_id, start_time, end_time, duration, peak_amplitude)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, event.start, event.end, Math.max(duration, 30), event.peak]
    );
  }

  async getSession(sessionId) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM sessions WHERE id = ?`, [sessionId]
    );
    return results.rows.length > 0 ? results.rows.item(0) : null;
  }

  async getAllSessions(patientId = null) {
    let sql = `SELECT * FROM sessions WHERE end_time IS NOT NULL`;
    const params = [];
    if (patientId) {
      sql += ` AND patient_id = ?`;
      params.push(patientId);
    }
    sql += ` ORDER BY start_time DESC`;

    const [results] = await this.db.executeSql(sql, params);
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  async deleteSession(sessionId) {
    await this.db.executeSql(`DELETE FROM sessions WHERE id = ?`, [sessionId]);
  }

  // ============ FEATURES (per-packet data) ============

  async addFeature(sessionId, { amplitude, tremorDetected }) {
    const timestamp = new Date().toISOString();
    const severity = tremorDetected ? amplitudeToSeverity(amplitude) : 0;
    await this.db.executeSql(
      `INSERT INTO features (session_id, timestamp, amplitude, tremor_detected, severity)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, timestamp, amplitude, tremorDetected ? 1 : 0, severity]
    );
  }

  async getSessionFeatures(sessionId) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM features WHERE session_id = ? ORDER BY timestamp ASC`,
      [sessionId]
    );
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  async getSessionEvents(sessionId) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM tremor_events WHERE session_id = ? ORDER BY start_time ASC`,
      [sessionId]
    );
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  // ============ TODAY'S SUMMARY (fixed) ============

  async getTodaySummary(patientId = null) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    let sql = `
      SELECT
        COUNT(id) as session_count,
        COALESCE(SUM(tremor_count), 0) as total_tremor_count,
        COALESCE(SUM(total_duration), 0) as total_duration,
        COALESCE(MAX(peak_amplitude), 0) as peak_amplitude,
        COALESCE(MAX(max_severity), 0) as max_severity
      FROM sessions
      WHERE start_time >= ? AND end_time IS NOT NULL
    `;
    const params = [todayISO];

    if (patientId) {
      sql += ` AND patient_id = ?`;
      params.push(patientId);
    }

    const [results] = await this.db.executeSql(sql, params);
    const row = results.rows.item(0);

    return {
      sessions: row.session_count || 0,
      tremorCount: row.total_tremor_count || 0,
      totalDuration: row.total_duration || 0,
      peakAmplitude: row.peak_amplitude || 0,
      maxSeverity: row.max_severity || 0,
    };
  }

  // ============ MEDICATION LOGS ============

  async logMedication({ patientId, pillCount, triggerType, sessionId = null }) {
    const timestamp = new Date().toISOString();
    const [result] = await this.db.executeSql(
      `INSERT INTO medication_logs (patient_id, timestamp, pill_count, trigger_type, session_id)
       VALUES (?, ?, ?, ?, ?)`,
      [patientId, timestamp, pillCount, triggerType, sessionId]
    );
    return result.insertId;
  }

  async getMedicationLogs(patientId = null, limit = 100) {
    let sql = `SELECT * FROM medication_logs`;
    const params = [];
    if (patientId) {
      sql += ` WHERE patient_id = ?`;
      params.push(patientId);
    }
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const [results] = await this.db.executeSql(sql, params);
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  // ============ SETTINGS (key-value) ============

  async setSetting(key, value) {
    await this.db.executeSql(
      `INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
  }

  async getSetting(key, defaultValue = null) {
    const [results] = await this.db.executeSql(
      `SELECT value FROM user_settings WHERE key = ?`, [key]
    );
    if (results.rows.length === 0) return defaultValue;
    try {
      return JSON.parse(results.rows.item(0).value);
    } catch {
      return defaultValue;
    }
  }

  // ============ SYNC QUEUE ============

  async queueSync(entityType, entityId, payload) {
    const now = new Date().toISOString();
    await this.db.executeSql(
      `INSERT INTO sync_queue (entity_type, entity_id, payload, created_at)
       VALUES (?, ?, ?, ?)`,
      [entityType, entityId, JSON.stringify(payload), now]
    );
  }

  async getPendingSyncs() {
    const [results] = await this.db.executeSql(
      `SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 50`
    );
    const rows = [];
    for (let i = 0; i < results.rows.length; i++) rows.push(results.rows.item(i));
    return rows;
  }

  async markSyncComplete(queueId, firebaseId = null, entityType = null, entityId = null) {
    await this.db.executeSql(`DELETE FROM sync_queue WHERE id = ?`, [queueId]);
    if (firebaseId && entityType && entityId) {
      const table = entityType === 'session' ? 'sessions' : 'medication_logs';
      await this.db.executeSql(
        `UPDATE ${table} SET firebase_id = ? WHERE id = ?`,
        [firebaseId, entityId]
      );
    }
  }

  async markSyncFailed(queueId) {
    const now = new Date().toISOString();
    await this.db.executeSql(
      `UPDATE sync_queue SET last_attempt = ?, attempts = attempts + 1 WHERE id = ?`,
      [now, queueId]
    );
  }

  // ============ CSV EXPORT (fixed) ============

  async exportSessionToCSV(sessionId) {
    const session = await this.getSession(sessionId);
    const features = await this.getSessionFeatures(sessionId);
    const events = await this.getSessionEvents(sessionId);

    if (!session) return '';

    let csv = '';
    csv += `Session ID,${session.id}\n`;
    csv += `Patient ID,${session.patient_id || 'unknown'}\n`;
    csv += `Start Time,${session.start_time}\n`;
    csv += `End Time,${session.end_time || 'N/A'}\n`;
    csv += `Total Duration (s),${session.total_duration}\n`;
    csv += `Tremor Count,${session.tremor_count}\n`;
    csv += `Peak Amplitude (m/s^2),${session.peak_amplitude.toFixed(3)}\n`;
    csv += `Average Amplitude (m/s^2),${session.avg_amplitude.toFixed(3)}\n`;
    csv += `Max Severity (0-4),${session.max_severity}\n`;
    csv += `\n`;

    csv += `--- Per-Window Data ---\n`;
    csv += `Timestamp,Amplitude (m/s^2),Tremor Detected,Severity (0-4)\n`;
    for (const f of features) {
      csv += `${f.timestamp},${f.amplitude.toFixed(3)},${f.tremor_detected ? 'Yes' : 'No'},${f.severity}\n`;
    }
    csv += `\n`;

    csv += `--- Tremor Events ---\n`;
    csv += `Start,End,Duration (s),Peak Amplitude\n`;
    for (const e of events) {
      csv += `${e.start_time},${e.end_time},${e.duration},${e.peak_amplitude.toFixed(3)}\n`;
    }

    return csv;
  }

  // ============ CLEANUP ============

  async clearAllData() {
    const tables = [
      'sync_queue', 'medication_logs', 'tremor_events',
      'features', 'sessions', 'patients', 'user_settings',
    ];
    for (const t of tables) {
      await this.db.executeSql(`DELETE FROM ${t}`);
    }
  }

  async closeDatabase() {
    if (this.db) await this.db.close();
  }
}

export default new DatabaseService();
