import { useEffect, useState } from 'react';

import { Text, type TextProps } from '@/components/ui/Text';

import { formatElapsed } from '../format';

/** Live "12:34" since `since`, ticking every second. */
export function ElapsedTimer({ since, ...textProps }: { since: string } & TextProps) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  return <Text {...textProps}>{formatElapsed(now - new Date(since).getTime())}</Text>;
}
