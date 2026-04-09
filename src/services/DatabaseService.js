import SQLite from 'react-native-sqlite-storage';

SQLite.DEBUG(true);
SQLite.enablePromise(true);

const DATABASE_NAME = 'TremorMonitor.db';
const DATABASE_VERSION = '1.0';
const DATABASE_DISPLAY_NAME = 'Tremor Monitor Database';
const DATABASE_SIZE = 200000;

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initDatabase() {
    try {
      console.log('📂 Opening database...');
      this.db = await SQLite.openDatabase({
        name: DATABASE_NAME,
        location: 'default',
      });

      console.log('✅ Database opened');
      await this.createTables();
      console.log('✅ Tables created');
      
      return true;
    } catch (error) {
      console.error('❌ Database initialization error:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_duration INTEGER DEFAULT 0,
        episode_count INTEGER DEFAULT 0,
        peak_amplitude REAL DEFAULT 0,
        avg_frequency REAL DEFAULT 0,
        notes TEXT
      )`,

      // Features table (per-minute tremor metrics)
      `CREATE TABLE IF NOT EXISTS features (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        frequency REAL NOT NULL,
        amplitude REAL NOT NULL,
        severity INTEGER DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,

      // Tremor events table
      `CREATE TABLE IF NOT EXISTS tremor_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER DEFAULT 0,
        peak_amplitude REAL DEFAULT 0,
        dominant_frequency REAL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )`,

      // Medication logs table
      `CREATE TABLE IF NOT EXISTS medication_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        dose_type TEXT DEFAULT 'manual',
        auto_triggered INTEGER DEFAULT 0,
        notes TEXT
      )`,

      // User settings table
      `CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // Device info table
      `CREATE TABLE IF NOT EXISTS device_info (
        device_id TEXT PRIMARY KEY,
        device_name TEXT,
        last_connected TEXT,
        battery_level INTEGER DEFAULT 100
      )`,

      // Sync queue table (for Firebase sync)
      `CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT NOT NULL,
        record_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )`
    ];

    for (const createStatement of tables) {
      await this.db.executeSql(createStatement);
    }
  }

  // ==================== SESSION OPERATIONS ====================

  async createSession() {
    const now = new Date().toISOString();
    const result = await this.db.executeSql(
      'INSERT INTO sessions (start_time) VALUES (?)',
      [now]
    );
    const sessionId = result[0].insertId;
    console.log('📝 Created session:', sessionId);
    return sessionId;
  }

  async endSession(sessionId) {
    const now = new Date().toISOString();
    
    // Calculate session stats
    const [statsResult] = await this.db.executeSql(
      `SELECT 
        COUNT(*) as episode_count,
        MAX(amplitude) as peak_amplitude,
        AVG(frequency) as avg_frequency
      FROM features 
      WHERE session_id = ?`,
      [sessionId]
    );

    const stats = statsResult.rows.item(0);

    // Get session start time
    const [sessionResult] = await this.db.executeSql(
      'SELECT start_time FROM sessions WHERE id = ?',
      [sessionId]
    );
    
    const startTime = new Date(sessionResult.rows.item(0).start_time);
    const endTime = new Date(now);
    const duration = Math.floor((endTime - startTime) / 1000); // seconds

    // Update session
    await this.db.executeSql(
      `UPDATE sessions 
      SET end_time = ?, 
          total_duration = ?,
          episode_count = ?,
          peak_amplitude = ?,
          avg_frequency = ?
      WHERE id = ?`,
      [now, duration, stats.episode_count, stats.peak_amplitude || 0, stats.avg_frequency || 0, sessionId]
    );

    console.log('✅ Session ended:', sessionId);
    return true;
  }

  async getAllSessions() {
    const [results] = await this.db.executeSql(
      `SELECT * FROM sessions 
       WHERE end_time IS NOT NULL 
       ORDER BY start_time DESC`
    );

    const sessions = [];
    for (let i = 0; i < results.rows.length; i++) {
      sessions.push(results.rows.item(i));
    }

    console.log('📋 Loaded sessions:', sessions.length);
    return sessions;
  }

  async getSession(sessionId) {
    const [results] = await this.db.executeSql(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );

    if (results.rows.length > 0) {
      return results.rows.item(0);
    }
    return null;
  }

  // ==================== FEATURE OPERATIONS ====================

  async addFeature(sessionId, feature) {
    const { timestamp, frequency, amplitude, severity } = feature;
    
    await this.db.executeSql(
      `INSERT INTO features (session_id, timestamp, frequency, amplitude, severity)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, timestamp, frequency, amplitude, severity || 0]
    );

    console.log('📊 Added feature to session:', sessionId);
  }

  async getSessionFeatures(sessionId) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM features 
       WHERE session_id = ? 
       ORDER BY timestamp ASC`,
      [sessionId]
    );

    const features = [];
    for (let i = 0; i < results.rows.length; i++) {
      features.push(results.rows.item(i));
    }

    return features;
  }

  // ==================== TREMOR EVENT OPERATIONS ====================

  async addTremorEvent(sessionId, event) {
    const { start_time, duration, peak_amplitude, dominant_frequency } = event;
    const end_time = new Date(new Date(start_time).getTime() + duration * 1000).toISOString();

    await this.db.executeSql(
      `INSERT INTO tremor_events 
       (session_id, start_time, end_time, duration, peak_amplitude, dominant_frequency)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sessionId, start_time, end_time, duration, peak_amplitude, dominant_frequency]
    );

    console.log('⚠️ Added tremor event to session:', sessionId);
  }

  async getSessionEvents(sessionId) {
    const [results] = await this.db.executeSql(
      `SELECT * FROM tremor_events 
       WHERE session_id = ? 
       ORDER BY start_time ASC`,
      [sessionId]
    );

    const events = [];
    for (let i = 0; i < results.rows.length; i++) {
      events.push(results.rows.item(i));
    }

    return events;
  }

  // ==================== SETTINGS OPERATIONS ====================

  async setSetting(key, value) {
    await this.db.executeSql(
      `INSERT OR REPLACE INTO user_settings (key, value) 
       VALUES (?, ?)`,
      [key, JSON.stringify(value)]
    );
  }

  async getSetting(key, defaultValue = null) {
    const [results] = await this.db.executeSql(
      'SELECT value FROM user_settings WHERE key = ?',
      [key]
    );

    if (results.rows.length > 0) {
      return JSON.parse(results.rows.item(0).value);
    }
    return defaultValue;
  }

  // ==================== TODAY'S SUMMARY ====================

  async getTodaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const [results] = await this.db.executeSql(
      `SELECT 
        COUNT(DISTINCT f.session_id) as episode_count,
        SUM(s.total_duration) as total_duration,
        MAX(f.amplitude) as peak_amplitude,
        AVG(f.frequency) as avg_frequency
      FROM features f
      JOIN sessions s ON f.session_id = s.id
      WHERE s.start_time >= ?`,
      [todayISO]
    );

    if (results.rows.length > 0) {
      const summary = results.rows.item(0);
      return {
        episodes: summary.episode_count || 0,
        totalDuration: summary.total_duration || 0,
        peakAmplitude: summary.peak_amplitude || 0,
        avgFrequency: summary.avg_frequency || 0,
      };
    }

    return {
      episodes: 0,
      totalDuration: 0,
      peakAmplitude: 0,
      avgFrequency: 0,
    };
  }

  // ==================== EXPORT OPERATIONS ====================

  async exportSessionToCSV(sessionId) {
    const session = await this.getSession(sessionId);
    const features = await this.getSessionFeatures(sessionId);

    let csv = 'Timestamp,Frequency (Hz),Amplitude (m/s²),Severity\n';
    
    features.forEach(feature => {
      csv += `${feature.timestamp},${feature.frequency},${feature.amplitude},${feature.severity}\n`;
    });

    return csv;
  }

  // ==================== CLEANUP ====================

  async deleteSession(sessionId) {
    await this.db.executeSql('DELETE FROM sessions WHERE id = ?', [sessionId]);
    console.log('🗑️ Deleted session:', sessionId);
  }

  async clearAllData() {
    const tables = ['sessions', 'features', 'tremor_events', 'medication_logs', 'sync_queue'];
    
    for (const table of tables) {
      await this.db.executeSql(`DELETE FROM ${table}`);
    }
    
    console.log('🗑️ Cleared all data');
  }

  async closeDatabase() {
    if (this.db) {
      await this.db.close();
      console.log('📂 Database closed');
    }
  }
}

export default new DatabaseService();