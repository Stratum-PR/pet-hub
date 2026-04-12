import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/translations';
import { toast } from 'sonner';
import { devConsole } from '@/lib/clientDebug';
import {
  saveSupportAdminSnapshot,
  markSupportUserSessionActive,
  clearSupportAdminSnapshotOnly,
} from '@/lib/supportSession';
import type { StaffAccessRole } from '@/types';

type BusinessRow = { id: string; name: string; slug: string | null };
type StaffRow = {
  id: string;
  name: string;
  email: string;
  user_id: string | null;
  access_role: string;
  status: string;
};

const ACCESS_ROLES: StaffAccessRole[] = ['admin', 'manager', 'staff', 'contractor'];

async function formatEdgeFunctionError(err: unknown): Promise<string> {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(`Message: ${err.message}`);
    if (err.name) parts.push(`Name: ${err.name}`);
    if (err.stack) parts.push(`Stack:\n${err.stack}`);
  } else {
    try {
      parts.push(`Value: ${JSON.stringify(err)}`);
    } catch {
      parts.push(`Value: ${String(err)}`);
    }
  }
  const ctx = (err as { context?: Response })?.context;
  if (ctx && typeof ctx.clone === 'function') {
    try {
      const body = await ctx.clone().text();
      parts.push('');
      parts.push('--- Edge function response body ---');
      parts.push(body || '(empty body)');
    } catch (e) {
      parts.push(
        `(Could not read response body: ${e instanceof Error ? e.message : String(e)})`
      );
    }
  }
  return parts.join('\n');
}

function formatAuthError(err: unknown): string {
  if (err instanceof Error) {
    return `${err.message}${err.stack ? `\n\n${err.stack}` : ''}`;
  }
  return String(err);
}

interface SupportImpersonationDialogContentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportImpersonationDialogContent({ open, onOpenChange }: SupportImpersonationDialogContentProps) {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [loadingBiz, setLoadingBiz] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [starting, setStarting] = useState(false);

  const [businessOpen, setBusinessOpen] = useState(false);
  const [staffOpen, setStaffOpen] = useState(false);
  const [businessSearch, setBusinessSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');

  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [personaMode, setPersonaMode] = useState<'role' | 'user'>('user');
  /** null = any role (show all staff with linked login) */
  const [accessRoleFilter, setAccessRoleFilter] = useState<StaffAccessRole | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const selectedBusiness = useMemo(
    () => businesses.find((b) => b.id === selectedBusinessId) ?? null,
    [businesses, selectedBusinessId]
  );

  const staffWithLogin = useMemo(
    () => staff.filter((s) => s.user_id != null && String(s.user_id).length > 0),
    [staff]
  );

  const filteredStaffForPicker = useMemo(() => {
    if (personaMode === 'user') return staffWithLogin;
    if (accessRoleFilter === null) return staffWithLogin;
    return staffWithLogin.filter((s) => s.access_role === accessRoleFilter);
  }, [personaMode, staffWithLogin, accessRoleFilter]);

  useEffect(() => {
    if (open) setDiagnosticError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingBiz(true);
      const { data, error } = await supabase
        .from('businesses')
        .select('id,name,slug')
        .order('name');
      if (cancelled) return;
      setLoadingBiz(false);
      if (error) {
        devConsole.error('[SupportImpersonation] businesses list', error);
        toast.error(t('common.genericError'));
        setBusinesses([]);
        return;
      }
      setBusinesses((data ?? []) as BusinessRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedBusinessId) {
      setStaff([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingStaff(true);
      const { data, error } = await supabase
        .from('staff')
        .select('id,name,email,user_id,access_role,status')
        .eq('business_id', selectedBusinessId)
        .eq('status', 'active')
        .order('name');
      if (cancelled) return;
      setLoadingStaff(false);
      if (error) {
        devConsole.error('[SupportImpersonation] staff list', error);
        toast.error(t('common.genericError'));
        setStaff([]);
        return;
      }
      setStaff((data ?? []) as StaffRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, selectedBusinessId]);

  useEffect(() => {
    if (!selectedBusinessId) {
      setSelectedStaffId(null);
      return;
    }
    setSelectedStaffId(null);
  }, [selectedBusinessId, personaMode, accessRoleFilter]);

  const startSession = useCallback(async () => {
    if (!selectedBusinessId) {
      toast.error(t('layout.supportNeedBusiness'));
      return;
    }
    if (!selectedStaffId) {
      toast.error(t('layout.supportNeedStaff'));
      return;
    }
    const staffRow = filteredStaffForPicker.find((s) => s.id === selectedStaffId);
    if (!staffRow?.user_id) {
      toast.error(t('layout.supportNeedStaff'));
      return;
    }

    setStarting(true);
    setDiagnosticError(null);
    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData.session) {
        const msg = formatAuthError(sessErr ?? new Error('No session'));
        setDiagnosticError(msg);
        devConsole.error('[SupportImpersonation] getSession', sessErr);
        toast.error(t('common.genericError'));
        return;
      }

      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      const session = refreshed?.session ?? sessionData.session;
      if (refreshErr && !session?.access_token) {
        const msg = formatAuthError(refreshErr);
        setDiagnosticError(msg);
        devConsole.error('[SupportImpersonation] refreshSession', refreshErr);
        toast.error(t('common.genericError'));
        return;
      }

      saveSupportAdminSnapshot({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      const { data: fnData, error: fnErr } = await supabase.functions.invoke<{
        token_hash?: string;
        error?: string;
      }>('support-begin-user-session', {
        body: {
          target_staff_id: selectedStaffId,
          business_id: selectedBusinessId,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnErr) {
        clearSupportAdminSnapshotOnly();
        const detail = await formatEdgeFunctionError(fnErr);
        setDiagnosticError(detail);
        toast.error(t('layout.supportInvokeFailedShort'));
        return;
      }

      const tokenHash = fnData?.token_hash;
      if (!tokenHash) {
        clearSupportAdminSnapshotOnly();
        const fallback = JSON.stringify(fnData ?? {}, null, 2);
        setDiagnosticError(
          `No token_hash in response.\n\n--- Response JSON ---\n${fallback}`
        );
        toast.error(t('layout.supportInvokeFailedShort'));
        return;
      }

      const { error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
      });

      if (verifyErr) {
        clearSupportAdminSnapshotOnly();
        setDiagnosticError(formatAuthError(verifyErr));
        toast.error(t('layout.supportInvokeFailedShort'));
        return;
      }

      markSupportUserSessionActive();
      onOpenChange(false);
      const slug = selectedBusiness?.slug?.trim();
      if (slug) {
        window.location.href = `/${slug}/dashboard`;
      } else {
        window.location.href = '/';
      }
    } finally {
      setStarting(false);
    }
  }, [
    filteredStaffForPicker,
    onOpenChange,
    selectedBusiness?.slug,
    selectedBusinessId,
    selectedStaffId,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[min(90vh,540px)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('layout.supportDialogTitle')}</DialogTitle>
          <DialogDescription>{t('layout.supportDialogDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('layout.supportBusiness')}</Label>
            <Popover open={businessOpen} onOpenChange={setBusinessOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={loadingBiz}
                >
                  {loadingBiz ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </span>
                  ) : selectedBusiness ? (
                    selectedBusiness.name
                  ) : (
                    <span className="text-muted-foreground">{t('layout.supportPickBusiness')}</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t('layout.supportPickBusiness')}
                    value={businessSearch}
                    onValueChange={setBusinessSearch}
                  />
                  <CommandList>
                    <CommandEmpty>No business found.</CommandEmpty>
                    <CommandGroup>
                      {businesses
                        .filter((b) => {
                          if (!businessSearch) return true;
                          const q = businessSearch.toLowerCase();
                          return b.name.toLowerCase().includes(q);
                        })
                        .map((b) => {
                          const isSelected = b.id === selectedBusinessId;
                          return (
                            <CommandItem
                              key={b.id}
                              value={b.id}
                              onSelect={() => {
                                setSelectedBusinessId(b.id);
                                setBusinessOpen(false);
                                setBusinessSearch('');
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                              {b.name}
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>{t('layout.supportTestAsMode')}</Label>
            <ToggleGroup
              type="single"
              value={personaMode}
              onValueChange={(v) => {
                if (v !== 'role' && v !== 'user') return;
                setPersonaMode(v);
                if (v === 'role') setAccessRoleFilter(null);
              }}
              className="w-full justify-stretch rounded-md border p-1 bg-muted/40"
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="role" className="flex-1 text-xs">
                {t('layout.supportModeRole')}
              </ToggleGroupItem>
              <ToggleGroupItem value="user" className="flex-1 text-xs">
                {t('layout.supportModeUser')}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {personaMode === 'role' && (
            <div className="space-y-2">
              <Label>{t('layout.supportAccessRole')}</Label>
              <p className="text-xs text-muted-foreground">{t('layout.supportAccessRoleHint')}</p>
              <ToggleGroup
                type="single"
                value={accessRoleFilter ?? 'any'}
                onValueChange={(v) => {
                  if (v === 'any') setAccessRoleFilter(null);
                  else if (ACCESS_ROLES.includes(v as StaffAccessRole)) {
                    setAccessRoleFilter(v as StaffAccessRole);
                  }
                }}
                className="flex flex-wrap gap-1"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="any" className="text-xs px-2">
                  {t('layout.supportAccessRoleAny')}
                </ToggleGroupItem>
                {ACCESS_ROLES.map((r) => (
                  <ToggleGroupItem key={r} value={r} className="text-xs capitalize px-2">
                    {r}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('layout.supportPickStaff')}</Label>
            <Popover open={staffOpen} onOpenChange={setStaffOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal"
                  disabled={!selectedBusinessId || loadingStaff}
                >
                  {loadingStaff ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : selectedStaffId ? (
                    (() => {
                      const s = filteredStaffForPicker.find((x) => x.id === selectedStaffId);
                      if (!s) return '—';
                      return `${s.name}${s.email ? ` · ${s.email}` : ''}`;
                    })()
                  ) : (
                    <span className="text-muted-foreground">{t('layout.supportSearchStaff')}</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder={t('layout.supportSearchStaff')}
                    value={staffSearch}
                    onValueChange={setStaffSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {staffWithLogin.length === 0
                        ? t('layout.supportNoLinkedLogin')
                        : t('layout.supportStaffFilterEmpty')}
                    </CommandEmpty>
                    <CommandGroup>
                      {filteredStaffForPicker
                        .filter((s) => {
                          if (!staffSearch) return true;
                          const q = staffSearch.toLowerCase();
                          return (
                            s.name.toLowerCase().includes(q) ||
                            (s.email || '').toLowerCase().includes(q)
                          );
                        })
                        .map((s) => {
                          const isSelected = s.id === selectedStaffId;
                          const label = `${s.name}${s.email ? ` · ${s.email}` : ''}`;
                          return (
                            <CommandItem
                              key={s.id}
                              value={s.id}
                              onSelect={() => {
                                setSelectedStaffId(s.id);
                                setStaffOpen(false);
                                setStaffSearch('');
                              }}
                            >
                              <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">{label}</span>
                                <span className="text-[10px] text-muted-foreground capitalize">
                                  {s.access_role}
                                </span>
                              </div>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {diagnosticError ? (
          <div className="space-y-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-destructive">{t('layout.supportErrorDetails')}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  void navigator.clipboard.writeText(diagnosticError);
                  toast.success(t('layout.supportCopied'));
                }}
              >
                {t('layout.supportCopyDetails')}
              </Button>
            </div>
            <Textarea
              readOnly
              value={diagnosticError}
              className="min-h-[140px] resize-y font-mono text-xs select-all"
              onFocus={(e) => e.target.select()}
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={starting}>
            {t('logout.cancel')}
          </Button>
          <Button
            onClick={() => void startSession()}
            disabled={
              starting || !selectedBusinessId || !selectedStaffId || filteredStaffForPicker.length === 0
            }
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('layout.supportStartSession')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

