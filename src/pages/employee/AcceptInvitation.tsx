import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

type InviteRow = {
  id: string;
  email: string;
  status: string;
  expires_at: string;
  business_id: string;
  business_name: string;
};

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [invitation, setInvitation] = useState<InviteRow | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setError('Enlace de invitación inválido. No se encontró el token.');
        setLoading(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('validate_staff_invite', {
          invite_token: token,
        });

        if (rpcError || !data?.length) {
          setError(
            'Invitación no encontrada o no válida. Verifica el enlace o contacta a tu administrador.',
          );
          setLoading(false);
          return;
        }

        const row = data[0] as InviteRow;
        setInvitation(row);
      } catch {
        setError('Error validando la invitación.');
      } finally {
        setLoading(false);
      }
    }

    void validateToken();
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) return;

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      };
      if (sessionData.session?.access_token) {
        headers.Authorization = `Bearer ${sessionData.session.access_token}`;
      }

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-employee-invitation`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, password }),
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'Error creando la cuenta');
      }

      if (payload?.error) {
        throw new Error(payload.error);
      }

      if (payload?.auto_login && payload?.session) {
        await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        setSuccess(true);
        setTimeout(() => navigate('/employee/hub'), 1800);
      } else {
        setSuccess(true);
        setTimeout(() => navigate('/login?message=account-created'), 2000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error creando la cuenta. Intenta de nuevo.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Validando invitación...</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="mx-auto mb-2 h-12 w-12 text-destructive" />
            <CardTitle>Invitación inválida</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="mx-auto mb-2 h-12 w-12 text-green-600" />
            <CardTitle>¡Cuenta creada!</CardTitle>
            <CardDescription>Redirigiendo...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Crear tu cuenta</CardTitle>
          <CardDescription>
            {invitation?.business_name
              ? `Te han invitado a unirte a ${invitation.business_name}`
              : 'Completa tu registro para acceder al portal de empleados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input id="email" type="email" value={invitation?.email || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">
                Este correo está vinculado a tu invitación y no puede cambiarse.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite tu contraseña"
                required
                minLength={8}
              />
            </div>

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Crear mi cuenta'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
