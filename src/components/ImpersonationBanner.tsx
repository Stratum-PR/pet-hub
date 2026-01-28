import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exitImpersonation, getImpersonatingBusinessName } from '@/lib/auth';

export function ImpersonationBanner() {
  const businessName = getImpersonatingBusinessName();

  if (!businessName) return null;

  return (
    <div
      className="px-4 py-2 flex items-center justify-between text-sm"
      style={{
        backgroundColor: '#E6E09E',
        borderBottom: '2px solid #266AB2',
        color: '#1E2B7E',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">👁️</span>
        <span className="font-semibold">
          Client View: {businessName}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={exitImpersonation}
        className="h-auto py-1 px-2 text-xs"
        style={{ color: '#1E2B7E' }}
      >
        <X className="w-4 h-4 mr-1" />
        Exit Client View
      </Button>
    </div>
  );
}
