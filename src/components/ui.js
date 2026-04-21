import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, spacing, radius, typography, shadows, severityColor, severityLabel } from '../theme';

// --- Card: the base surface for most content blocks ---
export const Card = ({ children, style, onPress, elevation = 'md', padding = spacing.lg }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      activeOpacity={0.75}
      onPress={onPress}
      style={[
        styles.card,
        shadows[elevation],
        { padding },
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
};

// --- StatTile: big metric + label, used in summary rows ---
export const StatTile = ({ value, label, color, icon, style }) => (
  <View style={[styles.statTile, style]}>
    {icon && (
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={color || colors.textTertiary}
        style={{ marginBottom: spacing.xs }}
      />
    )}
    <Text style={[typography.metric, { color: color || colors.textPrimary }]}>
      {value}
    </Text>
    <Text style={[typography.small, { color: colors.textSecondary, marginTop: 2 }]}>
      {label}
    </Text>
  </View>
);

// --- SectionHeader: consistent h2 with optional trailing action ---
export const SectionHeader = ({ title, action, actionLabel }) => (
  <View style={styles.sectionHeader}>
    <Text style={[typography.h2, { color: colors.textPrimary }]}>{title}</Text>
    {action && actionLabel && (
      <TouchableOpacity onPress={action}>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// --- Pill: small rounded status label ---
export const Pill = ({ label, color, icon }) => (
  <View style={[styles.pill, { backgroundColor: color + '22' }]}>
    {icon && <MaterialCommunityIcons name={icon} size={12} color={color} style={{ marginRight: 4 }} />}
    <Text style={{ color, fontWeight: '600', fontSize: 12 }}>{label}</Text>
  </View>
);

// --- SeverityPill: convenience wrapper for severity 0-4 ---
export const SeverityPill = ({ severity }) => (
  <Pill
    label={severityLabel(severity)}
    color={severityColor(severity)}
  />
);

// --- EmptyState: consistent empty screen ---
export const EmptyState = ({ icon, title, description, action, actionLabel }) => (
  <View style={styles.emptyState}>
    {icon && (
      <View style={styles.emptyIconWrap}>
        <MaterialCommunityIcons name={icon} size={42} color={colors.primary} />
      </View>
    )}
    <Text style={[typography.h2, { color: colors.textPrimary, marginTop: spacing.lg, textAlign: 'center' }]}>
      {title}
    </Text>
    {description && (
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm }]}>
        {description}
      </Text>
    )}
    {action && actionLabel && (
      <TouchableOpacity style={styles.emptyButton} onPress={action}>
        <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// --- IconCircle: round colored icon chip ---
export const IconCircle = ({ icon, color = colors.primary, size = 40, iconSize = 20, style }) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '1A',
        alignItems: 'center',
        justifyContent: 'center',
      },
      style,
    ]}
  >
    <MaterialCommunityIcons name={icon} size={iconSize} color={color} />
  </View>
);

// --- PrimaryButton / SecondaryButton: main CTAs ---
export const PrimaryButton = ({ label, onPress, icon, loading, disabled, style, color = colors.primary }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    style={[
      styles.primaryButton,
      { backgroundColor: disabled ? colors.borderStrong : color },
      style,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={colors.textOnPrimary} />
    ) : (
      <>
        {icon && (
          <MaterialCommunityIcons
            name={icon}
            size={18}
            color={colors.textOnPrimary}
            style={{ marginRight: 8 }}
          />
        )}
        <Text style={styles.primaryButtonText}>{label}</Text>
      </>
    )}
  </TouchableOpacity>
);

export const SecondaryButton = ({ label, onPress, icon, disabled, style, color = colors.primary }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.secondaryButton,
      { borderColor: disabled ? colors.border : color },
      style,
    ]}
  >
    {icon && (
      <MaterialCommunityIcons
        name={icon}
        size={18}
        color={disabled ? colors.textTertiary : color}
        style={{ marginRight: 8 }}
      />
    )}
    <Text style={[styles.secondaryButtonText, { color: disabled ? colors.textTertiary : color }]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// --- Divider ---
export const Divider = ({ style }) => (
  <View style={[{ height: 1, backgroundColor: colors.border }, style]} />
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  statTile: {
    flex: 1,
    alignItems: 'flex-start',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    minHeight: 48,
  },
  primaryButtonText: {
    color: colors.textOnPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    minHeight: 48,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});

export default {
  Card,
  StatTile,
  SectionHeader,
  Pill,
  SeverityPill,
  EmptyState,
  IconCircle,
  PrimaryButton,
  SecondaryButton,
  Divider,
};
