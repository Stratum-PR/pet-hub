import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StaffMember } from '@/types';
import { employeeFullName } from '@/lib/employeeName';
import { useLanguage } from '@/contexts/LanguageContext';
import { t } from '@/lib/translations';

export interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: StaffMember | null;
  businessId: string | null;
  businessName: string | null;
  isSuperAdmin: boolean;
  onSent?: () => void;
}

export function InviteEmployeeDialog({
  open,
  onOpenChange,
  staffMember,
  businessId,
  businessName,
  isSuperAdmin,
  onSent,
}: InviteEmployeeDialogProps) {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && staffMember) {
      setEmail(staffMember.email?.trim() || '');
    }
  }, [open, staffMember?.id, staffMember?.email]);

  const effectiveEmail = (email || staffMember?.email || '').trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!staffMember?.id || !businessId) {
      toast.error(t('employeeInvite.errorMissingContext'));
      return;
    }
    const to = effectiveEmail;
    if (!to) {
      toast.error(t('employeeInvite.errorMissingEmail'));
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error(t('employeeInvite.errorSession'));
        setSending(false);
        return;
      }

      const body: Record<string, string> = {
        staff_id: staffMember.id,
        email: to,
        staff_member_name: employeeFullName(staffMember),
        business_name: businessName || '',
      };
      if (isSuperAdmin) {
        body.business_id = businessId;
      }

      const { data, error } = await supabase.functions.invoke('send-employee-invitation', {
        body,
        headers: { Authorization: `Bearer ${token}` },
        // Without this, a stuck Edge Function or Resend call can leave the UI on "Sending…" forever.
        timeout: 90_000,
      });

      let bodySnippet: string | undefined;
      const resp = error ? (error as { context?: Response }).context : undefined;
      if (resp && typeof resp.clone === 'function') {
        try {
          bodySnippet = (await resp.clone().text()).slice(0, 500);
        } catch {
          bodySnippet = '(could not read body)';
        }
      }

      if (error) {
        const errName = error instanceof Error ? error.name : '';
        const errMsg = error instanceof Error ? error.message : String(error);
        const aborted =
          errName === 'AbortError' ||
          errMsg.toLowerCase().includes('abort') ||
          errMsg.toLowerCase().includes('timed out');
        let toastMsg = aborted
          ? t('employeeInvite.errorTimeout')
          : errMsg || t('employeeInvite.errorSendFailed');
        if (bodySnippet) {
          try {
            const parsed = JSON.parse(bodySnippet) as { error?: string; detail?: string };
            if (typeof parsed.error === 'string' && parsed.error.trim()) {
              toastMsg = parsed.error;
            }
            if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
              toastMsg = `${toastMsg} — ${parsed.detail.trim()}`;
            }
          } catch {
            /* keep toastMsg */
          }
        }
        toast.error(toastMsg);
        setSending(false);
        return;
      }
      if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: string }).error === 'string') {
        toast.error((data as { error: string }).error);
        setSending(false);
        return;
      }

      toast.success(t('employeeInvite.successSent', { email: to }));
      onOpenChange(false);
      onSent?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('employeeInvite.errorGeneric');
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} data-language={language}>
          <DialogHeader>
            <DialogTitle>{t('employeeInvite.dialogTitle')}</DialogTitle>
            <DialogDescription asChild>
              <span className="text-sm text-muted-foreground">
                {staffMember ? (
                  <>
                    {t('employeeInvite.dialogDescriptionLead')}
                    <span className="font-medium text-foreground">{staffMember.name}</span>
                    {t('employeeInvite.dialogDescriptionTrail')}
                  </>
                ) : (
                  t('employeeInvite.dialogSelectStaff')
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">{t('employeeInvite.emailLabel')}</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('employeeInvite.emailPlaceholder')}
                autoComplete="email"
              />
            </div>
            {isSuperAdmin && !businessId ? (
              <p className="text-sm text-destructive">{t('employeeInvite.superAdminMissingBusiness')}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={sending || !staffMember}>
              {sending ? t('employeeInvite.sending') : t('employeeInvite.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
