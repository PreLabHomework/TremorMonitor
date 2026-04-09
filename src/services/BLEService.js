import { Buffer } from 'buffer';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

class BLEService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.characteristic = null;
    this.onConnectionChange = null;
    this.onTremorPacket = null;
  }

  async requestPermissions() {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
        return (
          granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
          granted['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
          granted['android.permission.ACCESS_FINE_LOCATION'] === 'granted'
        );
      } else {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === 'granted';
      }
    }
    return true;
  }

  async scanForDevices() {
    console.log('🔍 Starting BLE scan...');
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.error('❌ BLE permissions not granted');
      return null;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        console.log('⏱️ Scan timeout - no TremorSleeve found');
        resolve(null);
      }, 10000);

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          console.error('❌ Scan error:', error);
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }

        console.log('📡 Found device:', device.name || 'Unknown');

        if (device.name === 'TremorSleeve') {
          console.log('✅ Found TremorSleeve!');
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  async connectToDevice(device) {
    try {
      console.log('🔗 Connecting to device...');
      this.device = await device.connect();
      console.log('✅ Connected!');

      console.log('🔍 Discovering services...');
      await this.device.discoverAllServicesAndCharacteristics();
      console.log('✅ Services discovered!');

      console.log('📻 Starting to monitor characteristic...');
      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('❌ Monitor error:', error);
            return;
          }

          if (characteristic?.value) {
            console.log('📦 Received BLE packet!');
            const packet = this.decodeTremorPacket(characteristic.value);
            if (packet && this.onTremorPacket) {
              this.onTremorPacket(packet);
            }
          }
        }
      );

      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }

      console.log('✅ Monitoring started!');
      return true;
    } catch (error) {
      console.error('❌ Connection error:', error);
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
      return false;
    }
  }

  decodeTremorPacket(base64Data) {
    try {
      const buffer = Buffer.from(base64Data, 'base64');
      
      console.log('📦 Packet size:', buffer.length, 'bytes');
      
      // Eric's actual packet structure: 5 bytes total
      // float maxAmplitude (4 bytes) + bool tremor (1 byte)
      
      if (buffer.length < 5) {
        console.error('❌ Packet too short:', buffer.length);
        return null;
      }

      const maxAmplitude = buffer.readFloatLE(0);     // bytes 0-3
      const tremorDetected = buffer.readUInt8(4) !== 0;       // byte 4

      console.log('📊 Decoded:', {
        maxAmplitude: maxAmplitude.toFixed(2),
        tremor: tremorDetected
      });

      return {
        timestamp: Date.now(),
        maxAmplitude: maxAmplitude,
        dominantFreq: 5.0,  // Default tremor frequency
        duration: tremorDetected ? 60 : 0,
        tremor: tremorDetected
      };
    } catch (error) {
      console.error('❌ Error decoding packet:', error);
      return null;
    }
  }

  async disconnect() {
    try {
      if (this.device) {
        await this.device.cancelConnection();
        this.device = null;
        console.log('🔌 Disconnected');
        if (this.onConnectionChange) {
          this.onConnectionChange(false);
        }
      }
    } catch (error) {
      console.error('❌ Disconnect error:', error);
    }
  }

  setConnectionCallback(callback) {
    this.onConnectionChange = callback;
  }

  setTremorCallback(callback) {
    this.onTremorPacket = callback;
  }

  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

export default new BLEService();
