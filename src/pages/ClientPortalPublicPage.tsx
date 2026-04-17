import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { signOut } from '@/lib/auth';
import { getPublicBaseUrl } from '@/config/discoverable-routes';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Footer } from '@/components/Footer';
import { toast } from 'sonner';
import { fetchBusinessByPublicSlug } from '@/lib/businessSlug';
import { ClientForm } from '@/components/ClientForm';
import { PetForm } from '@/components/PetForm';
import type { BusinessClient, Pet } from '@/hooks/useBusinessData';
import { validateClientPayload } from '@/lib/businessValidation';
import { t } from '@/lib/translations';
import { devConsole } from '@/lib/clientDebug';
import type { Transaction, TransactionLineItem } from '@/types/transactions';

type Membership = { businessId: string; businessName: string; businessSlug: string };

type PortalClientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  notes: string | null;
  business_id: string | null;
};

type PortalPetRow = Pet & {
  breeds?: { id: string; name: string; species: string } | null;
};

type PortalAppointment = {
  id: string;
  appointment_date: string | null;
  start_time: string | null;
  status: string | null;
};

type TxRow = Transaction & { transaction_line_items?: TransactionLineItem[] | null };

function splitPortalClientName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toBusinessClient(row: PortalClientRow | null): BusinessClient | null {
  if (!row) return null;
  return {
    id: row.id,
    business_id: row.business_id ?? '',
    first_name: row.first_name ?? '',
    last_name: row.last_name ?? '',
    email: row.email,
    phone: row.phone ?? '',
    address: row.address,
    city: row.city,
    state: row.state,
    zip_code: row.zip_code,
    notes: row.notes,
    created_at: '',
    updated_at: '',
  };
}

export function ClientPortalPublicPage() {
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [bootstrapStarted, setBootstrapStarted] = useState(false);
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [editingPet, setEditingPet] = useState<PortalPetRow | null>(null);
  const [showPetForm, setShowPetForm] = useState(false);
  const [petToDelete, setPetToDelete] = useState<PortalPetRow | null>(null);
  const [deletingPet, setDeletingPet] = useState(false);

  useEffect(() => {
    if (!businessSlug) return;
    navigate(`/portal?business=${encodeURIComponent(businessSlug)}`, { replace: true });
  }, [businessSlug, navigate]);

  const selectedBusinessSlug = searchParams.get('business');
  const isAuthenticated = !!user?.id;
  const isClientRole = role === 'client';

  const { data: hintedBusiness } = useQuery({
    queryKey: ['portalHintBusinessBySlug', selectedBusinessSlug],
    enabled: !!selectedBusinessSlug,
    queryFn: async () => fetchBusinessByPublicSlug(supabase, selectedBusinessSlug!),
  });

  const { data: memberships = [] } = useQuery({
    queryKey: ['portalMemberships', user?.id],
    enabled: !!user?.id && isClientRole,
    queryFn: async (): Promise<Membership[]> => {
      const { data: linkRows, error: linksError } = await supabase
        .from('business_client_links')
        .select('business_id')
        .eq('user_id', user!.id)
        .eq('status', 'approved');
      if (linksError) throw linksError;
      const rows = (linkRows as { business_id: string }[] | null) ?? [];
      if (rows.length === 0) return [];
      const businessIds = [...new Set(rows.map((r) => r.business_id))];
      const { data: businesses, error: businessesError } = await supabase
        .from('businesses')
        .select('id, name, slug')
        .in('id', businessIds);
      if (businessesError) throw businessesError;
      const byId = new Map(
        ((businesses as { id: string; name: string | null; slug: string | null }[] | null) ?? []).map((b) => [b.id, b]),
      );
      return rows
        .map((row) => {
          const b = byId.get(row.business_id);
          if (!b?.slug) return null;
          return { businessId: b.id, businessName: b.name ?? 'Negocio', businessSlug: b.slug };
        })
        .filter((m): m is Membership => !!m);
    },
  });

  useEffect(() => {
    if (memberships.length === 0) {
      // Still allow URL hint (?business=slug) when the user has no business_client_links yet
      if (selectedBusinessSlug && hintedBusiness?.id) {
        setSelectedBusinessId(hintedBusiness.id);
      } else {
        setSelectedBusinessId(null);
      }
      return;
    }
    if (selectedBusinessId && memberships.some((m) => m.businessId === selectedBusinessId)) return;
    const fromSlug = selectedBusinessSlug ? memberships.find((m) => m.businessSlug === selectedBusinessSlug) : null;
    setSelectedBusinessId(fromSlug?.businessId ?? memberships[0].businessId);
  }, [memberships, selectedBusinessSlug, selectedBusinessId, hintedBusiness?.id]);

  const activeMembership = useMemo(
    () => memberships.find((m) => m.businessId === selectedBusinessId) ?? null,
    [memberships, selectedBusinessId],
  );
  const activeBusinessId = selectedBusinessId;
  const activeBusinessName = activeMembership?.businessName ?? hintedBusiness?.name ?? 'Todos tus negocios';

  const {
    data: client,
    isPending: clientPending,
    isSuccess: clientQuerySuccess,
    isError: clientQueryError,
    error: clientFetchError,
    refetch: refetchClient,
  } = useQuery({
    queryKey: ['portalClientByProfile', user?.id],
    enabled: !!user?.id && isClientRole,
    queryFn: async (): Promise<PortalClientRow | null> => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, email, address, city, state, zip_code, notes, business_id, profile_id')
        .eq('profile_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as PortalClientRow | null) ?? null;
    },
  });

  /** Business used for pets, locator context, and bootstrap insert — includes client.business_id as fallback. */
  const resolvedPortalBusinessId = useMemo(
    () =>
      selectedBusinessId ??
      memberships[0]?.businessId ??
      hintedBusiness?.id ??
      client?.business_id ??
      null,
    [selectedBusinessId, memberships, hintedBusiness?.id, client?.business_id],
  );

  const selectorOptions = useMemo(() => {
    const options = memberships.map((m) => ({
      value: m.businessId,
      label: m.businessName,
      slug: m.businessSlug,
    }));
    if (
      hintedBusiness?.id &&
      hintedBusiness?.slug &&
      !options.some((option) => option.value === hintedBusiness.id)
    ) {
      options.unshift({
        value: hintedBusiness.id,
        label: hintedBusiness.name ?? 'Negocio',
        slug: hintedBusiness.slug,
      });
    }
    return options;
  }, [hintedBusiness?.id, hintedBusiness?.name, hintedBusiness?.slug, memberships]);

  useEffect(() => {
    if (!selectedBusinessSlug) {
      setSelectedBusinessId(null);
      return;
    }
    const selectedFromSlug = selectorOptions.find((option) => option.slug === selectedBusinessSlug);
    setSelectedBusinessId(selectedFromSlug?.value ?? null);
  }, [selectedBusinessSlug, selectorOptions]);

  const fallbackEmail = user?.email ? user.email.toLowerCase() : user?.id ? `client-${user.id}@placeholder.local` : '';
  const fallbackName =
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split('@')[0]?.trim() ||
    'Cliente';

  const insertClientRow = useCallback(async (): Promise<PortalClientRow | null> => {
    if (!user?.id || !isClientRole) return null;
    const nameParts = splitPortalClientName(fallbackName || 'Cliente');
    const rowPayload = {
      profile_id: user.id,
      business_id: null as string | null,
      email: fallbackEmail,
      first_name: nameParts.firstName || 'Cliente',
      last_name: nameParts.lastName || '',
      phone: '',
    } as const;

    const { data, error } = await supabase
      .from('clients')
      .insert(rowPayload as never)
      .select('id, first_name, last_name, phone, email, address, city, state, zip_code, notes, business_id, profile_id')
      .maybeSingle();
    if (error) {
      const { data: retry } = await supabase
        .from('clients')
        .upsert(rowPayload as never, { onConflict: 'profile_id' })
        .select('id, first_name, last_name, phone, email, address, city, state, zip_code, notes, business_id, profile_id')
        .maybeSingle();
      if (retry) return retry as PortalClientRow;
      devConsole.error('[portal] insertClientRow', error);
      toast.error(t('common.genericError'));
      return null;
    }
    return (data as PortalClientRow | null) ?? null;
  }, [user?.id, isClientRole, fallbackEmail, fallbackName]);

  useEffect(() => {
    if (!isClientRole || !user?.id) return;
    if (!clientQuerySuccess || client) return;
    if (clientPending) return;
    if (bootstrapStarted) return;
    setBootstrapStarted(true);
    setBootstrapFailed(false);

    void (async () => {
      const row = await insertClientRow();
      if (row) {
        await queryClient.invalidateQueries({ queryKey: ['portalClientByProfile', user.id] });
        return;
      }
      setBootstrapFailed(true);
    })();
  }, [
    bootstrapStarted,
    client,
    clientPending,
    clientQuerySuccess,
    insertClientRow,
    isClientRole,
    queryClient,
    user?.id,
  ]);

  const businessClientModel = useMemo(() => toBusinessClient(client ?? null), [client]);

  const { data: pets = [] } = useQuery({
    queryKey: ['portalClientPets', client?.id],
    enabled: !!client?.id,
    queryFn: async (): Promise<PortalPetRow[]> => {
      const { data, error } = await supabase
        .from('pets')
        .select(
          `
          *,
          breeds:breed_id ( id, name, species )
        `,
        )
        .eq('client_id', client!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as PortalPetRow[] | null) ?? [];
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['portalClientAppointments', client?.id, activeBusinessId],
    enabled: !!client?.id,
    queryFn: async (): Promise<PortalAppointment[]> => {
      let query = supabase
        .from('appointments')
        .select('id, appointment_date, start_time, status')
        .eq('client_id', client!.id);
      if (activeBusinessId) query = query.eq('business_id', activeBusinessId);
      const { data, error } = await query.order('appointment_date', { ascending: true });
      if (error) throw error;
      return (data as PortalAppointment[] | null) ?? [];
    },
  });

  const txFilterBusinessId = activeBusinessId;

  const { data: purchaseRows = [] } = useQuery({
    queryKey: ['portalClientTransactions', client?.id, txFilterBusinessId],
    enabled: !!client?.id,
    queryFn: async (): Promise<TxRow[]> => {
      let q = supabase
        .from('transactions')
        .select(
          `
          *,
          transaction_line_items (*)
        `,
        )
        .eq('customer_id', client!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (txFilterBusinessId) q = q.eq('business_id', txFilterBusinessId);
      const { data, error } = await q;
      if (error) throw error;
      return (data as TxRow[] | null) ?? [];
    },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['portalPaymentMethods', user?.id],
    enabled: !!user?.id && isClientRole,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_payment_methods')
        .select('id, brand, last4, exp_month, exp_year, is_default')
        .eq('profile_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as { id: string; brand: string | null; last4: string | null; exp_month: number | null; exp_year: number | null; is_default: boolean }[]) ?? [];
    },
  });

  const { data: directoryPreview = [] } = useQuery({
    queryKey: ['portalDirectoryPreview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, phone, slug')
        .not('slug', 'is', null)
        .order('name', { ascending: true })
        .limit(6);
      if (error) throw error;
      return (data as { id: string; name: string | null; phone: string | null; slug: string | null }[]) ?? [];
    },
  });

  const { data: locatorBusiness } = useQuery({
    queryKey: ['portalLocatorBusiness', activeBusinessId ?? hintedBusiness?.id, selectedBusinessSlug],
    enabled: !!(activeBusinessId ?? hintedBusiness?.id) && isAuthenticated && isClientRole,
    queryFn: async () => {
      const id = activeBusinessId ?? hintedBusiness?.id;
      if (!id) return null;
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, phone, maps_embed_url, slug')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        name: string | null;
        phone: string | null;
        maps_embed_url: string | null;
        slug: string | null;
      } | null;
    },
  });

  const ensureClientId = async (): Promise<string | null> => {
    if (client?.id) return client.id;
    const row = await insertClientRow();
    if (row?.id) {
      await queryClient.invalidateQueries({ queryKey: ['portalClientByProfile', user?.id] });
      return row.id;
    }
    return null;
  };

  /** Optional: link profile to a business (QR / engagement); not required for pets or transactions. */
  const ensureBusinessClientLink = async (businessId: string) => {
    if (!user?.id) return;
    const { error } = await supabase.from('business_client_links').upsert(
      {
        user_id: user.id,
        business_id: businessId,
        status: 'approved',
      },
      { onConflict: 'user_id,business_id' },
    );
    if (error) devConsole.warn('[portal] business_client_links upsert', error);
    await queryClient.invalidateQueries({ queryKey: ['portalMemberships', user.id] });
  };

  const handleClientFormSubmit = async (
    data: Omit<BusinessClient, 'id' | 'created_at' | 'updated_at' | 'business_id'>,
  ) => {
    const v = validateClientPayload(data);
    if (!v.valid) {
      toast.error(v.error);
      return;
    }
    try {
      const clientId = await ensureClientId();
      if (!clientId) return;
      const { error } = await supabase
        .from('clients')
        .update({
          first_name: data.first_name.trim() || null,
          last_name: data.last_name.trim() || null,
          email: data.email?.trim() || null,
          phone: data.phone.trim(),
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          zip_code: data.zip_code?.trim() || null,
          notes: data.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id', clientId);
      if (error) throw error;
      if (resolvedPortalBusinessId) {
        await ensureBusinessClientLink(resolvedPortalBusinessId);
      }
      toast.success(t('common.saved'));
      await queryClient.invalidateQueries({ queryKey: ['portalClientByProfile', user?.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const mapEmbedSrc = (raw: string | null | undefined): string | null => {
    if (!raw?.trim()) return null;
    const s = raw.trim();
    if (s.includes('<iframe')) {
      const m = s.match(/src=["']([^"']+)["']/i);
      return m?.[1] ?? null;
    }
    return s;
  };

  const handlePetFormSubmit = async (raw: Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'business_id'>) => {
    if (!client?.id) {
      toast.error(t('portal.completeProfileFirst'));
      return;
    }
    const fd = raw as Omit<Pet, 'id' | 'created_at' | 'updated_at' | 'business_id'> & {
      breed_id?: string | null;
    };
    let breedLabel = '?';
    if (fd.breed_id) {
      const { data: br } = await supabase.from('breeds').select('name').eq('id', fd.breed_id).maybeSingle();
      breedLabel = (br as { name?: string } | null)?.name?.trim() || '?';
    }
    const vaccination_status = fd.vaccination_status ?? 'unknown';
    const basePayload = {
      client_id: client.id,
      business_id: null as string | null,
      name: fd.name,
      species: fd.species,
      breed: breedLabel,
      breed_id: fd.breed_id ?? null,
      birth_month: fd.birth_month ?? null,
      birth_year: fd.birth_year ?? null,
      weight: fd.weight ?? 0,
      notes: fd.notes ?? null,
      special_instructions: fd.special_instructions ?? null,
      vaccination_status,
      last_vaccination_date: fd.last_vaccination_date ?? null,
      photo_url: fd.photo_url ?? null,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingPet?.id) {
        const { error } = await supabase.from('pets').update(basePayload as never).eq('id', editingPet.id);
        if (error) throw error;
        toast.success(t('common.saved'));
      } else {
        const { error } = await supabase.from('pets').insert({
          ...basePayload,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
        } as never);
        if (error) throw error;
        toast.success(t('pets.saveSuccess'));
      }
      setShowPetForm(false);
      setEditingPet(null);
      await queryClient.invalidateQueries({ queryKey: ['portalClientPets', client.id] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/';
  };

  const confirmDeletePet = async () => {
    if (!petToDelete?.id || !client?.id) return;
    setDeletingPet(true);
    try {
      const { error } = await supabase.from('pets').delete().eq('id', petToDelete.id);
      if (error) throw error;
      toast.success(t('portal.removePetSuccess'));
      if (editingPet?.id === petToDelete.id) {
        setShowPetForm(false);
        setEditingPet(null);
      }
      setPetToDelete(null);
      await queryClient.invalidateQueries({ queryKey: ['portalClientPets', client.id] });
      await queryClient.invalidateQueries({ queryKey: ['portalClientAppointments', client.id] });
    } catch (e) {
      toast.error((e as Error).message || t('portal.removePetError'));
    } finally {
      setDeletingPet(false);
    }
  };

  const clientReady = !!client?.id && !clientPending;
  const canManagePets = clientReady;

  const portalPetClientList: BusinessClient[] = useMemo(() => {
    if (!businessClientModel) return [];
    return [businessClientModel];
  }, [businessClientModel]);

  const money = (cents: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      </div>
    );
  }

  if (!user?.id) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Helmet>
        <title>Portal de clientes | Grumi</title>
        <meta name="description" content="Portal global de clientes de Grumi." />
        <link rel="canonical" href={`${getPublicBaseUrl().replace(/\/$/, '')}/`} />
      </Helmet>
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <main className="flex flex-1 flex-col px-4 py-10 pt-16">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {isAuthenticated && !isClientRole && (
            <Card>
              <CardHeader>
                <CardTitle>Cuenta de personal</CardTitle>
                <CardDescription>
                  Esta sesion no es de cliente. Cierra sesion para entrar al portal cliente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={handleLogout}>
                  Cerrar sesion
                </Button>
              </CardContent>
            </Card>
          )}
          {isAuthenticated && isClientRole && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-semibold">{t('clientPlaceholder.title')}</h1>
                  <p className="text-sm text-muted-foreground">{activeBusinessName}</p>
                </div>
                <Button variant="outline" onClick={handleLogout}>
                  Cerrar sesion
                </Button>
              </div>

              <Card id="context-business">
                <CardHeader>
                  <CardTitle>Vista de citas</CardTitle>
                  <CardDescription>Por defecto mostramos todas tus citas en todos los negocios.</CardDescription>
                  {memberships.length > 1 && (
                    <p className="pt-2 text-sm text-muted-foreground">{t('portal.multiBusinessExplainer')}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <select
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    value={selectedBusinessId ?? '__all__'}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      if (nextId === '__all__') {
                        setSelectedBusinessId(null);
                        setSearchParams({}, { replace: true });
                        return;
                      }
                      setSelectedBusinessId(nextId);
                      const selected = selectorOptions.find((m) => m.value === nextId);
                      if (selected) setSearchParams({ business: selected.slug }, { replace: true });
                    }}
                  >
                    <option value="__all__">Todos mis negocios</option>
                    {selectorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {clientQueryError && (
                <Card>
                  <CardHeader>
                    <CardTitle>No se pudo cargar tu perfil</CardTitle>
                    <CardDescription>
                      {(clientFetchError as Error)?.message || 'Intenta de nuevo.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={() => void refetchClient()}>
                      Reintentar
                    </Button>
                    <Button
                      type="button"
                      onClick={async () => {
                        setBootstrapFailed(false);
                        const row = await insertClientRow();
                        if (row) await queryClient.invalidateQueries({ queryKey: ['portalClientByProfile', user?.id] });
                      }}
                    >
                      Crear perfil ahora
                    </Button>
                  </CardContent>
                </Card>
              )}

              {bootstrapFailed && !client && (
                <Card>
                  <CardHeader>
                    <CardTitle>Perfil pendiente</CardTitle>
                    <CardDescription>
                      Guarda tu informacion abajo o usa &quot;Crear perfil ahora&quot; para continuar.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              {clientPending && <p className="text-sm text-muted-foreground">Cargando tu perfil...</p>}

              <section id="my-information" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.myInformation')}</CardTitle>
                    <CardDescription>{t('form.editClient')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ClientForm
                      embedded
                      isEditing
                      titleOverride={null}
                      initialData={businessClientModel}
                      onSubmit={(data) => void handleClientFormSubmit(data)}
                    />
                  </CardContent>
                </Card>
              </section>

              <section id="my-pets" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.myPets')}</CardTitle>
                    {!clientReady && (
                      <CardDescription>{t('portal.completeProfileFirst')}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {!clientReady && (
                      <p className="text-sm text-muted-foreground">{t('portal.completeProfileFirst')}</p>
                    )}
                    {canManagePets && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {pets.map((p) => (
                            <Button
                              key={p.id}
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setEditingPet(p);
                                setShowPetForm(true);
                              }}
                            >
                              {p.name ?? 'Mascota'}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setEditingPet(null);
                              setShowPetForm(true);
                            }}
                          >
                            + Mascota
                          </Button>
                        </div>
                        {showPetForm && (
                          <PetForm
                            variant="portal"
                            portalBusinessId={null}
                            embedded
                            clients={portalPetClientList}
                            defaultClientId={client!.id}
                            initialData={editingPet}
                            isEditing={!!editingPet}
                            onCancel={() => {
                              setShowPetForm(false);
                              setEditingPet(null);
                            }}
                            onSubmit={(p) => void handlePetFormSubmit(p)}
                            onRequestRemove={
                              editingPet
                                ? () => {
                                    setPetToDelete(editingPet);
                                  }
                                : undefined
                            }
                          />
                        )}
                        <AlertDialog
                          open={!!petToDelete}
                          onOpenChange={(open) => {
                            if (!open && !deletingPet) setPetToDelete(null);
                          }}
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('portal.removePetTitle')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {petToDelete
                                  ? t('portal.removePetConfirm', {
                                      name: petToDelete.name?.trim() || '—',
                                    })
                                  : ''}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={deletingPet}>{t('common.cancel')}</AlertDialogCancel>
                              <Button
                                type="button"
                                variant="destructive"
                                disabled={deletingPet}
                                onClick={() => void confirmDeletePet()}
                              >
                                {deletingPet ? t('common.loading') : t('common.delete')}
                              </Button>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section id="my-appointments" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.appointments')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {!client?.id && !clientPending && (
                      <p className="text-sm text-muted-foreground">Las citas aparecen aqui cuando tu perfil este listo.</p>
                    )}
                    {client?.id && appointments.length === 0 && (
                      <p className="text-sm text-muted-foreground">No hay citas registradas.</p>
                    )}
                    {appointments.slice(0, 20).map((apt) => (
                      <p key={apt.id} className="text-sm">
                        {apt.appointment_date ?? '—'} {apt.start_time ?? ''} · {apt.status ?? '—'}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              </section>

              <section id="directory" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.directory')}</CardTitle>
                    <CardDescription>{t('portal.directoryCta')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {directoryPreview.map((b) => (
                        <div key={b.id} className="rounded-lg border border-border/60 p-3 text-sm">
                          <p className="font-medium">{b.name}</p>
                          <p className="text-muted-foreground">{b.phone || '—'}</p>
                          {b.slug && (
                            <Link
                              className="text-primary text-xs underline-offset-4 hover:underline"
                              to={`/portal?business=${encodeURIComponent(b.slug)}`}
                            >
                              Portal
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                    <Link to="/directorio">
                      <Button variant="outline" className="w-full sm:w-auto">
                        {t('portal.goToDirectory')}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </section>

              <section id="payments" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.payments')}</CardTitle>
                    <CardDescription>{t('portal.paymentsComingSoon')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {paymentMethods.length === 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
                          {t('portal.paymentsComingSoon')}
                        </div>
                        <div className="rounded-xl border border-dashed border-muted-foreground/30 p-6 text-center text-sm text-muted-foreground">
                          …
                        </div>
                      </div>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {paymentMethods.map((pm) => (
                          <li key={pm.id} className="rounded-md border px-3 py-2">
                            {(pm.brand ?? 'Card') + ' •••• ' + (pm.last4 ?? '****')}
                            {pm.is_default ? ' (default)' : ''}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button type="button" variant="secondary" disabled className="w-full sm:w-auto">
                      {t('clientPlaceholder.comingSoon')}
                    </Button>
                  </CardContent>
                </Card>
              </section>

              <section id="locator" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.locator')}</CardTitle>
                    <CardDescription>{locatorBusiness?.name ?? activeBusinessName}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {locatorBusiness?.phone && (
                      <p className="text-sm">
                        <span className="text-muted-foreground">Tel: </span>
                        {locatorBusiness.phone}
                      </p>
                    )}
                    {mapEmbedSrc(locatorBusiness?.maps_embed_url) ? (
                      <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-lg border">
                        <iframe
                          title="Map"
                          className="h-full w-full"
                          src={mapEmbedSrc(locatorBusiness?.maps_embed_url) ?? ''}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        El negocio aun no ha configurado el mapa.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section id="purchases" className="scroll-mt-24">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('portal.section.purchases')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {purchaseRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No hay compras registradas.</p>
                    ) : (
                      <ul className="space-y-4">
                        {purchaseRows.map((tx) => (
                          <li key={tx.id} className="rounded-lg border border-border/60 p-3 text-sm">
                            <div className="flex flex-wrap justify-between gap-2 font-medium">
                              <span>
                                {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'} · {tx.status}
                              </span>
                              <span>{money(tx.total)}</span>
                            </div>
                            {tx.transaction_line_items && tx.transaction_line_items.length > 0 && (
                              <ul className="mt-2 space-y-1 text-muted-foreground">
                                {tx.transaction_line_items.map((li) => (
                                  <li key={li.id}>
                                    {li.name} × {li.quantity} · {money(li.line_total)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
