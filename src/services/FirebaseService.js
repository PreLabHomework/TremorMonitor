import { db } from './FirebaseConfig';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  doc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';

class FirebaseService {
  
  // Upload a session to Firestore
  async uploadSession(session, features, events) {
    try {
      console.log('☁️ Uploading session to Firebase...');
      
      const sessionData = {
        ...session,
        features: features,
        tremor_events: events,
        uploaded_at: serverTimestamp(),
        device_type: 'TremorSleeve',
        app_version: '1.0'
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, 'sessions'), sessionData);
      
      console.log('✅ Session uploaded to Firebase:', docRef.id);
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Error uploading session to Firebase:', error);
      throw error;
    }
  }
  
  // Upload patient data (for doctor portal)
  async uploadPatientInfo(patientId, patientData) {
    try {
      console.log('☁️ Uploading patient info to Firebase...');
      
      const patientDoc = {
        ...patientData,
        last_updated: serverTimestamp()
      };
      
      // Use setDoc to create/update patient document
      await setDoc(doc(db, 'patients', patientId), patientDoc);
      
      console.log('✅ Patient info uploaded to Firebase');
      return true;
      
    } catch (error) {
      console.error('❌ Error uploading patient info:', error);
      throw error;
    }
  }
  
  // Get all sessions from Firestore (for doctor portal)
  async getAllSessions() {
    try {
      console.log('☁️ Fetching sessions from Firebase...');
      
      const sessionsQuery = query(
        collection(db, 'sessions'),
        orderBy('start_time', 'desc')
      );
      
      const querySnapshot = await getDocs(sessionsQuery);
      const sessions = [];
      
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log('✅ Fetched sessions from Firebase:', sessions.length);
      return sessions;
      
    } catch (error) {
      console.error('❌ Error fetching sessions from Firebase:', error);
      throw error;
    }
  }
  
  // Get sessions for a specific patient
  async getPatientSessions(patientId) {
    try {
      console.log('☁️ Fetching patient sessions from Firebase...');
      
      const sessionsQuery = query(
        collection(db, 'sessions'),
        where('patient_id', '==', patientId),
        orderBy('start_time', 'desc')
      );
      
      const querySnapshot = await getDocs(sessionsQuery);
      const sessions = [];
      
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log('✅ Fetched patient sessions from Firebase:', sessions.length);
      return sessions;
      
    } catch (error) {
      console.error('❌ Error fetching patient sessions:', error);
      throw error;
    }
  }
  
  // Get high severity sessions (for alerts)
  async getHighSeveritySessions() {
    try {
      console.log('☁️ Fetching high severity sessions...');
      
      const alertsQuery = query(
        collection(db, 'sessions'),
        where('peak_amplitude', '>=', 2.0),
        orderBy('peak_amplitude', 'desc')
      );
      
      const querySnapshot = await getDocs(alertsQuery);
      const sessions = [];
      
      querySnapshot.forEach((doc) => {
        sessions.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log('✅ Fetched high severity sessions:', sessions.length);
      return sessions;
      
    } catch (error) {
      console.error('❌ Error fetching high severity sessions:', error);
      throw error;
    }
  }
  
  // Test connection to Firebase
  async testConnection() {
    try {
      console.log('🔍 Testing Firebase connection...');
      
      const testDoc = await addDoc(collection(db, 'test'), {
        message: 'Firebase connection test',
        timestamp: serverTimestamp()
      });
      
      console.log('✅ Firebase connection successful!');
      return true;
      
    } catch (error) {
      console.error('❌ Firebase connection failed:', error);
      return false;
    }
  }
}

export default new FirebaseService();