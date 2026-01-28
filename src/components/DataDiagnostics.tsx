import { useEffect, useState } from 'react';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function DataDiagnostics() {
  const { profile } = useAuth();
  const businessId = useBusinessId();
  const [diagnostics, setDiagnostics] = useState<any>({
    profile: null,
    businessId: null,
    dataCounts: {},
    errors: [],
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const runDiagnostics = async () => {
      setLoading(true);
      const results: any = {
        profile: profile ? {
          email: profile.email,
          business_id: profile.business_id,
          is_super_admin: profile.is_super_admin,
        } : 'No profile',
        businessId: businessId || 'null',
        dataCounts: {},
        errors: [],
      };

      if (businessId) {
        // Test customers query
        try {
          const { data: customers, error: customersError } = await supabase
            .from('customers' as any)
            .select('*', { count: 'exact' })
            .eq('business_id', businessId);
          
          if (customersError) {
            results.errors.push({ table: 'customers', error: customersError });
          } else {
            results.dataCounts.customers = customers?.length || 0;
          }
        } catch (err: any) {
          results.errors.push({ table: 'customers', error: err.message });
        }

        // Test pets query
        try {
          const { data: pets, error: petsError } = await supabase
            .from('pets')
            .select('*', { count: 'exact' })
            .eq('business_id', businessId);
          
          if (petsError) {
            results.errors.push({ table: 'pets', error: petsError });
          } else {
            results.dataCounts.pets = pets?.length || 0;
          }
        } catch (err: any) {
          results.errors.push({ table: 'pets', error: err.message });
        }

        // Test services query
        try {
          const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('*', { count: 'exact' })
            .eq('business_id', businessId);
          
          if (servicesError) {
            results.errors.push({ table: 'services', error: servicesError });
          } else {
            results.dataCounts.services = services?.length || 0;
          }
        } catch (err: any) {
          results.errors.push({ table: 'services', error: err.message });
        }

        // Test appointments query
        try {
          const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select('*', { count: 'exact' })
            .eq('business_id', businessId);
          
          if (appointmentsError) {
            results.errors.push({ table: 'appointments', error: appointmentsError });
          } else {
            results.dataCounts.appointments = appointments?.length || 0;
          }
        } catch (err: any) {
          results.errors.push({ table: 'appointments', error: err.message });
        }
      }

      setDiagnostics(results);
      setLoading(false);
    };

    runDiagnostics();
  }, [profile, businessId]);

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Data Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground">
            Loading diagnostics…
          </div>
        )}
        <div>
          <h3 className="font-semibold mb-2">Profile Info</h3>
          <pre className="bg-muted p-2 rounded text-sm overflow-auto">
            {JSON.stringify(diagnostics.profile, null, 2)}
          </pre>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Business ID</h3>
          <Badge variant={businessId ? "default" : "destructive"}>
            {businessId || 'NULL'}
          </Badge>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Data Counts</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>Customers: <strong>{loading ? '…' : (diagnostics.dataCounts?.customers ?? 0)}</strong></div>
            <div>Pets: <strong>{loading ? '…' : (diagnostics.dataCounts?.pets ?? 0)}</strong></div>
            <div>Services: <strong>{loading ? '…' : (diagnostics.dataCounts?.services ?? 0)}</strong></div>
            <div>Appointments: <strong>{loading ? '…' : (diagnostics.dataCounts?.appointments ?? 0)}</strong></div>
          </div>
        </div>

        {diagnostics.errors && diagnostics.errors.length > 0 && (
          <div>
            <h3 className="font-semibold mb-2 text-destructive">Errors</h3>
            <pre className="bg-destructive/10 p-2 rounded text-sm overflow-auto">
              {JSON.stringify(diagnostics.errors, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
