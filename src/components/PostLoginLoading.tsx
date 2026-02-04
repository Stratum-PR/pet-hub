import { useEffect, useState } from 'react';
import { Dog } from 'lucide-react';

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
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        {/* Pet-themed animated loading indicator */}
        <Dog className="w-16 h-16 text-primary animate-bounce" style={{ animationDuration: '1.5s' }} />
        
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold">Cargando tu información...</h2>
          <p className="text-muted-foreground">
            {timeoutReached 
              ? 'Cargando datos...' 
              : 'Preparando tu panel de control'}
          </p>
        </div>
      </div>
    </div>
  );
}
