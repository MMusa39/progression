/**
 * Plate calculator: which plates to load on each side for a target weight.
 * Opened from a barbell exercise in the logger, pre-filled with the weight
 * you're about to lift.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Screen, SegmentedControl, Text } from '@/components/ui';
import type { WeightUnit } from '@/features/api/types';
import { formatWeight, unitLabel } from '@/features/workout/format';
import { BARS, describePlates, loadBar } from '@/features/workout/plates';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

/** Plate heights by weight class, for the bar drawing (bigger plate, taller rectangle). */
const PLATE_HEIGHT: Record<string, number> = { 45: 120, 25: 120, 35: 104, 20: 120, 15: 104, 10: 84, 5: 64, 2.5: 50, 1.25: 40 };

export default function PlateCalculatorScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ weight?: string; unit?: WeightUnit }>();
  const unit: WeightUnit = params.unit === 'KG' ? 'KG' : 'LB';
  const [text, setText] = useState(params.weight ?? '');
  const [bar, setBar] = useState(BARS[unit][0]);

  const target = Number(text.replace(',', '.'));
  const load = target > 0 ? loadBar(target, bar, unit) : null;
  const u = unitLabel(unit);

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Plate Calculator', headerShown: true }} />
      <View style={styles.row}>
        <View style={[styles.box, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            autoFocus={!params.weight}
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel="Target weight"
            style={[styles.input, { color: colors.text }]}
          />
          <Text variant="title2" color="textSecondary">
            {u}
          </Text>
        </View>
      </View>

      <View style={{ gap: space.xs }}>
        <Text variant="footnote" weight="600" color="textSecondary">
          BAR
        </Text>
        <SegmentedControl<string>
          accessibilityLabel="Bar weight"
          options={BARS[unit].map((b) => ({ value: String(b), label: b === 0 ? 'No bar' : `${b} ${u}` }))}
          value={String(bar)}
          onChange={(v) => setBar(Number(v))}
        />
      </View>

      {load && (
        <View style={{ gap: space.lg }}>
          <View style={[styles.drawing, { backgroundColor: colors.surface, borderColor: colors.border }]} accessible accessibilityLabel={`Each side: ${describePlates(load.perSide)}`}>
            <View style={[styles.sleeve, { backgroundColor: colors.textTertiary }]} />
            {load.perSide.map((plate, i) => (
              <View
                key={i}
                style={[styles.plate, { height: PLATE_HEIGHT[String(plate)] ?? 60, backgroundColor: i % 2 === 0 ? colors.chart : colors.accent }]}>
                <Text style={[styles.plateLabel, { color: colors.onAccent }]}>{formatWeight(plate)}</Text>
              </View>
            ))}
            <View style={[styles.sleeveEnd, { backgroundColor: colors.textTertiary }]} />
          </View>

          <View style={{ gap: 2 }}>
            <Text variant="caption" color="textSecondary">
              EACH SIDE
            </Text>
            <Text variant="title2">{describePlates(load.perSide)}</Text>
          </View>
          {load.shortBy > 0 ? (
            <Text variant="callout" color="textSecondary">
              {formatWeight(target)} {u} can&apos;t be loaded exactly with standard plates. Closest: {formatWeight(load.loaded)} {u}.
            </Text>
          ) : (
            <Text variant="callout" color="textSecondary">
              Total {formatWeight(load.loaded)} {u}
              {bar > 0 ? ` (bar ${bar} + ${formatWeight((load.loaded - bar) / 2)} each side)` : ''}.
            </Text>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  box: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1.5, borderRadius: radius.lg, paddingHorizontal: space.xl, paddingVertical: space.md, width: '100%' },
  input: { flex: 1, minWidth: 0, fontSize: 44, fontWeight: '800' },
  drawing: { flexDirection: 'row', alignItems: 'center', height: 150, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, gap: 3 },
  sleeve: { width: 36, height: 14, borderRadius: 3 },
  sleeveEnd: { width: 22, height: 14, borderRadius: 3 },
  plate: { width: 24, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  plateLabel: { fontSize: 9, fontWeight: '800', transform: [{ rotate: '-90deg' }], width: 40, textAlign: 'center' },
});
