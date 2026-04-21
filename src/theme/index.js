// Design system for TremorMonitor
// Consumer-health vibe: rounded, friendly, clinical but not sterile.
// Palette: teal primary, coral accent, soft whites, gentle greys.

export const colors = {
  // Primary — calm teal, medical but not "hospital blue"
  primary: '#14B8A6',
  primaryDark: '#0F766E',
  primaryLight: '#99F6E4',
  primarySoft: '#F0FDFA',

  // Accent — warm coral for alerts/highlights
  accent: '#F97316',
  accentLight: '#FED7AA',

  // Severity scale (0-4) — progressive
  severity0: '#94A3B8',  // none — neutral grey
  severity1: '#14B8A6',  // mild — teal
  severity2: '#FACC15',  // moderate — yellow
  severity3: '#F97316',  // strong — orange
  severity4: '#EF4444',  // severe — red

  // Surfaces
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceAccent: '#F0FDFA',

  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textTertiary: '#94A3B8',
  textOnPrimary: '#FFFFFF',

  // Borders / dividers
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  // Status
  success: '#14B8A6',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Mode identity colors (for ModeSelection cards)
  patientMode: '#14B8A6',
  doctorMode: '#6366F1',
  researcherMode: '#8B5CF6',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
};

export const typography = {
  display: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  h2: {
    fontSize: 20,
    fontWeight: '600',
  },
  h3: {
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500',
  },
  caption: {
    fontSize: 13,
    fontWeight: '400',
  },
  small: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  metric: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  metricLarge: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
};

export const shadows = {
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
};

// Severity helpers
export const severityColor = (sev) => {
  const map = {
    0: colors.severity0,
    1: colors.severity1,
    2: colors.severity2,
    3: colors.severity3,
    4: colors.severity4,
  };
  return map[sev] || colors.severity0;
};

export const severityLabel = (sev) => {
  return ['None', 'Mild', 'Moderate', 'Strong', 'Severe'][sev] || 'Unknown';
};

// Icon names (MaterialCommunityIcons) used across the app.
// Centralized so we never fall back to emoji accidentally.
export const icons = {
  // Navigation
  live: 'heart-pulse',
  history: 'history',
  pills: 'pill',
  settings: 'cog-outline',
  dashboard: 'view-dashboard-outline',
  patients: 'account-group-outline',
  research: 'flask-outline',

  // Actions
  connect: 'bluetooth',
  disconnect: 'bluetooth-off',
  scan: 'radar',
  play: 'play-circle',
  stop: 'stop-circle',
  record: 'record-circle',
  refresh: 'refresh',
  export: 'download-outline',
  share: 'share-variant',
  delete: 'trash-can-outline',
  edit: 'pencil-outline',
  add: 'plus',
  close: 'close',
  back: 'arrow-left',
  forward: 'chevron-right',

  // State
  check: 'check-circle',
  warning: 'alert-circle-outline',
  info: 'information-outline',
  error: 'alert-octagon-outline',

  // Domain
  tremor: 'pulse',
  amplitude: 'wave',
  duration: 'timer-outline',
  count: 'counter',
  severity: 'gauge',
  medication: 'pill',
  doctor: 'doctor',
  patient: 'account-circle-outline',
  researcher: 'microscope',
  lab: 'flask',

  // Misc
  notification: 'bell-outline',
  lock: 'lock-outline',
  unlock: 'lock-open-outline',
  chart: 'chart-line',
  table: 'table',
};

export default {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  severityColor,
  severityLabel,
  icons,
};
