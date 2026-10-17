/** Sign in with email/phone + password, or Google. */
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInput } from 'react-native';

import { Button, Divider, Screen, Text, TextField } from '@/components/ui';
import { env } from '@/config/env';
import * as cognito from '@/features/auth/cognito';
import { CognitoNotConfiguredNotice, FormError, GoogleButton } from '@/features/auth/components';
import { authErrorMessage } from '@/features/auth/errors';
import { IdentifierField, useIdentifier } from '@/features/auth/IdentifierField';
import { pendingCredentials } from '@/features/auth/pendingCredentials';
import { authSession } from '@/features/auth/session';
import { space } from '@/theme/tokens';

export default function SignInScreen() {
  const { verified } = useLocalSearchParams<{ verified?: string }>();
  const identifier = useIdentifier();
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInput = useRef<TextInput>(null);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    const username = identifier.username;
    if (!username || !password) return;

    setLoading(true);
    try {
      await authSession.signIn(await cognito.signIn(username, password), 'password');
    } catch (e) {
      if (e instanceof cognito.CognitoError && e.code === 'UserNotConfirmedException') {
        // Signed up earlier but never entered the code: send a fresh one and resume verification.
        const delivery = await cognito.resendSignUpCode(username).catch(() => undefined);
        pendingCredentials.set(username, password);
        router.push({ pathname: '/confirm', params: { username, destination: delivery?.destination ?? username } });
      } else {
        setError(authErrorMessage(e));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen footer={<Button title="Sign in" onPress={submit} loading={loading} disabled={!env.cognitoEnabled} />}>
      <View style={{ gap: space.xs, marginTop: space.xxxl }}>
        <Text variant="largeTitle">Welcome back</Text>
        <Text variant="callout" color="textSecondary">
          {verified ? 'Your account is verified. Sign in to continue.' : 'Sign in to pick up where you left off.'}
        </Text>
      </View>

      <CognitoNotConfiguredNotice />
      {error && <FormError message={error} />}

      <IdentifierField
        identifier={identifier}
        showError={submitted}
        purpose="signIn"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <TextField
        ref={passwordInput}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        error={submitted && !password ? 'Enter your password.' : null}
      />
      <Button
        title="Forgot password?"
        variant="ghost"
        size="sm"
        fullWidth={false}
        onPress={() => router.push('/forgot-password')}
        style={{ alignSelf: 'flex-end', marginTop: -space.sm }}
      />

      {env.googleEnabled && (
        <>
          <Divider label="or" />
          <GoogleButton />
        </>
      )}
    </Screen>
  );
}
