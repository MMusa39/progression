import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { typography, type ColorName, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
  weight?: '400' | '500' | '600' | '700' | '800';
  align?: 'left' | 'center' | 'right';
};

/** Themed text. Pick a `variant` from the type scale instead of setting font sizes ad hoc. */
export function Text({ variant = 'body', color = 'text', weight, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      style={[
        typography[variant],
        { color: colors[color] },
        weight && { fontWeight: weight },
        align && { textAlign: align },
        style,
      ]}
      {...rest}
    />
  );
}
