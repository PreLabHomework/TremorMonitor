// Thin wrapper over @notifee/react-native for local push notifications.
// Required install on the app side:
//   npm install @notifee/react-native
//   (Android: no extra config. iOS: pod install.)

import notifee, { AndroidImportance } from '@notifee/react-native';

const CHANNEL_ID = 'tremor-monitor-default';

class NotificationService {
  async init() {
    // Android needs a channel
    try {
      await notifee.createChannel({
        id: CHANNEL_ID,
        name: 'Tremor Monitor',
        importance: AndroidImportance.HIGH,
      });
    } catch (e) {
      console.warn('Notifee channel create error:', e);
    }

    // Request permissions (iOS is explicit; Android 13+ needs runtime permission)
    try {
      await notifee.requestPermission();
    } catch (e) {
      console.warn('Notifee permission error:', e);
    }
  }

  async send({ title, body, data = {} }) {
    try {
      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: CHANNEL_ID,
          smallIcon: 'ic_launcher',
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
        },
      });
      return true;
    } catch (e) {
      console.error('Notification send error:', e);
      return false;
    }
  }

  // Helpers for specific notification types
  tremorAlert(amplitude) {
    return this.send({
      title: 'Tremor detected',
      body: `Peak amplitude ${amplitude.toFixed(2)} m/s². Review the Live tab for details.`,
    });
  }

  medicationReminder() {
    return this.send({
      title: 'Medication reminder',
      body: 'Time for your scheduled dose.',
    });
  }

  dailySummaryPing(tremors, duration) {
    return this.send({
      title: 'Daily summary',
      body: `${tremors} tremors across ${Math.floor(duration / 60)} min of monitoring today.`,
    });
  }

  toggleEnabledConfirmation(label) {
    return this.send({
      title: `${label} enabled`,
      body: 'You will receive a real notification whenever this event occurs.',
    });
  }
}

export default new NotificationService();
