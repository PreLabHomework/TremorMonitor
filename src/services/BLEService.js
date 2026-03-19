import { BleManager } from 'react-native-ble-plx';

// BLE UUIDs - Eric needs to use these same UUIDs in his ESP32 code
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const TREMOR_CHARACTERISTIC_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

class BLEService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.isConnected = false;
    
    // Callbacks
    this.onConnectionChange = null;
    this.onTremorPacket = null;
  }

  // Initialize BLE and check permissions
  async initialize() {
    const state = await this.manager.state();
    
    if (state === 'PoweredOff') {
      throw new Error('Bluetooth is turned off. Please enable it.');
    }
    
    console.log('BLE Manager initialized');
  }

  // Scan for devices (filter by name)
  async scanForDevices(onDeviceFound, deviceName = 'TremorSleeve') {
    console.log('Starting BLE scan...');
    
    this.manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }

      // Filter by device name
      if (device.name && device.name.includes(deviceName)) {
        console.log('Found device:', device.name, device.id);
        onDeviceFound(device);
      }
    });

    // Stop scan after 10 seconds
    setTimeout(() => {
      this.manager.stopDeviceScan();
      console.log('Scan stopped');
    }, 10000);
  }

  // Stop scanning
  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Connect to a specific device
  async connectToDevice(deviceId) {
    try {
      console.log('Connecting to device:', deviceId);
      
      // Stop scanning
      this.stopScan();

      // Connect to device
      this.device = await this.manager.connectToDevice(deviceId);
      
      console.log('Connected! Discovering services...');
      
      // Discover services and characteristics
      await this.device.discoverAllServicesAndCharacteristics();
      
      this.isConnected = true;
      
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }

      // Monitor disconnection
      this.device.onDisconnected((error, device) => {
        console.log('Device disconnected:', device.id);
        this.isConnected = false;
        this.device = null;
        
        if (this.onConnectionChange) {
          this.onConnectionChange(false);
        }
      });

      // Start listening for tremor packets
      this.startMonitoring();

      return true;
    } catch (error) {
      console.error('Connection error:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // Start monitoring for tremor data
  async startMonitoring() {
    if (!this.device) {
      console.error('No device connected');
      return;
    }

    try {
      console.log('Starting tremor monitoring...');
      
      // Subscribe to tremor characteristic
      this.device.monitorCharacteristicForService(
        SERVICE_UUID,
        TREMOR_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            console.error('Monitoring error:', error);
            return;
          }

          if (characteristic.value) {
            // Decode the packet
            const packet = this.decodeTremorPacket(characteristic.value);
            console.log('Received tremor packet:', packet);
            
            if (this.onTremorPacket) {
              this.onTremorPacket(packet);
            }
          }
        }
      );
      
      console.log('Monitoring started');
    } catch (error) {
      console.error('Failed to start monitoring:', error);
    }
  }

  // Decode BLE packet to tremor data
  // Packet structure (14 bytes):
  // uint32_t timestamp (4 bytes)
  // float maxAmplitude (4 bytes)
  // float dominantFreq (4 bytes)
  // uint16_t duration (2 bytes)
  decodeTremorPacket(base64Value) {
    try {
      // Decode base64 to binary
      const buffer = Buffer.from(base64Value, 'base64');
      
      // Read values from buffer
      const timestamp = buffer.readUInt32LE(0);
      const maxAmplitude = buffer.readFloatLE(4);
      const dominantFreq = buffer.readFloatLE(8);
      const duration = buffer.readUInt16LE(12);

      return {
        timestamp,
        maxAmplitude,
        dominantFreq,
        duration,
        receivedAt: Date.now(),
      };
    } catch (error) {
      console.error('Error decoding packet:', error);
      return null;
    }
  }

  // Disconnect from device
  async disconnect() {
    if (this.device) {
      try {
        await this.device.cancelConnection();
        console.log('Disconnected successfully');
      } catch (error) {
        console.error('Disconnect error:', error);
      }
      
      this.device = null;
      this.isConnected = false;
      
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
    }
  }

  // Get current connection status
  getConnectionStatus() {
    return this.isConnected;
  }

  // Cleanup
  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

// Export singleton instance
export default new BLEService();
