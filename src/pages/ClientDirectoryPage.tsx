import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageMeta } from '@/components/PageMeta';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';

interface DirectoryBusiness {
  id: string;
  name: string;
  phone: string | null;
  slug: string | null;
}

const DIRECTORY_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/directorio') ?? {
  path: '/directorio',
  title: 'Directorio de negocios | Grumi',
  description: 'Explora negocios disponibles y abre su portal de clientes en Grumi.',
  indexable: false,
  noindex: true,
};

export function ClientDirectoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['clientDirectoryBusinesses'],
    queryFn: async (): Promise<DirectoryBusiness[]> => {
      const { data: rows, error } = await supabase
        .from('businesses')
        .select('id, name, phone, slug')
        .order('name', { ascending: true });
      if (error) throw error;
      return (rows ?? []) as DirectoryBusiness[];
    },
  });

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <PageMeta route={DIRECTORY_ROUTE} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Directorio</h1>
        <p className="text-muted-foreground">Encuentra negocios y accede al portal del cliente.</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando negocios...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(data ?? []).map((business) => (
              <Card key={business.id}>
                <CardHeader>
                  <CardTitle>{business.name}</CardTitle>
                  <CardDescription>{business.phone || 'Telefono no disponible'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {business.slug ? (
                    <Link className="text-sm text-primary underline-offset-4 hover:underline" to={`/portal?business=${encodeURIComponent(business.slug)}`}>
                      Ir al portal de este negocio
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">Este negocio aun no tiene portal publico.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
