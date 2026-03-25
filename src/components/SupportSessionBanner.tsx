import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/translations';
import { isSupportUserSessionActive, exitSupportUserSession } from '@/lib/supportSession';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function SupportSessionBanner() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(isSupportUserSessionActive());
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('support-session-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('support-session-changed', sync);
    };
  }, [user?.id]);

  if (!active) return null;

  return (
    <div
      className="px-4 py-2 flex items-center justify-between text-sm border-b-2"
      style={{
        backgroundColor: '#dbeafe',
        borderColor: '#2563eb',
        color: '#1e3a8a',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg shrink-0">🛠</span>
        <span className="font-semibold truncate">
          {t('layout.supportSessionBanner')}{' '}
          <span className="font-normal">{user?.email ?? '—'}</span>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto py-1 px-2 text-xs shrink-0"
        style={{ color: '#1e3a8a' }}
        onClick={() => {
          void (async () => {
            try {
              await exitSupportUserSession(supabase);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not restore admin session');
            }
          })();
        }}
      >
        <X className="w-4 h-4 mr-1" />
        {t('layout.supportExitSession')}
      </Button>
    </div>
  );
}
