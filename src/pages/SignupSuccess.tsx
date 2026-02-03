import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Mail } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export function SignupSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">¡Cuenta creada!</CardTitle>
          <CardDescription>
            Tu cuenta ha sido creada correctamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 mb-1">Revisa tu correo</p>
                <p className="text-sm text-blue-700">
                  Te hemos enviado un correo de confirmación con un enlace para activar tu cuenta.
                  Revisa tu bandeja de entrada y haz clic en el enlace para comenzar.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Una vez confirmes tu correo, podrás:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Acceder a tu panel de negocio</li>
              <li>Gestionar citas</li>
              <li>Añadir clientes y mascotas</li>
              <li>Configurar tus servicios</li>
            </ul>
          </div>

          <div className="pt-4">
            <Link to="/login">
              <Button className="w-full">
                Ir a iniciar sesión
              </Button>
            </Link>
          </div>

          {sessionId && (
            <p className="text-xs text-center text-muted-foreground">
              Session ID: {sessionId.substring(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
