import { useColorScheme } from 'react-native';

import { palettes, type Palette } from './tokens';

export type Theme = { scheme: 'light' | 'dark'; colors: Palette };

/** Current palette, following the system light/dark setting. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  return { scheme, colors: palettes[scheme] };
}
