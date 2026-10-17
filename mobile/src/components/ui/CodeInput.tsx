import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { radius, space, typography } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Text } from './Text';

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  autoFocus?: boolean;
  hasError?: boolean;
};

/**
 * One-time-code entry shown as separate boxes. A single hidden TextInput
 * holds the value, so paste works, and `textContentType="oneTimeCode"` lets
 * iOS offer the code from Messages/Mail above the keyboard.
 */
export function CodeInput({ value, onChange, length = 6, autoFocus = true, hasError = false }: CodeInputProps) {
  const { colors } = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(autoFocus);

  return (
    <Pressable onPress={() => input.current?.focus()} accessibilityLabel="Verification code">
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? '';
          const active = focused && i === Math.min(value.length, length - 1);
          const borderColor = hasError ? colors.danger : active ? colors.accentText : colors.border;
          return (
            <View
              key={i}
              style={[styles.box, { backgroundColor: colors.inputBackground, borderColor }]}>
              <Text style={typography.title}>{char}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        maxLength={length}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  box: {
    flex: 1,
    aspectRatio: 0.85,
    maxWidth: 56,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
