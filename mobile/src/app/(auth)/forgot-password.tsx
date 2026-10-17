/**
 * Password reset in two steps on one screen:
 *  1. Enter email/phone → Cognito sends a reset code.
 *  2. Enter the code and a new password → signed in with the new password.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { Button, CodeInput, Screen, Text, TextField } from '@/components/ui';
import { env } from '@/config/env';
import * as cognito from '@/features/auth/cognito';
import { CognitoNotConfiguredNotice, FormError, PasswordChecklist } from '@/features/auth/components';
import { authErrorMessage } from '@/features/auth/errors';
import { IdentifierField, useIdentifier } from '@/features/auth/IdentifierField';
import { authSession } from '@/features/auth/session';
import { isValidPassword } from '@/features/auth/validation';
import { space } from '@/theme/tokens';

export default function ForgotPasswordScreen() {
  const identifier = useIdentifier();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [destination, setDestination] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestCode = async () => {
    setSubmitted(true);
    setError(null);
    if (!identifier.username) return;
    setLoading(true);
    try {
      const delivery = await cognito.forgotPassword(identifier.username);
      setDestination(delivery?.destination ?? identifier.username);
      setSubmitted(false);
      setStep('reset');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setSubmitted(true);
    setError(null);
    const username = identifier.username;
    if (!username || code.length !== 6 || !isValidPassword(password)) return;
    setLoading(true);
    try {
      await cognito.confirmForgotPassword(username, code, password);
      await authSession.signIn(await cognito.signIn(username, password), 'password');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (step === 'request') {
    return (
      <Screen footer={<Button title="Send reset code" onPress={requestCode} loading={loading} disabled={!env.cognitoEnabled} />}>
        <View style={{ gap: space.xs, marginTop: space.xxxl }}>
          <Text variant="largeTitle">Reset password</Text>
          <Text variant="callout" color="textSecondary">
            Enter the email or phone number on your account and we’ll send you a code.
          </Text>
        </View>
        <CognitoNotConfiguredNotice />
        {error && <FormError message={error} />}
        <IdentifierField identifier={identifier} showError={submitted} purpose="signIn" onSubmitEditing={requestCode} />
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Set new password" onPress={resetPassword} loading={loading} />}>
      <View style={{ gap: space.xs, marginTop: space.xxxl }}>
        <Text variant="largeTitle">Choose a new password</Text>
        <Text variant="callout" color="textSecondary">
          Enter the code sent to <Text variant="callout" weight="600">{destination}</Text> and your new password.
        </Text>
      </View>
      {error && <FormError message={error} />}
      <CodeInput value={code} onChange={setCode} hasError={submitted && code.length !== 6} />
      <View>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          error={submitted && !isValidPassword(password) ? 'Password does not meet the requirements.' : null}
        />
        <PasswordChecklist password={password} />
      </View>
    </Screen>
  );
}
