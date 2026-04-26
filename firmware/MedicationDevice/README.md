\# MedicationDevice Firmware



\*\*Board:\*\* Adafruit ItsyBitsy nRF52840 Express

\*\*Serial baud:\*\* 9600

\*\*USB stack:\*\* TinyUSB (Tools → USB Stack → TinyUSB)



\## Libraries

\- Adafruit Bluefruit nRF52 (from Adafruit board package)

\- Adafruit TinyUSB

\- Stepper (built-in)



\## Hardware

\- Stepper motor: ULN2003 driver on pins 7, 10, 9, 11

\- Optical sensor: A0 (LDR or IR break-beam, \~790 baseline, dips below 680 when pill passes)



\## Behavior

Advertises as "PillDispenser". Accepts a 4-byte little-endian int32 BLE write

representing pill count (1-10). Steps the motor and counts pills as they

break the optical beam.



BLE service UUID: `a3c87500-8ed3-4bdf-8a39-a01bebede295`

Characteristic:   `a3c87501-8ed3-4bdf-8a39-a01bebede295`

