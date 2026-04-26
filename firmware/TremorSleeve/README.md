\# TremorSleeve Firmware



\*\*Board:\*\* Adafruit Feather ESP32-S3 2MB PSRAM

\*\*Serial baud:\*\* 230400



\## Libraries

\- Adafruit MPU6050

\- Adafruit Sensor

\- ESP-DSP (esp\_dsp.h)

\- ESP32 BLE (built-in)



\## Behavior

Samples the MPU6050 at 200 Hz, runs an FFT every 0.5s on a 256-sample window,

detects tremor in the 4-25 Hz band, and sends a 5-byte BLE packet every 30

seconds containing peak band-limited RMS amplitude (float, m/s²) and a

tremor-detected boolean.



BLE service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`

Characteristic:   `beb5483e-36e1-4688-b7f5-ea07361b26a8`

