/** UI pieces shared by the auth screens. */
import { StyleSheet, View } from 'react-native';

import { GoogleLogo } from '@/components/brand/GoogleLogo';
import { Button, Icon, Text } from '@/components/ui';
import { env } from '@/config/env';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { useGoogleSignIn } from './google';
import { passwordRules } from './validation';

/** "Continue with Google". Renders nothing when Google sign-in isn't configured for this build. */
export function GoogleButton() {
  if (!env.googleEnabled) return null;
  return <GoogleButtonInner />;
}

function GoogleButtonInner() {
  const { colors } = useTheme();
  const google = useGoogleSignIn();
  return (
    <View style={{ gap: space.sm }}>
      <Button
        title="Continue with Google"
        variant="secondary"
        leading={<GoogleLogo />}
        onPress={google.signIn}
        loading={google.loading}
        disabled={!google.ready}
        style={{ backgroundColor: colors.google }}
      />
      {google.error && <FormError message={google.error} />}
    </View>
  );
}

/** Live checklist of password requirements, ticking off as the user types. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <View style={styles.checklist}>
      {passwordRules.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.label} style={styles.rule}>
            <Icon name={met ? 'checkmark-circle' : 'ellipse-outline'} size={16} color={met ? 'accentText' : 'textTertiary'} />
            <Text variant="footnote" color={met ? 'text' : 'textTertiary'}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Error banner shown at the top or bottom of a form. */
export function FormError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.error, { backgroundColor: colors.dangerMuted }]}>
      <Icon name="alert-circle" size={18} color="danger" />
      <Text variant="subhead" color="danger" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}

/** Explains why the email/phone forms are disabled in a build without Cognito settings. */
export function CognitoNotConfiguredNotice() {
  const { colors } = useTheme();
  if (env.cognitoEnabled) return null;
  return (
    <View style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}>
      <Icon name="construct-outline" size={18} color="textSecondary" />
      <Text variant="footnote" color="textSecondary" style={{ flex: 1 }}>
        Account sign-up isn’t configured in this build yet. Set the EXPO_PUBLIC_COGNITO_* values in mobile/.env
        {env.devAuthEnabled ? ', or use the development account for now.' : '.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  checklist: { gap: space.xs + 2, paddingTop: space.xs },
  rule: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.md },
});
