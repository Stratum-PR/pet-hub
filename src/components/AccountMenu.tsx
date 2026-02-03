import { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/auth';
import { signOut } from '@/lib/auth';
import { debugIngest } from '@/lib/debugIngest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { UserCircle, LogOut } from 'lucide-react';

interface AccountMenuProps {
  user: User;
  profile?: Profile | null;
}

function displayName(user: User, profile?: Profile | null): string {
  const fromProfile = profile?.full_name?.trim();
  if (fromProfile) return fromProfile;
  const fromMeta = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (fromMeta) return fromMeta;
  return user.email ?? 'Account';
}

function displayEmail(user: User, profile?: Profile | null): string {
  return user.email ?? profile?.email ?? '';
}

export function AccountMenu({ user, profile }: AccountMenuProps) {
  const name = displayName(user, profile);
  const email = displayEmail(user, profile);

  const handleLogout = () => {
    // #region agent log
    debugIngest({ location: 'AccountMenu.tsx:handleLogout', message: 'handleLogout called', hypothesisId: 'H1,H4' });
    // #endregion
    // Don't await: navigate away immediately so AuthContext's SIGNED_OUT re-render doesn't run
    // (that re-render can throw e.g. in ProtectedRoute/router). signOut() still runs in the background.
    debugIngest({ location: 'AccountMenu.tsx:handleLogout', message: 'calling signOut (no await)', hypothesisId: 'H1' });
    signOut();
    debugIngest({ location: 'AccountMenu.tsx:handleLogout', message: 'calling window.location.replace("/")', hypothesisId: 'H1,H4' });
    window.location.replace('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="My account">
          <UserCircle className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium leading-none">{name}</p>
            {email && (
              <p className="text-xs text-muted-foreground truncate" title={email}>
                {email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
