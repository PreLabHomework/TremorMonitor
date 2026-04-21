import { Buffer } from 'buffer';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

// Sleeve (existing, Eric's firmware)
export const SLEEVE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SLEEVE_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const SLEEVE_DEVICE_NAME = 'TremorSleeve';

// Dispenser (placeholder — Samir will provide real UUIDs once he flips to peripheral)
export const DISPENSER_SERVICE_UUID = 'a3c87500-8ed3-4bdf-8a39-a01bebede295';
export const DISPENSER_CHAR_UUID = 'a3c87501-8ed3-4bdf-8a39-a01bebede295';
export const DISPENSER_DEVICE_NAME = 'PillDispenser';

async function requestBlePermissions() {
  if (Platform.OS !== 'android') return true;
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
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return granted === 'granted';
}

// -------- Sleeve client --------

class SleeveBLEClient {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.onConnectionChange = null;
    this.onTremorPacket = null;
  }

  async scan() {
    const ok = await requestBlePermissions();
    if (!ok) throw new Error('BLE permissions not granted');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve(null);
      }, 10000);

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (device?.name === SLEEVE_DEVICE_NAME) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  async connect(device) {
    try {
      this.device = await device.connect();
      await this.device.discoverAllServicesAndCharacteristics();

      this.device.monitorCharacteristicForService(
        SLEEVE_SERVICE_UUID,
        SLEEVE_CHAR_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Sleeve monitor error:', error.message);
            return;
          }
          if (characteristic?.value) {
            const packet = this.decodePacket(characteristic.value);
            if (packet && this.onTremorPacket) this.onTremorPacket(packet);
          }
        }
      );

      if (this.onConnectionChange) this.onConnectionChange(true);
      return true;
    } catch (error) {
      console.error('Sleeve connect error:', error);
      if (this.onConnectionChange) this.onConnectionChange(false);
      return false;
    }
  }

  // Eric's packet: float maxAmplitude (4 bytes) + bool tremor (1 byte) = 5 bytes
  decodePacket(base64Data) {
    try {
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length < 5) {
        console.warn('Sleeve packet too short:', buf.length);
        return null;
      }
      const amplitude = buf.readFloatLE(0);
      const tremorDetected = buf.readUInt8(4) !== 0;
      return {
        amplitude,
        tremorDetected,
        receivedAt: Date.now(),
      };
    } catch (e) {
      console.error('Sleeve decode error:', e);
      return null;
    }
  }

  async disconnect() {
    if (this.device) {
      try { await this.device.cancelConnection(); } catch {}
      this.device = null;
      if (this.onConnectionChange) this.onConnectionChange(false);
    }
  }

  setOnConnection(cb) { this.onConnectionChange = cb; }
  setOnPacket(cb) { this.onTremorPacket = cb; }

  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

// -------- Dispenser client --------

class DispenserBLEClient {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.characteristic = null;
    this.onConnectionChange = null;
  }

  async scan() {
    const ok = await requestBlePermissions();
    if (!ok) throw new Error('BLE permissions not granted');

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.manager.stopDeviceScan();
        resolve(null);
      }, 10000);

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          reject(error);
          return;
        }
        if (device?.name === DISPENSER_DEVICE_NAME) {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  async connect(device) {
    try {
      this.device = await device.connect();
      await this.device.discoverAllServicesAndCharacteristics();
      if (this.onConnectionChange) this.onConnectionChange(true);
      return true;
    } catch (error) {
      console.error('Dispenser connect error:', error);
      if (this.onConnectionChange) this.onConnectionChange(false);
      return false;
    }
  }

  // Dispenser firmware reads: pendingPills = *(int*)data
  // So we write a 4-byte little-endian int32.
  async dispense(pillCount) {
    if (!this.device) throw new Error('Dispenser not connected');
    const buf = Buffer.alloc(4);
    buf.writeInt32LE(pillCount, 0);
    const b64 = buf.toString('base64');

    await this.device.writeCharacteristicWithResponseForService(
      DISPENSER_SERVICE_UUID,
      DISPENSER_CHAR_UUID,
      b64
    );
    return true;
  }

  async disconnect() {
    if (this.device) {
      try { await this.device.cancelConnection(); } catch {}
      this.device = null;
      if (this.onConnectionChange) this.onConnectionChange(false);
    }
  }

  isConnected() { return this.device !== null; }
  setOnConnection(cb) { this.onConnectionChange = cb; }

  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

export const SleeveBLE = new SleeveBLEClient();
export const DispenserBLE = new DispenserBLEClient();

// Default export preserves backward compatibility with LiveMonitor that imports `BLEService`
export default SleeveBLE;
