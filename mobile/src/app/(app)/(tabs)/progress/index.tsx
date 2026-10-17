/** Progress tab. Charts and personal records arrive in Phase 3 (see docs/roadmap.md). */
import { ScrollView, StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui';
import { space } from '@/theme/tokens';

export default function ProgressScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <EmptyState
        icon="trending-up"
        title="Progress charts are coming"
        message="Estimated one-rep max, top sets, volume, and personal records for every lift. Keep logging and your history will be ready."
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.lg, flexGrow: 1 } });
