/**
 * Welcome screen: the first thing a signed-out user sees. It offers every way
 * in: Google, email/phone sign-up, sign-in, and (in development) a one-tap dev account.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { Button, Divider, Icon, Screen, Text } from '@/components/ui';
import { env } from '@/config/env';
import { FormError, GoogleButton } from '@/features/auth/components';
import { signInWithDevAccount } from '@/features/auth/devAuth';
import { space } from '@/theme/tokens';

const highlights = [
  { icon: 'flash-outline', text: 'Log sets in seconds, even offline' },
  { icon: 'time-outline', text: "See last session's numbers as you lift" },
  { icon: 'trending-up-outline', text: 'Watch every lift progress over time' },
] as const;

export default function WelcomeScreen() {
  const [devLoading, setDevLoading] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);

  const useDevAccount = async () => {
    setDevError(null);
    setDevLoading(true);
    try {
      await signInWithDevAccount();
    } catch (e) {
      setDevError(e instanceof Error ? e.message : 'Dev sign-in failed');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <>
          <GoogleButton />
          <Button title="Create account" icon="person-add-outline" onPress={() => router.push('/sign-up')} />
          <Button title="I already have an account" variant="ghost" onPress={() => router.push('/sign-in')} />
          {env.devAuthEnabled && (
            <>
              <Divider label="development" />
              <Button
                title="Use development account"
                variant="secondary"
                icon="code-slash-outline"
                size="md"
                onPress={useDevAccount}
                loading={devLoading}
              />
              {devError && <FormError message={devError} />}
            </>
          )}
        </>
      }>
      <View style={styles.hero}>
        <Logo />
        <Text variant="largeTitle">
          Every rep,{'\n'}
          <Text variant="largeTitle" color="accentText">
            accounted for.
          </Text>
        </Text>
        <Text variant="callout" color="textSecondary">
          Progression replaces the notes-app workout log with something built for lifting.
        </Text>
      </View>
      <View style={styles.highlights}>
        {highlights.map((item) => (
          <View key={item.text} style={styles.highlight}>
            <Icon name={item.icon} size={20} color="accentText" />
            <Text variant="callout">{item.text}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: space.xxl },
  hero: { gap: space.lg },
  highlights: { gap: space.md },
  highlight: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
