import { useStaff } from '@/hooks/useStaff';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function EmployeeProfile() {
  const { staffMember, loading } = useStaff();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!staffMember) {
    return <p className="text-muted-foreground">No se encontró tu ficha de personal.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">Información de tu registro en el negocio</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{staffMember.name}</CardTitle>
          <CardDescription>{staffMember.businesses?.name ?? 'Tu negocio'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium text-muted-foreground">Correo: </span>
            {staffMember.email || '—'}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">Teléfono: </span>
            {staffMember.phone || '—'}
          </p>
          <p>
            <span className="font-medium text-muted-foreground">Puesto: </span>
            {staffMember.role || '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
