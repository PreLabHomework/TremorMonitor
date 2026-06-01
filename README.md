# TremorMonitor

TremorMonitor is a senior design prototype for Parkinson's tremor monitoring, built around a BLE-connected wearable sleeve and a cross-platform mobile app for patients, clinicians, and researchers.

The system connects wearable tremor-sensing hardware to a React Native application that records sessions, tracks medication events, visualizes tremor data, and exports clinical or research data. The firmware-side sleeve and dispenser prototypes are maintained separately, while this repository focuses on the mobile app, BLE integration, local database, cloud sync, and multi-role workflow.

Senior Design Project, Saint Louis University, 2026.

## Overview

Parkinson's tremor can vary significantly throughout the day, while many assessments still depend on periodic in-clinic observation. TremorMonitor was designed to explore how wearable sensing, BLE communication, local storage, and mobile dashboards could support more continuous symptom tracking.

The patient wears a lightweight sleeve containing an IMU and microcontroller. The sleeve streams summary tremor data to the mobile app over BLE. The app stores session data locally in SQLite for offline reliability and can sync selected records to Firebase so that a doctor, with patient consent, can review episodes remotely and a researcher, with anonymized consent, can analyze cohort-level trends.

This repository contains the React Native application and app-side integration logic. Firmware prototypes for the sleeve and dispenser are maintained in a separate repository.

## Screenshots
<img width="748" height="457" alt="image" src="https://github.com/user-attachments/assets/eaf3a825-4645-4e6b-b519-d8fe54ab90e0" />

## Team

| Role | Name |
| --- | --- |
| App, system architecture, BLE integration | Hamza |
| Sleeve firmware (ESP32, IMU, FFT) | Eric |
| Dispenser firmware (nRF52840) | Samir |
| Mechanical design | Sage |

Faculty advisor and clinical consultation through the SLU ECE/BME Department.

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

Physical device only; emulators do not support BLE. Flash firmware (separate repo) to an ESP32, power it, then in the app select Patient mode, pick a patient, and tap "Scan for sleeve" on the Live Monitor tab.

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

Saint Louis University College of Engineering, and SLU Faculty for consultation on tremor biomechanics and clinical workflow.
