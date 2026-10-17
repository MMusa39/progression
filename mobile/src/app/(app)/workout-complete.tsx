/**
 * Shown right after Finish: a summary of the session and any personal records
 * it set. Records come from the server, which compares the workout against
 * the user's full history, so they appear once the upload completes. Offline,
 * the screen says so, and the records show up later in History.
 */
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, StatTile, Text } from '@/components/ui';
import { useWeightUnit, useWorkoutRecords } from '@/features/api/queries';
import { PersonalRecordList } from '@/features/progress/records';
import { formatDuration, formatVolumeCompact } from '@/features/workout/format';
import { useLastFinished } from '@/features/workout/lastFinished';
import { useWorkoutSync } from '@/features/workout/workoutSync';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function WorkoutCompleteScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useWeightUnit();
  const summary = useLastFinished((s) => (s.summary?.id === id ? s.summary : null));
  const pending = useWorkoutSync((s) => s.pending.some((p) => p.id === id));
  const syncing = useWorkoutSync((s) => s.syncing);
  const records = useWorkoutRecords(id, !pending);
  const recordCount = records.data?.length ?? 0;

  // Celebrate once, when records arrive.
  const celebrated = useRef(false);
  useEffect(() => {
    if (recordCount > 0 && !celebrated.current) {
      celebrated.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [recordCount]);

  const headerIcon = recordCount > 0 ? 'trophy' : 'checkmark';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xl }]}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: recordCount > 0 ? colors.surfaceRaised : colors.accent }]}>
            <Icon name={headerIcon} size={40} color={recordCount > 0 ? 'gold' : 'onAccent'} />
          </View>
          <Text variant="largeTitle" align="center">
            {recordCount > 0 ? `${recordCount} new PR${recordCount > 1 ? 's' : ''}!` : 'Workout complete'}
          </Text>
          {summary && (
            <Text variant="callout" color="textSecondary" align="center">
              {summary.name}
            </Text>
          )}
        </View>

        {summary && (
          <View style={styles.stats}>
            <StatTile label="Duration" value={formatDuration(summary.startedAt, summary.endedAt) ?? '—'} />
            <StatTile label="Sets" value={String(summary.sets)} />
            <StatTile label="Volume" value={formatVolumeCompact(summary.volumeKg, unit)} />
          </View>
        )}

        <View style={{ gap: space.md }}>
          <Text variant="title2">Personal records</Text>
          {pending ? (
            syncing ? (
              <Status spinner text="Saving your workout…" />
            ) : (
              <View style={{ gap: space.sm }}>
                <Status icon="cloud-offline-outline" text="Saved on your phone. It'll upload when you're back online, and your records will appear in History." />
                <Button title="Try again" variant="secondary" size="md" onPress={() => useWorkoutSync.getState().flush(queryClient)} />
              </View>
            )
          ) : records.isPending ? (
            <Status spinner text="Checking your history for records…" />
          ) : records.isError ? (
            <Status icon="alert-circle-outline" text="Couldn't check for records right now. They'll show in History." />
          ) : recordCount === 0 ? (
            <Status icon="barbell-outline" text="No new records this time. Consistent sessions like this are what build them." />
          ) : (
            <PersonalRecordList records={records.data!} unit={unit} />
          )}
        </View>

        {summary && summary.exercises.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Text variant="title2">Exercises</Text>
            {summary.exercises.map((e) => (
              <View key={e.name} style={[styles.exerciseRow, { borderBottomColor: colors.border }]}>
                <Text variant="body">{e.name}</Text>
                <Text variant="subhead" color="textSecondary">
                  {e.sets} set{e.sets === 1 ? '' : 's'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md, borderTopColor: colors.border }]}>
        <Button title="Done" onPress={() => router.back()} />
      </View>
    </View>
  );
}

function Status({ text, spinner, icon }: { text: string; spinner?: boolean; icon?: 'cloud-offline-outline' | 'alert-circle-outline' | 'barbell-outline' }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.status, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {spinner ? <ActivityIndicator /> : icon ? <Icon name={icon} size={20} color="textSecondary" /> : null}
      <Text variant="subhead" color="textSecondary" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: space.xl, gap: space.xl },
  header: { alignItems: 'center', gap: space.md },
  badge: { width: 88, height: 88, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: space.sm },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
