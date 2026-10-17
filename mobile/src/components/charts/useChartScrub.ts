import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import type { GestureResponderEvent, ViewProps } from 'react-native';

import { nearestIndex } from './scale';

/**
 * Touch-and-drag "scrubbing" for charts: the reader puts a finger anywhere on
 * the plot and the selection snaps to the nearest data point. Readers aim at a
 * date, not at a 2px line. A light haptic tick marks each new point.
 *
 * The chart claims the touch immediately, but releases it if the parent
 * ScrollView starts scrolling (`onResponderTerminationRequest`), so vertical
 * swipes over a chart still scroll the screen.
 *
 * Returns responder props to spread on a View covering the plot.
 *
 * @param positions x pixel position of each data point, ascending
 */
export function useChartScrub(positions: number[]) {
  const [active, setActive] = useState<number | null>(null);

  const select = (e: GestureResponderEvent) => {
    const index = nearestIndex(positions, e.nativeEvent.locationX);
    if (index >= 0 && index !== active) {
      setActive(index);
      Haptics.selectionAsync();
    }
  };
  const clear = () => setActive(null);

  const responderProps: ViewProps = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: select,
    onResponderMove: select,
    onResponderRelease: clear,
    onResponderTerminate: clear,
    onResponderTerminationRequest: () => true,
  };

  return { active, responderProps };
}
