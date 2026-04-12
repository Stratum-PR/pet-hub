import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useBusinessId } from '@/hooks/useBusinessId';
import { useAuth } from '@/contexts/AuthContext';
import { isDemoBrowseOnlyPath } from '@/hooks/useDemoBrowseOnly';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PawStagedLoadingArea } from '@/components/PawStagedLoading';
import { t } from '@/lib/translations';

import { DEMO_WORKSPACE_BUSINESS_ID } from '@/lib/demoWorkspace';
import { devConsole } from '@/lib/clientDebug';

export function DataDiagnostics() {
  const { profile, user, business } = useAuth();
  const { pathname } = useLocation();
  const isDemoPath = isDemoBrowseOnlyPath(pathname);
  const businessId = useBusinessId();
  const profileBusinessId = profile?.business_id ?? null;
  const businessIdMismatch =
    !!profileBusinessId && !!businessId && profileBusinessId !== businessId;
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
        demoWorkspace: null as {
          path: string;
          effectiveBusinessId: string | null;
          resolvedBusiness: { id: string; name: string; email: string | null } | null;
          hint: string;
        } | null,
        dataCounts: {},
        sampleData: {},
        relationships: {},
        errors: [],
        queryDetails: {},
      };

      if (isDemoPath) {
        let resolvedBusiness: { id: string; name: string; email: string | null } | null = null;
        const idForLookup = businessId || DEMO_WORKSPACE_BUSINESS_ID;
        const { data: bRow, error: bErr } = await supabase
          .from('businesses')
          .select('id, name, email')
          .eq('id', idForLookup)
          .maybeSingle();
        if (!bErr && bRow) {
          resolvedBusiness = {
            id: bRow.id,
            name: bRow.name,
            email: bRow.email ?? null,
          };
        }
        results.demoWorkspace = {
          path: pathname,
          effectiveBusinessId: businessId,
          resolvedBusiness,
          hint:
            'You are on the public demo URL. Queries use the shared demo business id. Your Supabase profile may still show business_id null — that only means your account is not permanently linked to this tenant. If counts stay at 0, this project may have no seeded demo rows yet.',
        };
      }

      if (businessId) {
        // Test clients query
        try {
          const startTime = performance.now();
          
          // CRITICAL: Always filter by business_id for proper multi-tenancy
          // Try query with business_id first, if it fails with 42703, try without filter to verify column exists
          let { data: clients, error: clientsError, count } = await supabase
            .from('clients')
            .select('*', { count: 'exact' })
            .neq('email', 'orphaned-pets@system.local')
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          const queryTime = performance.now() - startTime;
          
          // If error is about missing column, try a simple query to verify column exists
          if (clientsError?.code === '42703' && clientsError.message?.includes('business_id')) {
            devConsole.warn('[DataDiagnostics] business_id column error detected, verifying column existence...');
            // Try a simple query without business_id filter to see if table is accessible
            const { error: simpleError } = await supabase
              .from('clients')
              .select('id')
              .limit(1);
            
            if (!simpleError) {
              // Table is accessible, so the issue is specifically with business_id column
              // This likely means PostgREST schema cache needs to be refreshed
              results.errors.push({ 
                table: 'clients', 
                error: { 
                  code: '42703', 
                  message: `column clients.business_id does not exist in PostgREST schema cache. The column exists in the database but PostgREST needs to refresh its schema. This usually resolves automatically within a few minutes, or you can contact Supabase support to force a schema refresh.` 
                } 
              });
            } else {
              results.errors.push({ table: 'clients', error: clientsError });
            }
          } else if (clientsError) {
            // Log the full error for debugging
            devConsole.error('[DataDiagnostics] Clients query error:', {
              code: clientsError.code,
              message: clientsError.message,
              details: clientsError.details,
              hint: clientsError.hint,
              businessId,
              supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
            });
            results.errors.push({ table: 'clients', error: clientsError });
          } else {
            results.dataCounts.clients = count || 0;
            results.sampleData.clients = clients?.slice(0, 3).map((c: any) => ({
              id: c.id,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre',
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
          const { data: pets, error: petsError, count } = await supabase
            .from('pets')
            .select(selectQuery, { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          const queryTime = performance.now() - startTime;
          
          if (petsError) {
            // Check if error is about missing business_id column
            if (petsError.code === '42703' && petsError.message?.includes('business_id')) {
              // Verify if table is accessible without business_id filter
              const { error: simpleError } = await supabase
                .from('pets')
                .select('id')
                .limit(1);
              
              if (!simpleError) {
                results.errors.push({ 
                  table: 'pets', 
                  error: { 
                    code: '42703', 
                    message: 'column pets.business_id does not exist in PostgREST schema cache. The column exists in the database but PostgREST needs to refresh its schema. This usually resolves automatically within a few minutes.' 
                  } 
                });
              } else {
                results.errors.push({ table: 'pets', error: petsError });
              }
            }
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
          const { data: services, error: servicesError, count } = await supabase
            .from('services')
            .select('*', { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          const queryTime = performance.now() - startTime;
          
          if (servicesError) {
            // Check if error is about missing business_id column
            if (servicesError.code === '42703' && servicesError.message?.includes('business_id')) {
              // Verify if table is accessible without business_id filter
              const { error: simpleError } = await supabase
                .from('services')
                .select('id')
                .limit(1);
              
              if (!simpleError) {
                results.errors.push({ 
                  table: 'services', 
                  error: { 
                    code: '42703', 
                    message: 'column services.business_id does not exist in PostgREST schema cache. The column exists in the database but PostgREST needs to refresh its schema. This usually resolves automatically within a few minutes.' 
                  } 
                });
              } else {
                results.errors.push({ table: 'services', error: servicesError });
              }
            } else {
              results.errors.push({ table: 'services', error: servicesError });
            }
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
          const { data: appointments, error: appointmentsError, count } = await supabase
            .from('appointments')
            .select(selectQuery, { count: 'exact' })
            .eq('business_id', businessId)  // ALWAYS filter by business_id
            .limit(5);
          const queryTime = performance.now() - startTime;
          
          if (appointmentsError) {
            // Check if error is about missing business_id column
            if (appointmentsError.code === '42703' && appointmentsError.message?.includes('business_id')) {
              // Verify if table is accessible without business_id filter
              const { error: simpleError } = await supabase
                .from('appointments')
                .select('id')
                .limit(1);
              
              if (!simpleError) {
                results.errors.push({ 
                  table: 'appointments', 
                  error: { 
                    code: '42703', 
                    message: 'column appointments.business_id does not exist in PostgREST schema cache. The column exists in the database but PostgREST needs to refresh its schema. This usually resolves automatically within a few minutes.' 
                  } 
                });
              } else {
                results.errors.push({ table: 'appointments', error: appointmentsError });
              }
            }
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
                  client_name: a.client_id ? 'Linked (schema mismatch)' : 'No client',
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

        // Test transactions query (POS / revenue)
        try {
          const startTime = performance.now();
          const { data: txns, error: txError, count } = await supabase
            .from('transactions' as any)
            .select('id, status, total, payment_method, created_at, transaction_number', { count: 'exact' })
            .eq('business_id', businessId)
            .order('created_at', { ascending: false })
            .limit(5);
          const queryTime = performance.now() - startTime;

          if (txError) {
            results.errors.push({ table: 'transactions', error: txError });
          } else {
            results.dataCounts.transactions = count ?? 0;
            results.sampleData.transactions = (txns ?? []).map((row: any) => ({
              id: row.id,
              status: row.status,
              total_cents: row.total,
              payment_method: row.payment_method,
              created_at: row.created_at,
              transaction_number: row.transaction_number,
            }));
            results.queryDetails.transactions = {
              queryTime: `${queryTime.toFixed(2)}ms`,
              count: count ?? 0,
              returned: txns?.length ?? 0,
            };
          }
        } catch (err: any) {
          results.errors.push({ table: 'transactions', error: err.message });
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

        // Completed appointments with no linked transaction (appointment.transaction_id + transactions.appointment_id)
        try {
          const pageSize = 1000;
          const linkedAppointmentIds = new Set<string>();
          let txFrom = 0;
          for (;;) {
            const { data: txRows } = await supabase
              .from('transactions' as any)
              .select('appointment_id')
              .eq('business_id', businessId)
              .not('appointment_id', 'is', null)
              .range(txFrom, txFrom + pageSize - 1);
            const batch = txRows ?? [];
            for (const row of batch as { appointment_id?: string | null }[]) {
              if (row.appointment_id) linkedAppointmentIds.add(String(row.appointment_id));
            }
            if (batch.length < pageSize) break;
            txFrom += pageSize;
          }

          let withoutTransaction = 0;
          let apptFrom = 0;
          for (;;) {
            const { data: apptRows } = await supabase
              .from('appointments')
              .select('id, transaction_id')
              .eq('business_id', businessId)
              .eq('status', 'completed')
              .range(apptFrom, apptFrom + pageSize - 1);
            const batch = apptRows ?? [];
            for (const a of batch as { id: string; transaction_id?: string | null }[]) {
              const idStr = String(a.id);
              if (a.transaction_id) continue;
              if (linkedAppointmentIds.has(idStr)) continue;
              withoutTransaction += 1;
            }
            if (batch.length < pageSize) break;
            apptFrom += pageSize;
          }
          results.relationships.appointmentsWithoutTransaction = withoutTransaction;
        } catch (err: any) {
          results.relationships.appointmentsWithoutTransaction = null;
        }
      }

      setDiagnostics(results);
      setLoading(false);
    };

    runDiagnostics();
  }, [profile, businessId, user, business, pathname]);

  return (
    <Card className="m-4">
      <CardHeader>
        <CardTitle>Data Diagnostics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="relative min-h-[200px] py-4">
            <PawStagedLoadingArea label="Loading diagnostics" compact size="sm" />
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
                <strong>Supabase URL:</strong> <code className="text-xs bg-muted px-1 py-0.5 rounded">{import.meta.env.VITE_SUPABASE_URL || 'Not set'}</code>
              </div>
              <div>
                <strong>User:</strong>{' '}
                {diagnostics.user
                  ? isDemoPath
                    ? `${t('layout.demoUserName')} (${diagnostics.user.email})`
                    : `${diagnostics.user.email} (${diagnostics.user.id.substring(0, 8)}...)`
                  : 'Not logged in'}
              </div>
              {isDemoPath && (
                <p className="text-xs text-muted-foreground">{t('diagnostics.demoUserShownAs')}</p>
              )}
              <div>
                <strong>Profile:</strong> {diagnostics.profile ? (
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.profile, null, 2)}
                  </pre>
                ) : 'No profile'}
              </div>
              {diagnostics.demoWorkspace && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Demo route</strong>
                  <p className="mt-1">{diagnostics.demoWorkspace.hint}</p>
                  {diagnostics.demoWorkspace.resolvedBusiness && (
                    <p className="mt-2 text-xs">
                      <strong className="text-foreground">Resolved demo business:</strong>{' '}
                      {diagnostics.demoWorkspace.resolvedBusiness.name} (
                      {diagnostics.demoWorkspace.resolvedBusiness.id})
                    </p>
                  )}
                </div>
              )}
              <div>
                <strong>Business (from your session):</strong>{' '}
                {diagnostics.business ? (
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.business, null, 2)}
                  </pre>
                ) : (
                  <span className="text-muted-foreground">
                    No business on profile{isDemoPath ? ' — normal on /demo when you are not a member of the demo tenant' : ''}
                  </span>
                )}
              </div>
              <div>
                <strong>Business ID:</strong> <Badge variant={businessId ? "default" : "destructive"}>
                  {businessId || 'NULL'}
                </Badge>
              </div>
              {businessIdMismatch && (
                <div className="text-sm">
                  <Badge variant="destructive">Mismatch</Badge>
                  <span className="ml-2 text-muted-foreground">
                    Active route businessId does not match your profile.business_id. RLS will block inserts/updates for the active business.
                  </span>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <strong>profile.business_id:</strong> <code className="bg-muted px-1 py-0.5 rounded">{profileBusinessId}</code>{' '}
                    <strong>active businessId:</strong> <code className="bg-muted px-1 py-0.5 rounded">{businessId}</code>
                  </div>
                </div>
              )}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>Clients: <strong>{loading ? '…' : (diagnostics.dataCounts?.clients ?? 0)}</strong></div>
              <div>Pets: <strong>{loading ? '…' : (diagnostics.dataCounts?.pets ?? 0)}</strong></div>
              <div>Services: <strong>{loading ? '…' : (diagnostics.dataCounts?.services ?? 0)}</strong></div>
              <div>Appointments: <strong>{loading ? '…' : (diagnostics.dataCounts?.appointments ?? 0)}</strong></div>
              <div>Transactions: <strong>{loading ? '…' : (diagnostics.dataCounts?.transactions ?? 0)}</strong></div>
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
              {diagnostics.sampleData?.transactions && diagnostics.sampleData.transactions.length > 0 && (
                <div>
                  <strong>Transactions:</strong>
                  <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-auto">
                    {JSON.stringify(diagnostics.sampleData.transactions, null, 2)}
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
              <div>
                Completed appointments without transaction:{' '}
                <Badge
                  variant={
                    diagnostics.relationships?.appointmentsWithoutTransaction == null
                      ? 'secondary'
                      : diagnostics.relationships.appointmentsWithoutTransaction > 0
                        ? 'destructive'
                        : 'default'
                  }
                >
                  {diagnostics.relationships?.appointmentsWithoutTransaction == null
                    ? '—'
                    : diagnostics.relationships.appointmentsWithoutTransaction}
                </Badge>
              </div>
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
