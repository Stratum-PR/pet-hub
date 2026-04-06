import { useEffect, useState } from 'react';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';

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
    <div
      className="pointer-events-none absolute inset-0 z-20 flex flex-col"
      aria-hidden="true"
    >
      <PawStagedLoadingArea
        label={timeoutReached ? 'Still loading your workspace' : 'Loading your workspace'}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
