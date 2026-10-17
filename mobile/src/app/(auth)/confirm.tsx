/**
 * Enter the 6-digit code sent by email or SMS to verify a new account.
 * On success the user is signed in automatically with the password they just
 * chose (held in memory by `pendingCredentials`), or sent to sign-in if the app
 * was restarted in between.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, CodeInput, Screen, Text } from '@/components/ui';
import * as cognito from '@/features/auth/cognito';
import { FormError } from '@/features/auth/components';
import { authErrorMessage } from '@/features/auth/errors';
import { pendingCredentials } from '@/features/auth/pendingCredentials';
import { authSession } from '@/features/auth/session';
import { space } from '@/theme/tokens';

const RESEND_COOLDOWN_SECONDS = 30;

export default function ConfirmScreen() {
  const { username, destination } = useLocalSearchParams<{ username: string; destination: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verify = async (value = code) => {
    if (value.length !== 6 || loading) return;
    setError(null);
    setLoading(true);
    try {
      await cognito.confirmSignUp(username, value);
      const password = pendingCredentials.take(username);
      if (password) {
        // The auth guard swaps to the app as soon as the session is stored.
        await authSession.signIn(await cognito.signIn(username, password), 'password');
      } else {
        router.replace({ pathname: '/sign-in', params: { verified: '1' } });
      }
    } catch (e) {
      setError(authErrorMessage(e));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      const delivery = await cognito.resendSignUpCode(username);
      setNotice(`New code sent to ${delivery?.destination ?? destination}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <Screen footer={<Button title="Verify" onPress={() => verify()} loading={loading} disabled={code.length !== 6} />}>
      <View style={{ gap: space.xs, marginTop: space.xxxl }}>
        <Text variant="largeTitle">Check your {username?.startsWith('+') ? 'messages' : 'email'}</Text>
        <Text variant="callout" color="textSecondary">
          Enter the 6-digit code we sent to <Text variant="callout" weight="600">{destination}</Text>.
        </Text>
      </View>

      {error && <FormError message={error} />}

      <CodeInput
        value={code}
        onChange={(value) => {
          setCode(value);
          if (value.length === 6) verify(value); // submit as soon as the last digit is entered
        }}
        hasError={Boolean(error)}
      />

      {notice && (
        <Text variant="footnote" color="accentText">
          {notice}
        </Text>
      )}
      <Button
        title={cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        variant="ghost"
        size="sm"
        fullWidth={false}
        disabled={cooldown > 0}
        onPress={resend}
      />
    </Screen>
  );
}
