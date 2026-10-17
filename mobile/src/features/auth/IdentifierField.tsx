/**
 * "Email or phone" input used by sign-up, sign-in and password reset:
 * a segmented switch plus the matching field, with a country-code prefix in
 * phone mode. `useIdentifier` holds the state and produces the Cognito
 * username (normalized email or E.164 phone), or null while it's invalid.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { SegmentedControl, Text, TextField } from '@/components/ui';
import { space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { isValidEmail, normalizeEmail, toE164 } from './validation';

export type IdentifierMode = 'email' | 'phone';

export function useIdentifier(initialMode: IdentifierMode = 'email') {
  const [mode, setMode] = useState<IdentifierMode>(initialMode);
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('1');
  const [phone, setPhone] = useState('');

  const username =
    mode === 'email' ? (isValidEmail(email) ? normalizeEmail(email) : null) : toE164(countryCode, phone);
  const isEmpty = mode === 'email' ? email.trim() === '' : phone.trim() === '';
  const invalidMessage = mode === 'email' ? 'Enter a valid email address.' : 'Enter a valid phone number.';

  return { mode, setMode, email, setEmail, countryCode, setCountryCode, phone, setPhone, username, isEmpty, invalidMessage };
}

type IdentifierFieldProps = {
  identifier: ReturnType<typeof useIdentifier>;
  /** Show the validation error (after the user tries to submit). */
  showError: boolean;
  onSubmitEditing?: () => void;
  /** iOS autofill hint: new accounts vs existing ones. */
  purpose: 'signUp' | 'signIn';
};

export function IdentifierField({ identifier, showError, onSubmitEditing, purpose }: IdentifierFieldProps) {
  const { colors } = useTheme();
  const error = showError && !identifier.username ? identifier.invalidMessage : null;

  return (
    <View style={styles.container}>
      <SegmentedControl
        accessibilityLabel="Sign in with"
        options={[
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Phone' },
        ]}
        value={identifier.mode}
        onChange={identifier.setMode}
      />
      {identifier.mode === 'email' ? (
        <TextField
          label="Email"
          value={identifier.email}
          onChangeText={identifier.setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType={purpose === 'signUp' ? 'emailAddress' : 'username'}
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          error={error}
        />
      ) : (
        <TextField
          label="Phone number"
          value={identifier.phone}
          onChangeText={identifier.setPhone}
          placeholder="(555) 123-4567"
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          returnKeyType="next"
          onSubmitEditing={onSubmitEditing}
          error={error}
          hint="We'll text you a verification code. Message and data rates may apply."
          prefix={
            <View style={[styles.prefix, { borderRightColor: colors.border }]}>
              <Text variant="body" color="textSecondary">
                +
              </Text>
              <TextInput
                value={identifier.countryCode}
                onChangeText={(text) => identifier.setCountryCode(text.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                accessibilityLabel="Country code"
                selectionColor={colors.accentText}
                style={[typography.body, styles.countryCode, { color: colors.text }]}
              />
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  prefix: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm, borderRightWidth: StyleSheet.hairlineWidth },
  countryCode: { minWidth: 28, paddingVertical: space.md },
});
