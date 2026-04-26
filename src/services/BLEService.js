import { Buffer } from 'buffer';
import { BleManager } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

// Sleeve (Eric's firmware)
export const SLEEVE_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
export const SLEEVE_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
export const SLEEVE_DEVICE_NAME = 'TremorSleeve';

// Dispenser (Samir's firmware, peripheral mode)
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
    this.deviceId = null;
    this.disconnectSubscription = null;
    this.onConnectionChange = null;
    this.onTremorPacket = null;
  }

  isConnected() {
    return this.device !== null;
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
      const connected = await device.connect();
      this.device = await connected.discoverAllServicesAndCharacteristics();
      this.deviceId = this.device.id;
      console.log('[Sleeve] Connected, deviceId=', this.deviceId);

      this.disconnectSubscription = this.device.onDisconnected((error) => {
        if (error) console.warn('Sleeve disconnected with error:', error.message);
        else console.log('Sleeve disconnected by remote');
        this._handleDisconnect();
      });

      this.device.monitorCharacteristicForService(
        SLEEVE_SERVICE_UUID,
        SLEEVE_CHAR_UUID,
        (error, characteristic) => {
          if (error) return;
          if (characteristic?.value) {
            const packet = this.decodePacket(characteristic.value);
            if (packet && this.onTremorPacket) this.onTremorPacket(packet);
          }
        }
      );

      if (this.onConnectionChange) this.onConnectionChange(true);
      return true;
    } catch (error) {
      console.error('Sleeve connect error:', error.message || error);
      this.device = null;
      this.deviceId = null;
      if (this.onConnectionChange) this.onConnectionChange(false);
      return false;
    }
  }

  _handleDisconnect() {
    if (this.disconnectSubscription) {
      try { this.disconnectSubscription.remove(); } catch {}
      this.disconnectSubscription = null;
    }
    this.device = null;
    this.deviceId = null;
    if (this.onConnectionChange) this.onConnectionChange(false);
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
    }
    this._handleDisconnect();
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
    this.deviceId = null;
    this.disconnectSubscription = null;
    this.onConnectionChange = null;
  }

  isConnected() {
    return this.device !== null;
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
        if (device?.name === DISPENSER_DEVICE_NAME || device?.name === 'PilD') {
          clearTimeout(timeout);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  async connect(device) {
    try {
      console.log('[Dispenser] Connecting to', device.id, device.name);
      const connected = await device.connect();
      const discovered = await connected.discoverAllServicesAndCharacteristics();

      // Save BOTH device object and id. We use the id for writes via the
      // manager — that path is more robust to stale device references.
      this.device = discovered;
      this.deviceId = discovered.id;

      console.log('[Dispenser] Connected, deviceId=', this.deviceId);

      // Verify the service and characteristic actually exist on this device.
      // If they don't, fail loudly here instead of failing on dispense later.
      const services = await discovered.services();
      console.log('[Dispenser] services found:', services.map(s => s.uuid));

      const svc = services.find(
        s => s.uuid.toLowerCase() === DISPENSER_SERVICE_UUID.toLowerCase()
      );
      if (!svc) {
        throw new Error(
          `Dispenser is missing service ${DISPENSER_SERVICE_UUID}. ` +
          `Found: ${services.map(s => s.uuid).join(', ') || 'none'}`
        );
      }
      const chars = await svc.characteristics();
      console.log('[Dispenser] chars:', chars.map(c => c.uuid));

      this.disconnectSubscription = discovered.onDisconnected((error) => {
        if (error) console.warn('Dispenser disconnected with error:', error.message);
        else console.log('Dispenser disconnected by remote');
        this._handleDisconnect();
      });

      if (this.onConnectionChange) this.onConnectionChange(true);
      return true;
    } catch (error) {
      console.error('Dispenser connect error:', error.message || error);
      this.device = null;
      this.deviceId = null;
      if (this.onConnectionChange) this.onConnectionChange(false);
      return false;
    }
  }

  _handleDisconnect() {
    if (this.disconnectSubscription) {
      try { this.disconnectSubscription.remove(); } catch {}
      this.disconnectSubscription = null;
    }
    this.device = null;
    this.deviceId = null;
    if (this.onConnectionChange) this.onConnectionChange(false);
  }

  // Dispenser firmware reads: pendingPills as int32 little-endian.
  // We write a 4-byte LE int32, addressing the device by ID through the
  // manager rather than via the cached device object — this avoids the
  // "Service ... for device ?" stale-reference error on Android.
  async dispense(pillCount) {
    if (!this.deviceId) throw new Error('Dispenser not connected');

    const buf = Buffer.alloc(4);
    buf.writeInt32LE(pillCount, 0);
    const b64 = buf.toString('base64');

    console.log('[Dispenser] dispensing', pillCount, 'via deviceId', this.deviceId);

    try {
      await this.manager.writeCharacteristicWithResponseForDevice(
        this.deviceId,
        DISPENSER_SERVICE_UUID,
        DISPENSER_CHAR_UUID,
        b64
      );
      console.log('[Dispenser] write succeeded (with response)');
      return true;
    } catch (e1) {
      console.warn('[Dispenser] write-with-response failed:', e1?.message || e1);
      try {
        await this.manager.writeCharacteristicWithoutResponseForDevice(
          this.deviceId,
          DISPENSER_SERVICE_UUID,
          DISPENSER_CHAR_UUID,
          b64
        );
        console.log('[Dispenser] write succeeded (without response)');
        return true;
      } catch (e2) {
        console.error('[Dispenser] both writes failed:', e2?.message || e2);
        throw e2;
      }
    }
  }

  async disconnect() {
    if (this.deviceId) {
      try {
        await this.manager.cancelDeviceConnection(this.deviceId);
      } catch {}
    }
    this._handleDisconnect();
  }

  setOnConnection(cb) { this.onConnectionChange = cb; }

  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

export const SleeveBLE = new SleeveBLEClient();
export const DispenserBLE = new DispenserBLEClient();

// Default export preserves backward compatibility
export default SleeveBLE;
