import { useEffect, useState } from 'react';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function DataDiagnostics() {
  const { profile, user, business } = useAuth();
  const businessId = useBusinessId();
  const [diagnostics, setDiagnostics] = useState<any>({
    profile: null,
    businessId: null,
    dataCounts: {},
    sampleData: {},
    relationships: {},
    errors: [],
    queryDetails: {},
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    profile: true,
    dataCounts: true,
    sampleData: false,
    relationships: false,
    errors: true,
    queryDetails: false,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  useEffect(() => {
    const runDiagnostics = async () => {
      setLoading(true);
      const results: any = {
        profile: profile ? {
          id: profile.id,
          email: profile.email,
          business_id: profile.business_id,
          is_super_admin: profile.is_super_admin,
        } : null,
        user: user ? {
          id: user.id,
          email: user.email,
        } : null,
        business: business ? {
          id: business.id,
          name: business.name,
          email: business.email,
        } : null,
        businessId: businessId || 'null',
        dataCounts: {},
        sampleData: {},
        relationships: {},
        errors: [],
        queryDetails: {},
      };

      if (businessId) {
        // Test clients query
        try {
          const startTime = performance.now();
          
          // CRITICAL: Always filter by business_id for proper multi-tenancy
          let query = supabase
            .from('clients')
            .select('*', { count: 'exact' })
            .neq('email', 'orphaned-pets@system.local')
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          
          const { data: clients, error: clientsError, count } = await query;
          const queryTime = performance.now() - startTime;
          
          if (clientsError) {
            results.errors.push({ table: 'clients', error: clientsError });
          } else {
            results.dataCounts.clients = count || 0;
            results.sampleData.clients = clients?.slice(0, 3).map((c: any) => ({
              id: c.id,
              name: c.first_name && c.last_name 
                ? `${c.first_name} ${c.last_name}` 
                : c.name || 'Sin nombre',
              email: c.email,
              phone: c.phone,
            })) || [];
            results.queryDetails.clients = {
              queryTime: `${queryTime.toFixed(2)}ms`,
              count: count || 0,
              returned: clients?.length || 0,
            };
          }
        } catch (err: any) {
          results.errors.push({ table: 'clients', error: err.message });
        }

        // Test pets query
        try {
          const startTime = performance.now();
          // Try to join with clients, but handle if columns don't exist
          // NOTE: clients table has first_name and last_name, NOT name
          let selectQuery = '*';
          try {
            // Try the full join first - only use first_name and last_name
            selectQuery = '*, clients:client_id(id, first_name, last_name)';
          } catch (e) {
            // Fallback to basic query
            selectQuery = '*';
          }
          
          // CRITICAL: Always filter by business_id for proper multi-tenancy
          let query = supabase
            .from('pets')
            .select(selectQuery, { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          
          const { data: pets, error: petsError, count } = await query;
          const queryTime = performance.now() - startTime;
          
          if (petsError) {
            // If join failed, try without join
            if (petsError.message?.includes('first_name') || petsError.message?.includes('relationship')) {
              const { data: petsSimple, error: petsSimpleError, count: petsCount } = await supabase
                .from('pets')
                .select('*', { count: 'exact' })
                .eq('business_id', businessId)  // ALWAYS filter by business_id even in fallback
                .limit(5);
              
              if (!petsSimpleError) {
                results.dataCounts.pets = petsCount || 0;
                results.sampleData.pets = petsSimple?.slice(0, 3).map((p: any) => ({
                  id: p.id,
                  name: p.name,
                  breed: p.breed || 'N/A',
                  species: p.species,
                  client_id: p.client_id,
                  client_name: 'N/A (schema mismatch)',
                })) || [];
                results.queryDetails.pets = {
                  queryTime: `${queryTime.toFixed(2)}ms`,
                  count: petsCount || 0,
                  returned: petsSimple?.length || 0,
                };
              } else {
                results.errors.push({ table: 'pets', error: petsSimpleError });
              }
            } else {
              results.errors.push({ table: 'pets', error: petsError });
            }
          } else {
            results.dataCounts.pets = count || 0;
            results.sampleData.pets = pets?.slice(0, 3).map((p: any) => ({
              id: p.id,
              name: p.name,
              breed: p.breed || 'N/A',
              species: p.species,
              client_id: p.client_id,
              client_name: p.clients 
                ? (p.clients.first_name && p.clients.last_name 
                    ? `${p.clients.first_name} ${p.clients.last_name}` 
                    : 'Sin nombre')
                : 'No client',
            })) || [];
            results.queryDetails.pets = {
              queryTime: `${queryTime.toFixed(2)}ms`,
              count: count || 0,
              returned: pets?.length || 0,
            };
            // Check relationships
            const petsWithoutClient = pets?.filter((p: any) => !p.client_id || !p.clients).length || 0;
            results.relationships.petsWithoutClient = petsWithoutClient;
          }
        } catch (err: any) {
          results.errors.push({ table: 'pets', error: err.message });
        }

        // Test services query
        try {
          const startTime = performance.now();
          
          // CRITICAL: Always filter by business_id for proper multi-tenancy
          let query = supabase
            .from('services')
            .select('*', { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          
          const { data: services, error: servicesError, count } = await query;
          const queryTime = performance.now() - startTime;
          
          if (servicesError) {
            results.errors.push({ table: 'services', error: servicesError });
          } else {
            results.dataCounts.services = count || 0;
            results.sampleData.services = services?.slice(0, 3).map((s: any) => ({
              id: s.id,
              name: s.name,
              price: s.price,
              duration: s.duration_minutes,
            })) || [];
            results.queryDetails.services = {
              queryTime: `${queryTime.toFixed(2)}ms`,
              count: count || 0,
              returned: services?.length || 0,
            };
          }
        } catch (err: any) {
          results.errors.push({ table: 'services', error: err.message });
        }

        // Test appointments query
        try {
          const startTime = performance.now();
          // Try with joins first, fallback to simple query if relationships don't exist
          // NOTE: clients table has first_name and last_name, NOT name
          let selectQuery = '*';
          try {
            selectQuery = '*, pets:pet_id(id, name), clients:client_id(id, first_name, last_name)';
          } catch (e) {
            selectQuery = '*';
          }
          
          // CRITICAL: Always filter by business_id for proper multi-tenancy
          let query = supabase
            .from('appointments')
            .select(selectQuery, { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          
          const { data: appointments, error: appointmentsError, count } = await query;
          const queryTime = performance.now() - startTime;
          
          if (appointmentsError) {
            // If join failed, try without joins
            if (appointmentsError.message?.includes('relationship') || appointmentsError.message?.includes('client_id')) {
              const { data: appointmentsSimple, error: appointmentsSimpleError, count: appointmentsCount } = await supabase
                .from('appointments')
                .select('*', { count: 'exact' })
                .eq('business_id', businessId)  // ALWAYS filter by business_id even in fallback
                .limit(5);
              
              if (!appointmentsSimpleError) {
                results.dataCounts.appointments = appointmentsCount || 0;
                results.sampleData.appointments = appointmentsSimple?.slice(0, 3).map((a: any) => ({
                  id: a.id,
                  date: a.appointment_date || a.scheduled_date,
                  time: a.start_time || 'N/A',
                  pet_name: a.pet_id ? 'Linked (schema mismatch)' : 'No pet',
                  client_name: a.client_id || a.customer_id ? 'Linked (schema mismatch)' : 'No client',
                  status: a.status,
                })) || [];
                results.queryDetails.appointments = {
                  queryTime: `${queryTime.toFixed(2)}ms`,
                  count: appointmentsCount || 0,
                  returned: appointmentsSimple?.length || 0,
                };
              } else {
                results.errors.push({ table: 'appointments', error: appointmentsSimpleError });
              }
            } else {
              results.errors.push({ table: 'appointments', error: appointmentsError });
            }
          } else {
            results.dataCounts.appointments = count || 0;
            results.sampleData.appointments = appointments?.slice(0, 3).map((a: any) => ({
              id: a.id,
              date: a.appointment_date || a.scheduled_date,
              time: a.start_time || 'N/A',
              pet_name: a.pets?.name || 'No pet',
              client_name: a.clients 
                ? (a.clients.first_name && a.clients.last_name 
                    ? `${a.clients.first_name} ${a.clients.last_name}` 
                    : 'Sin nombre')
                : 'No client',
              status: a.status,
            })) || [];
            results.queryDetails.appointments = {
              queryTime: `${queryTime.toFixed(2)}ms`,
              count: count || 0,
              returned: appointments?.length || 0,
            };
            // Check relationships
            const appointmentsWithoutPet = appointments?.filter((a: any) => !a.pet_id || !a.pets).length || 0;
            const appointmentsWithoutClient = appointments?.filter((a: any) => !a.client_id || !a.clients).length || 0;
            results.relationships.appointmentsWithoutPet = appointmentsWithoutPet;
            results.relationships.appointmentsWithoutClient = appointmentsWithoutClient;
          }
        } catch (err: any) {
          results.errors.push({ table: 'appointments', error: err.message });
        }

        // Check foreign key relationships
        try {
          const { data: orphanedPets } = await supabase
            .from('pets')
            .select('id, name, client_id')
            .eq('business_id', businessId)
            .is('client_id', null);
          
          results.relationships.orphanedPets = orphanedPets?.length || 0;
        } catch (err: any) {
          // Ignore errors for relationship checks
        }
      }

      setDiagnostics(results);
      setLoading(false);
    };

    runDiagnostics();
  }, [profile, businessId, user, business]);

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

        {/* Profile Info */}
        <Collapsible open={expandedSections.profile} onOpenChange={() => toggleSection('profile')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2">
            <span>Profile & Auth Info</span>
            {expandedSections.profile ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2">
              <div>
                <strong>User:</strong> {diagnostics.user ? `${diagnostics.user.email} (${diagnostics.user.id.substring(0, 8)}...)` : 'Not logged in'}
              </div>
              <div>
                <strong>Profile:</strong> {diagnostics.profile ? (
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.profile, null, 2)}
                  </pre>
                ) : 'No profile'}
              </div>
              <div>
                <strong>Business:</strong> {diagnostics.business ? (
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.business, null, 2)}
                  </pre>
                ) : 'No business'}
              </div>
              <div>
                <strong>Business ID:</strong> <Badge variant={businessId ? "default" : "destructive"}>
                  {businessId || 'NULL'}
                </Badge>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Data Counts */}
        <Collapsible open={expandedSections.dataCounts} onOpenChange={() => toggleSection('dataCounts')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2">
            <span>Data Counts</span>
            {expandedSections.dataCounts ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-2 gap-2">
              <div>Clients: <strong>{loading ? '…' : (diagnostics.dataCounts?.clients ?? 0)}</strong></div>
              <div>Pets: <strong>{loading ? '…' : (diagnostics.dataCounts?.pets ?? 0)}</strong></div>
              <div>Services: <strong>{loading ? '…' : (diagnostics.dataCounts?.services ?? 0)}</strong></div>
              <div>Appointments: <strong>{loading ? '…' : (diagnostics.dataCounts?.appointments ?? 0)}</strong></div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Sample Data */}
        <Collapsible open={expandedSections.sampleData} onOpenChange={() => toggleSection('sampleData')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2">
            <span>Sample Data (First 3 Records)</span>
            {expandedSections.sampleData ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-3">
              {diagnostics.sampleData?.clients && diagnostics.sampleData.clients.length > 0 && (
                <div>
                  <strong>Clients:</strong>
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.sampleData.clients, null, 2)}
                  </pre>
                </div>
              )}
              {diagnostics.sampleData?.pets && diagnostics.sampleData.pets.length > 0 && (
                <div>
                  <strong>Pets:</strong>
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.sampleData.pets, null, 2)}
                  </pre>
                </div>
              )}
              {diagnostics.sampleData?.appointments && diagnostics.sampleData.appointments.length > 0 && (
                <div>
                  <strong>Appointments:</strong>
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.sampleData.appointments, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Relationships */}
        <Collapsible open={expandedSections.relationships} onOpenChange={() => toggleSection('relationships')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2">
            <span>Data Relationships & Integrity</span>
            {expandedSections.relationships ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-1 text-sm">
              <div>Orphaned Pets (no client): <Badge variant={diagnostics.relationships?.orphanedPets > 0 ? "destructive" : "default"}>{diagnostics.relationships?.orphanedPets ?? 0}</Badge></div>
              <div>Pets Without Client Link: <Badge variant={diagnostics.relationships?.petsWithoutClient > 0 ? "destructive" : "default"}>{diagnostics.relationships?.petsWithoutClient ?? 0}</Badge></div>
              <div>Appointments Without Pet: <Badge variant={diagnostics.relationships?.appointmentsWithoutPet > 0 ? "destructive" : "default"}>{diagnostics.relationships?.appointmentsWithoutPet ?? 0}</Badge></div>
              <div>Appointments Without Client: <Badge variant={diagnostics.relationships?.appointmentsWithoutClient > 0 ? "destructive" : "default"}>{diagnostics.relationships?.appointmentsWithoutClient ?? 0}</Badge></div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Query Details */}
        <Collapsible open={expandedSections.queryDetails} onOpenChange={() => toggleSection('queryDetails')}>
          <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2">
            <span>Query Performance</span>
            {expandedSections.queryDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto">
              {JSON.stringify(diagnostics.queryDetails, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>

        {/* Errors */}
        {diagnostics.errors && diagnostics.errors.length > 0 && (
          <Collapsible open={expandedSections.errors} onOpenChange={() => toggleSection('errors')}>
            <CollapsibleTrigger className="flex items-center justify-between w-full font-semibold mb-2 text-destructive">
              <span>Errors ({diagnostics.errors.length})</span>
              {expandedSections.errors ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <pre className="bg-destructive/10 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(diagnostics.errors, null, 2)}
              </pre>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
