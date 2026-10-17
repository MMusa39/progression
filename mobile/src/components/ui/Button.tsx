import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { hitTarget, radius, space, type ColorName } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  /** Custom leading element (e.g. a brand logo); takes precedence over `icon`. */
  leading?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const heights: Record<Size, number> = { lg: hitTarget.large, md: hitTarget.min + 4, sm: 36 };

/**
 * The app's button. Primary actions use the accent color and a large target,
 * and every press gives a light haptic tick, so taps register even with sweaty
 * hands or without looking.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  leading,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const background: Record<Variant, string> = {
    primary: colors.accent,
    secondary: colors.surfaceRaised,
    ghost: 'transparent',
    danger: colors.dangerMuted,
  };
  const foreground: Record<Variant, ColorName> = {
    primary: 'onAccent',
    secondary: 'text',
    ghost: 'accentText',
    danger: 'danger',
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: heights[size],
          backgroundColor: background[variant],
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'sm' ? space.md : space.xl,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors[foreground[variant]]} />
      ) : (
        <View style={styles.content}>
          {leading ?? (icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} color={foreground[variant]} />)}
          <Text variant={size === 'sm' ? 'subhead' : 'headline'} weight="700" color={foreground[variant]}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
});
