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
      toast.error('Falta información del negocio o del empleado.');
      return;
    }
    const to = effectiveEmail;
    if (!to) {
      toast.error('Agrega un correo electrónico para la invitación.');
      return;
    }

    setSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error('Sesión expirada. Vuelve a iniciar sesión.');
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
        let toastMsg = error.message || 'No se pudo enviar la invitación';
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

      toast.success(`Invitación enviada a ${to}`);
      onOpenChange(false);
      onSent?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Enviar invitación al portal</DialogTitle>
            <DialogDescription>
              {staffMember ? (
                <>
                  Invitar a <span className="font-medium text-foreground">{staffMember.name}</span> a crear su cuenta
                  de empleado.
                </>
              ) : (
                'Selecciona un miembro del personal.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Correo electrónico</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
              />
            </div>
            {isSuperAdmin && !businessId ? (
              <p className="text-sm text-destructive">Falta business_id en este contexto.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={sending || !staffMember}>
              {sending ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
