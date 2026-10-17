import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { hitTarget, radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon } from './Icon';
import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label: string;
  error?: string | null;
  hint?: string;
  /** Element rendered inside the field before the input (e.g. a country code). */
  prefix?: ReactNode;
};

/**
 * Labeled text input with error and hint text. Password fields
 * (`secureTextEntry`) get a show/hide toggle.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, hint, prefix, secureTextEntry, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error ? colors.danger : focused ? colors.accentText : colors.border;

  return (
    <View style={styles.container}>
      <Text variant="footnote" weight="600" color="textSecondary">
        {label}
      </Text>
      <View style={[styles.field, { backgroundColor: colors.inputBackground, borderColor }]}>
        {prefix}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accentText}
          secureTextEntry={secureTextEntry && !revealed}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, typography.body, { color: colors.text }, style]}
          accessibilityLabel={label}
          {...rest}
        />
        {secureTextEntry && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}>
            <Icon name={revealed ? 'eye-off-outline' : 'eye-outline'} size={20} color="textTertiary" />
          </Pressable>
        )}
      </View>
      {error ? (
        <Text variant="footnote" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: space.xs + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: hitTarget.large - 4,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  input: { flex: 1, paddingVertical: space.md },
});
