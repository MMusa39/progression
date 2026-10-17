/** Create an account with an email address or phone number and a password. */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View, type TextInputInstance } from 'react-native';

import { Button, Divider, Screen, Text, TextField } from '@/components/ui';
import { env } from '@/config/env';
import * as cognito from '@/features/auth/cognito';
import { CognitoNotConfiguredNotice, FormError, GoogleButton, PasswordChecklist } from '@/features/auth/components';
import { authErrorMessage } from '@/features/auth/errors';
import { IdentifierField, useIdentifier } from '@/features/auth/IdentifierField';
import { pendingCredentials } from '@/features/auth/pendingCredentials';
import { isValidPassword } from '@/features/auth/validation';
import { space } from '@/theme/tokens';

export default function SignUpScreen() {
  const identifier = useIdentifier();
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordInput = useRef<TextInputInstance>(null);

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    const username = identifier.username;
    if (!username || !isValidPassword(password)) return;

    setLoading(true);
    try {
      const result = await cognito.signUp(username, password);
      pendingCredentials.set(username, password);
      router.push({
        pathname: '/confirm',
        params: { username, destination: result.delivery?.destination ?? username, purpose: 'signUp' },
      });
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen
      footer={
        <>
          <Button title="Create account" onPress={submit} loading={loading} disabled={!env.cognitoEnabled} />
          <Text variant="caption" color="textTertiary" align="center">
            By creating an account you agree to the Terms of Service and Privacy Policy.
          </Text>
        </>
      }>
      <View style={{ gap: space.xs, marginTop: space.xxxl }}>
        <Text variant="largeTitle">Create account</Text>
        <Text variant="callout" color="textSecondary">
          Use your email or phone number. We’ll send a code to verify it.
        </Text>
      </View>

      <CognitoNotConfiguredNotice />
      {error && <FormError message={error} />}

      <IdentifierField
        identifier={identifier}
        showError={submitted}
        purpose="signUp"
        onSubmitEditing={() => passwordInput.current?.focus()}
      />
      <View>
        <TextField
          ref={passwordInput}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          passwordRules="minlength: 8; required: lower; required: upper; required: digit;"
          returnKeyType="go"
          onSubmitEditing={submit}
          error={submitted && !isValidPassword(password) ? 'Password does not meet the requirements.' : null}
        />
        <PasswordChecklist password={password} />
      </View>

      {env.googleEnabled && (
        <>
          <Divider label="or" />
          <GoogleButton />
        </>
      )}
    </Screen>
  );
}
