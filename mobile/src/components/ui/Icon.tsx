import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { ColorName } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorName;
};

/** Ionicons drawn in a theme color. */
export function Icon({ name, size = 22, color = 'text' }: IconProps) {
  const { colors } = useTheme();
  return <Ionicons name={name} size={size} color={colors[color]} />;
}
