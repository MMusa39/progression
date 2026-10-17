/** Privacy policy or terms of use, readable offline inside the app. */
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PRIVACY_POLICY, TERMS } from '@/features/legal/content';
import { space } from '@/theme/tokens';

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: 'privacy' | 'terms' }>();
  const content = doc === 'terms' ? TERMS : PRIVACY_POLICY;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: content.title }} />
      <Text variant="footnote" color="textTertiary">
        Last updated {content.updated}
      </Text>
      <Text variant="body">{content.intro}</Text>
      {content.sections.map((section) => (
        <View key={section.heading} style={{ gap: space.sm }}>
          <Text variant="headline">{section.heading}</Text>
          {section.body.map((paragraph, i) => (
            <Text key={i} variant="body" color="textSecondary">
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxxl } });
