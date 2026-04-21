# TremorMonitor

A wearable Parkinson's tremor monitoring and stabilization system. Real-time BLE-connected sleeve tracks tremor events throughout the day, automated pill dispenser delivers medication on demand, and a three-mode mobile app serves patients, their doctors, and clinical researchers from a single codebase.

Senior Design Project, Saint Louis University, Parks College of Engineering, 2026.

## Overview

Parkinson's disease affects around 10 million people worldwide, and tremor is one of its most visible and disabling symptoms. Existing monitoring relies on periodic in-clinic assessments that miss the day-to-day variability patients actually live with. TremorMonitor is a full stack system, hardware through cloud, designed to close that gap.

The patient wears a lightweight sleeve containing an IMU and MCU that detects tremor events using FFT analysis in the 3.9 to 25 Hz band. The sleeve streams summary data to a phone app over BLE. When tremor is detected, the app can trigger a second BLE device, a wrist-worn pill dispenser, to deliver a dose. All session data is stored locally in SQLite for offline reliability and mirrored to Firebase so that a doctor (with patient consent) can review episodes remotely and a researcher (with anonymized consent) can analyze cohort trends.

## Screenshots

> Screenshots coming soon. Current build is running on Android emulator and physical Samsung Galaxy Fold with BLE connectivity confirmed.

## Team

| Role | Name |
| --- | --- |
| App, system architecture, BLE integration | Hamza |
| Sleeve firmware (ESP32, IMU, FFT) | Eric |
| Dispenser firmware (nRF52840) | Samir |
| Mechanical design | Sage |

Faculty advisor and clinical consultation through the SLU Musculoskeletal Biomechanics Lab.

## Tech Stack

Mobile app: React Native 0.81, TypeScript, SQLite, Firebase Firestore, react-native-ble-plx, Notifee, React Navigation.

Sleeve firmware: ESP32, Arduino framework, MPU6050, 200 Hz sampling, FFT tremor detection.

Dispenser firmware: nRF52840, Zephyr, servo actuation on 4-byte command.

Cloud: Firebase Firestore for sync, anonymized research opt-in, per-patient doctor sharing toggles.

---

## Architecture

The app runs in one of three modes selected at launch. Each mode presents a different view on the same underlying data model.

### Patient mode
Sign in by tapping a card on the welcome screen (patients are added by their doctor in advance). Live monitor tab shows current tremor amplitude and session stats. Pills tab connects to the dispenser, supports manual dosing (1 to 5 pills) and auto-dispense on tremor detection. History tab lists past sessions grouped by week. Settings tab toggles doctor sharing, research participation, and notifications.

### Doctor mode
Dashboard with aggregate stats across all patients. Patient list with search and add-patient FAB. Per-patient detail view with session history and medication log, provided that patient has doctor sharing enabled.

### Researcher mode
Cohort-level aggregates over patients who opted into research sharing. Severity distribution histograms. Bulk CSV export of anonymized session data for downstream analysis.

## BLE Protocol

### Sleeve (peripheral, `TremorSleeve`)
- Service UUID: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- Characteristic UUID: `beb5483e-36e1-4688-b7f5-ea07361b26a8`
- Packet: 5 bytes, sent every 30 seconds
  - Bytes 0 to 3: `float maxAmplitude` (little-endian, IEEE 754)
  - Byte 4: `bool tremor` (1 if tremor detected in window, else 0)

Amplitude is mapped to a 0 to 4 severity scale (modeled on MDS-UPDRS Part III item 3.15) using thresholds that will be tuned against real patient recordings during clinical validation.

### Dispenser (peripheral, `PillDispenser`)
- Command: 4-byte little-endian `int32` specifying number of pills
- UUIDs are currently placeholders; will be finalized once firmware is flipped to peripheral role

## Data Model

SQLite on device with seven tables: patients, sessions, events, medications, med_logs, settings, and schema_version. Schema version is checked on every app launch; a mismatch triggers a fresh recreation so schema migrations can ship safely.

Firebase mirrors three collections:
- `patients` (name, id, sharing flags)
- `sessions` (patient_id, start/end, metrics)
- `med_logs` (patient_id, timestamp, dose, triggered_by)

Writes go through a service layer that checks sharing flags before uploading anything cloud-side.

## Getting Started

Requires Node 18+, Android Studio or Xcode, and a Firebase project with Firestore enabled.

```bash
git clone https://github.com/PreLabHomework/TremorMonitor.git
cd TremorMonitor
npm install
```

Add your `google-services.json` to `android/app/` and your `GoogleService-Info.plist` to `ios/`.

### Run on Android

```bash
npx react-native run-android
```

If vector icons render as placeholder boxes after a fresh install, this block at the end of `android/app/build.gradle` handles it:

```gradle
apply from: file("../../node_modules/react-native-vector-icons/fonts.gradle")
```

### Run on iOS

```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

### Testing with the sleeve

Physical device only; emulators do not support BLE. Flash Eric's firmware (separate repo) to an ESP32, power it, then in the app select Patient mode, pick a patient, and tap "Scan for sleeve" on the Live Monitor tab.

## Project Structure

```
src/
  theme/          design tokens, icon registry
  components/     reusable UI primitives
  services/       DatabaseService, BLEService (sleeve + dispenser), FirebaseService, NotificationService
  screens/
    ModeSelection, PatientWelcome         entry points
    LiveMonitor, History, Pills, Settings patient tabs
    SessionDetail                         shared detail view
    DoctorDashboard, PatientList,         doctor views
    PatientDetail, AddPatient
    ResearchDashboard, ResearchExport     researcher views
android/, ios/    native projects
App.tsx           3-mode navigation shell
```

## Roadmap

- Tune amplitude-to-severity thresholds against real tremor recordings
- Complete dispenser firmware and finalize real UUIDs
- Per-day and per-week trend views in doctor mode
- Background session recording when app is closed
- HIPAA review before any real patient data use

## License

TBD, currently for academic use as part of SLU senior design evaluation.

## Acknowledgments

Saint Louis University Parks College of Engineering, and the Musculoskeletal Biomechanics Lab for consultation on tremor biomechanics and clinical workflow.