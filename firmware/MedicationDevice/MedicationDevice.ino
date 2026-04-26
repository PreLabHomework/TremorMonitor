/*
 * MedicationDevice.ino - Pill Dispenser (BLE Peripheral)
 * 
 * Board: Adafruit ItsyBitsy nRF52840 Express
 * 
 * Advertises as "PillDispenser" and accepts a 4-byte little-endian int32
 * write via BLE from the TremorMonitor app. The integer value is the
 * number of pills to dispense.
 * 
 * Hardware:
 *   Stepper motor: ULN2003 driver on pins 7, 10, 9, 11
 *   Optical sensor: A0 (detects pill passing through dispense chute)
 */

#include <Stepper.h>
#include <Arduino.h>
#include <Adafruit_TinyUSB.h>
#include <bluefruit.h>

// ----- Must match BLEService.js constants in the app -----
// String form (what the app uses):
//   Service:        a3c87500-8ed3-4bdf-8a39-a01bebede295
//   Characteristic: a3c87501-8ed3-4bdf-8a39-a01bebede295
//
// Bluefruit takes 128-bit UUIDs as a byte array in REVERSE order.
// So: a3c87500-8ed3-4bdf-8a39-a01bebede295 (no dashes, low nibble last)
// reversed byte-by-byte becomes:
//   95 e2 ed eb 1b a0 39 8a df 4b d3 8e 00 75 c8 a3

const uint8_t DISPENSER_SERVICE_UUID[16] = {
  0x95, 0xe2, 0xed, 0xeb, 0x1b, 0xa0, 0x39, 0x8a,
  0xdf, 0x4b, 0xd3, 0x8e, 0x00, 0x75, 0xc8, 0xa3
};

const uint8_t DISPENSER_CHAR_UUID[16] = {
  0x95, 0xe2, 0xed, 0xeb, 0x1b, 0xa0, 0x39, 0x8a,
  0xdf, 0x4b, 0xd3, 0x8e, 0x01, 0x75, 0xc8, 0xa3
};

BLEService dispenserService(DISPENSER_SERVICE_UUID);
BLECharacteristic dispenserChar(DISPENSER_CHAR_UUID);

// ----- Hardware -----
Stepper myStep(2048, 7, 10, 9, 11);
int sensorValue;

// ----- State -----
volatile int pendingPills = 0;
volatile bool newCommand = false;

// ========== BLE callbacks ==========

void connect_callback(uint16_t conn_handle) {
  BLEConnection* conn = Bluefruit.Connection(conn_handle);
  char peer_name[32] = { 0 };
  conn->getPeerName(peer_name, sizeof(peer_name));
  Serial.print("Connected to: ");
  Serial.println(peer_name);
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
  (void) conn_handle;
  Serial.print("Disconnected, reason: 0x");
  Serial.println(reason, HEX);
  // Bluefruit auto-restarts advertising via restartOnDisconnect(true)
}

// Called whenever the phone writes to the dispense characteristic.
// Expected payload: 4 bytes, little-endian int32 representing pill count.
void write_callback(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
  (void) conn_hdl;
  (void) chr;

  if (len < 4) {
    Serial.print("Bad write length: ");
    Serial.println(len);
    return;
  }

  // Little-endian int32. nRF52 is little-endian native, so this is a direct cast.
  int32_t n = 0;
  memcpy(&n, data, 4);

  Serial.print("Received dispense command: ");
  Serial.println(n);

  // Sanity clamp. App only sends 1-5, but never trust input.
  if (n < 1 || n > 10) {
    Serial.println("Rejected: out of range");
    return;
  }

  pendingPills = n;
  newCommand = true;
}

// ========== Hardware ==========

void dispensePills(int numPills) {
  Serial.print("Dispensing ");
  Serial.print(numPills);
  Serial.println(" pill(s)...");

  int count = 0;
  bool trend = false;

  // Safety timeout: bail if we somehow can't detect pills
  unsigned long startMs = millis();
  const unsigned long MAX_MS = 30000UL; // 30 seconds per pill max

  while (count < numPills) {
    if (millis() - startMs > MAX_MS * numPills) {
      Serial.println("Dispense timeout, aborting");
      break;
    }

    myStep.step(-1);
    sensorValue = analogRead(A0);
    Serial.println(sensorValue);

    if (sensorValue > 680) {
      trend = false;
    } else if (!trend) {
      myStep.step(-3);
      Serial.print("Dispensed pill at value: ");
      Serial.println(sensorValue);
      delay(1000);
      count += 1;
      trend = true;
    }
  }

  Serial.print("Dispensed pills: ");
  Serial.println(count);
}

// ========== Setup / Loop ==========

void startAdvertising() {
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(dispenserService);

  // Put full name in scan response (second packet) to avoid truncation
  Bluefruit.ScanResponse.addName();

  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244); // 20ms - 152.5ms
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0); // 0 = advertise forever
}

void setup() {
  Serial.begin(9600);
  // Wait briefly for serial (useful on nRF52840 with native USB)
  unsigned long t0 = millis();
  while (!Serial && millis() - t0 < 2000) { }

  Serial.println();
  Serial.println("PillDispenser BLE Peripheral starting...");

  // Bluefruit init: 1 peripheral, 0 central
  Bluefruit.begin(1, 0);
  Bluefruit.setTxPower(4); // 4 dBm = good range
  Bluefruit.setName("PillDispenser");

  Bluefruit.Periph.setConnectCallback(connect_callback);
  Bluefruit.Periph.setDisconnectCallback(disconnect_callback);

  // Service must begin before characteristics
  dispenserService.begin();

  // Write-only characteristic, 4 bytes
  dispenserChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_WRITE_WO_RESP);
  dispenserChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
  dispenserChar.setFixedLen(4);
  dispenserChar.setWriteCallback(write_callback);
  dispenserChar.begin();

  // Stepper
  myStep.setSpeed(2);

  startAdvertising();
  Serial.println("Advertising as 'PillDispenser'. Waiting for connection...");
}

void loop() {
  if (newCommand) {
    int n = pendingPills;
    newCommand = false;
    dispensePills(n);
  }
  // No busy-wait needed; everything is callback-driven
  delay(10);
}
