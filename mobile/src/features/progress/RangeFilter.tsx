/**
 * The time-range control that scopes every chart below it: one row of presets
 * (4W · 3M · 6M · 1Y · All) plus Custom, which opens a sheet for any
 * "last N weeks" or "last N months".
 */
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, SegmentedControl, Text } from '@/components/ui';
import { hitTarget, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { CUSTOM_LIMITS, PRESETS, rangeLabel, rangeStart, useProgressRange, type RangeUnit } from './range';

export function RangeFilter() {
  const { colors } = useTheme();
  const range = useProgressRange();
  const [customOpen, setCustomOpen] = useState(false);
  const start = rangeStart(range);
  // Icon-only until chosen, then the chosen length ("10W"), so the row fits a phone's width.
  const customLabel = range.preset === 'CUSTOM' ? `${range.customCount}${range.customUnit === 'weeks' ? 'W' : 'M'}` : null;

  return (
    <View style={styles.container}>
      <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]} accessibilityRole="tablist" accessibilityLabel="Time range">
        {PRESETS.map((preset) => (
          <Segment
            key={preset.value}
            label={preset.label}
            selected={range.preset === preset.value}
            onPress={() => range.setPreset(preset.value)}
            accessibilityLabel={rangeLabel({ ...range, preset: preset.value })}
          />
        ))}
        <Segment
          label={customLabel}
          icon="options-outline"
          selected={range.preset === 'CUSTOM'}
          onPress={() => setCustomOpen(true)}
          accessibilityLabel="Custom range"
        />
      </View>
      <Text variant="footnote" color="textSecondary">
        {rangeLabel(range)}
        {start ? ` · ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: start.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })} – today` : ''}
      </Text>
      <CustomRangeSheet visible={customOpen} onClose={() => setCustomOpen(false)} />
    </View>
  );
}

function Segment({ label, selected, onPress, icon, accessibilityLabel }: {
  label: string | null;
  selected: boolean;
  onPress: () => void;
  icon?: 'options-outline';
  accessibilityLabel: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.segment, selected && { backgroundColor: colors.surface }]}>
      {icon && !label && <Icon name={icon} size={18} color="textSecondary" />}
      {label && (
        <Text variant="subhead" weight={selected ? '700' : '500'} color={selected ? 'text' : 'textSecondary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function CustomRangeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const range = useProgressRange();
  const [count, setCount] = useState(range.customCount);
  const [unit, setUnit] = useState<RangeUnit>(range.customUnit);
  const max = CUSTOM_LIMITS[unit];
  const clamped = Math.min(count, max);

  const step = (delta: number) => {
    Haptics.selectionAsync();
    setCount((c) => Math.max(1, Math.min(max, c + delta)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg }]}>
        <Text variant="title2">Custom range</Text>
        <Text variant="subhead" color="textSecondary">
          Show progress over the last…
        </Text>
        <View style={styles.stepper}>
          <StepButton icon="remove" onPress={() => step(-1)} disabled={clamped <= 1} label="Fewer" />
          <View style={styles.countBox}>
            <Text variant="display" accessibilityLiveRegion="polite">
              {clamped}
            </Text>
            <Text variant="subhead" color="textSecondary">
              {clamped === 1 ? unit.slice(0, -1) : unit}
            </Text>
          </View>
          <StepButton icon="add" onPress={() => step(1)} disabled={clamped >= max} label="More" />
        </View>
        <SegmentedControl<RangeUnit>
          accessibilityLabel="Range unit"
          options={[
            { value: 'weeks', label: 'Weeks' },
            { value: 'months', label: 'Months' },
          ]}
          value={unit}
          onChange={setUnit}
        />
        <Button
          title={`Show last ${clamped} ${clamped === 1 ? unit.slice(0, -1) : unit}`}
          onPress={() => {
            range.setCustom(clamped, unit);
            onClose();
          }}
        />
      </View>
    </Modal>
  );
}

function StepButton({ icon, onPress, disabled, label }: { icon: 'add' | 'remove'; onPress: () => void; disabled: boolean; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.stepButton, { backgroundColor: colors.surfaceRaised, opacity: disabled ? 0.4 : 1 }]}>
      <Icon name={icon} size={26} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  track: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: radius.md - 3,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { padding: space.xl, gap: space.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepButton: { width: hitTarget.large, height: hitTarget.large, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  countBox: { alignItems: 'center' },
});
