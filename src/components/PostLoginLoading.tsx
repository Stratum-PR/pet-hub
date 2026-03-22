import { useEffect, useState } from 'react';
import { PawStagedLoadingFullscreen } from '@/components/PawStagedLoading';

interface PostLoginLoadingProps {
  onTimeout?: () => void;
  timeoutMs?: number;
}

export function PostLoginLoading({ onTimeout, timeoutMs = 10000 }: PostLoginLoadingProps) {
  const [timeoutReached, setTimeoutReached] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeoutReached(true);
      onTimeout?.();
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs, onTimeout]);

  return (
    <PawStagedLoadingFullscreen
      label={timeoutReached ? 'Still loading your workspace' : 'Loading your workspace'}
      zIndex={50}
    />
  );
}
