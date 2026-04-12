import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { t } from '@/lib/translations';
import { useAuth } from '@/contexts/AuthContext';
import { getDefaultRoute, setAuthContext, AUTH_CONTEXTS } from '@/lib/authRouting';
import { Footer } from '@/components/Footer';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Building2, Cat, Dog, Fish, PawPrint, PlusCircle, Sparkles, User, Users } from 'lucide-react';
import { PageMeta } from '@/components/PageMeta';
import { DISCOVERABLE_ROUTES } from '@/config/discoverable-routes';
import { ensureBusinessClientLink } from '@/lib/businessClientLink';
import { DEFAULT_BUSINESS_TIMEZONE } from '@/lib/businessTimezonePicker';
import { generateBusinessPortalQrSvg, resolvePortalBaseUrl } from '@/lib/qrCode';
import { fetchBusinessByPublicSlug } from '@/lib/businessSlug';
import { useThemedGrumiWordmarkSrc } from '@/hooks/useThemedGrumiWordmarkSrc';
import { devConsole, isClientDebugSurfacesEnabled } from '@/lib/clientDebug';

const REGISTER_ROUTE = DISCOVERABLE_ROUTES.find((r) => r.path === '/registrarse')!;

const PENDING_MANAGER_BUSINESS_NAME = 'pending_manager_business_name';
const PENDING_MANAGER_TIER = 'pending_manager_tier';

type SignupType = 'owner' | 'employee' | 'client';
/** Tiers offered at signup. Enterprise is not selectable (manual/VIP only). */
type SignupTier = 'basic' | 'growth' | 'pro';
type PetDraft = {
  id: string;
  name: string;
  species: 'dog' | 'cat' | 'other';
  breed_id: string;
  dob: string;
  weight: string;
  notes: string;
  vaccines: { id: string; type: string; date: string }[];
};
type PetSpeciesChoice = 'dogs' | 'cats' | 'other';

const makeEmptyPet = (species: PetDraft['species'] = 'dog'): PetDraft => ({
  id: crypto.randomUUID(),
  name: '',
  species,
  breed_id: '',
  dob: '',
  weight: '',
  notes: '',
  vaccines: [{ id: crypto.randomUUID(), type: '', date: '' }],
});

const PET_SPECIES_CHOICES: {
  id: PetSpeciesChoice;
  label: string;
  species: PetDraft['species'];
  icon: React.ComponentType;
}[] = [
  { id: 'dogs', label: 'dogs', species: 'dog', icon: Dog },
  { id: 'cats', label: 'cats', species: 'cat', icon: Cat },
  { id: 'other', label: 'other', species: 'other', icon: Fish },
];

type BreedOption = { id: string; name: string; species: 'dog' | 'cat' | 'other' };

function parseDobToBirthMonthYear(dob: string): { birthMonth: number | null; birthYear: number | null } {
  const trimmed = dob.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 1900) {
      return { birthMonth: month, birthYear: year };
    }
  }
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return { birthMonth: null, birthYear: null };
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(year) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    year < 1900
  ) {
    return { birthMonth: null, birthYear: null };
  }
  return { birthMonth: month, birthYear: year };
}

function latestVaccineDate(vaccines: { date: string }[]): string | null {
  const valid = vaccines.map((v) => v.date).filter(Boolean);
  if (!valid.length) return null;
  return valid.sort().at(-1) ?? null;
}

const SIGNUP_TIERS: { tier: SignupTier; nameKey: string; descKey: string; price: number }[] = [
  { tier: 'basic', nameKey: 'register.planBasic', descKey: 'register.planBasicDesc', price: 29 },
  { tier: 'growth', nameKey: 'register.planGrowth', descKey: 'register.planGrowthDesc', price: 79 },
  { tier: 'pro', nameKey: 'register.planPro', descKey: 'register.planProDesc', price: 199 },
];

export function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const themedGrumiWordmarkSrc = useThemedGrumiWordmarkSrc();
  const { refreshAuth } = useAuth();
  const [signupType, setSignupType] = useState<SignupType | null>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [selectedTier, setSelectedTier] = useState<SignupTier>('basic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [marketingEmailOptIn, setMarketingEmailOptIn] = useState(false);
  const [marketingSmsOptIn, setMarketingSmsOptIn] = useState(false);
  const [clientStep, setClientStep] = useState(1);
  const [step3SelectingKinds, setStep3SelectingKinds] = useState(true);
  const [selectedPetKinds, setSelectedPetKinds] = useState<PetSpeciesChoice[]>([]);
  const [activePetId, setActivePetId] = useState<string | null>(null);
  const [pets, setPets] = useState<PetDraft[]>([makeEmptyPet()]);
  const [breedOptions, setBreedOptions] = useState<BreedOption[]>([]);
  const [signupLogs, setSignupLogs] = useState<string[]>([]);
  const [showRetryAfterTimeout, setShowRetryAfterTimeout] = useState(false);
  /** When set, show "already registered" message with link to login (owner) or client portal (client). */
  const [alreadyRegisteredAs, setAlreadyRegisteredAs] = useState<'owner' | 'client' | null>(null);
  /** When true (business-scoped client + existing email), show account linking form: enter password to link. */
  const [showLinkingPage, setShowLinkingPage] = useState(false);
  const [linkPassword, setLinkPassword] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [businessSlug, setBusinessSlug] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [linkedBusinessName, setLinkedBusinessName] = useState<string | null>(null);

  const isOwner = signupType === 'owner';
  const isEmployee = signupType === 'employee';
  const isClient = signupType === 'client';
  useEffect(() => {
    const slug = searchParams.get('business');
    if (!slug) {
      setBusinessSlug(null);
      setBusinessId(null);
      setLinkedBusinessName(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      const business = await fetchBusinessByPublicSlug(supabase, slug);
      if (cancelled) return;
      setBusinessSlug(business?.slug ?? slug);
      setBusinessId(business?.id ?? null);
      setLinkedBusinessName(business?.name ?? slug);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const activePetIndex = pets.findIndex((p) => p.id === activePetId);
  const activePet = activePetIndex >= 0 ? pets[activePetIndex] : pets[0];

  useEffect(() => {
    const loadBreeds = async () => {
      const { data } = await supabase.from('breeds').select('id, name, species').order('name');
      const rows = ((data as BreedOption[] | null) ?? []).filter((r) =>
        r.species === 'dog' || r.species === 'cat' || r.species === 'other'
      );
      setBreedOptions(rows);
    };
    void loadBreeds();
  }, []);

  useEffect(() => {
    if (!pets.length) return;
    if (!activePetId || !pets.some((p) => p.id === activePetId)) {
      setActivePetId(pets[0].id);
    }
  }, [pets, activePetId]);

  const passwordMeetsComplexityRules = (value: string) =>
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value);

  const splitClientName = (value: string): { firstName: string; lastName: string } => {
    const parts = value.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  const addLog = (msg: string) => {
    devConsole.log('[Register]', msg);
    if (!isClientDebugSurfacesEnabled()) return;
    const time = new Date().toISOString().slice(11, 23);
    setSignupLogs((prev) => [...prev, `${time} ${msg}`]);
  };

  const handleCompleteManagerSignup = async (name: string, tier: SignupTier) => {
    const { error } = await supabase.rpc('complete_manager_signup', {
      p_business_name: name,
      p_subscription_tier: tier,
    });
    if (error) throw error;
  };

  const setDefaultBusinessTimezoneIfMissing = async (userId: string) => {
    const tz = DEFAULT_BUSINESS_TIMEZONE;

    // Find newly created business_id for this manager.
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', userId)
      .single();
    if (profileErr || !profileRow?.business_id) return;

    const businessId = profileRow.business_id as string;
    // Only set if missing so existing businesses aren't overwritten.
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('timezone')
      .eq('business_id', businessId)
      .maybeSingle();
    if (settingsRow?.timezone) return;

    await supabase
      .from('settings')
      .upsert({ business_id: businessId, timezone: tz }, { onConflict: 'business_id' });
  };

  const setDefaultBusinessQrIfMissing = async (userId: string) => {
    const { data: profileRow, error: profileErr } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('id', userId)
      .single();
    if (profileErr || !profileRow?.business_id) return;

    const currentBusinessId = profileRow.business_id as string;
    const { data: businessRow, error: bizErr } = await supabase
      .from('businesses')
      .select('slug, name, qr_code')
      .eq('id', currentBusinessId)
      .maybeSingle();
    if (bizErr || !businessRow?.slug || businessRow?.qr_code) return;

    const { data: settingsRow } = await supabase
      .from('settings')
      .select('primary_color, business_logo_url')
      .eq('business_id', currentBusinessId)
      .maybeSingle();

    const qrSvg = await generateBusinessPortalQrSvg(
      businessRow.slug,
      settingsRow?.primary_color ?? null,
      resolvePortalBaseUrl(window.location.origin),
      {
        businessName: businessRow.name ?? null,
        logoUrl: settingsRow?.business_logo_url ?? null,
      }
    );
    await supabase
      .from('businesses')
      .update({
        qr_code: qrSvg,
        qr_generated_at: new Date().toISOString(),
      })
      .eq('id', currentBusinessId)
      .is('qr_code', null);
  };

  const handleOwnerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSignupLogs([]);
    setAlreadyRegisteredAs(null);
    addLog('Owner signup started');
    try {
      localStorage.setItem(PENDING_MANAGER_BUSINESS_NAME, businessName);
      localStorage.setItem(PENDING_MANAGER_TIER, selectedTier);
      addLog('Data saved to localStorage');

      addLog('Calling supabase.auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      const errorDetail = error
        ? [error.message, error.code, (error as { status?: number }).status].filter(Boolean).join(' ') || JSON.stringify(error)
        : '';
      addLog(
        `signUp returned: session=${!!data?.session}, user=${!!data?.user}` +
          (error ? `, error=${errorDetail}` : '')
      );

      if (error) {
        localStorage.removeItem(PENDING_MANAGER_BUSINESS_NAME);
        localStorage.removeItem(PENDING_MANAGER_TIER);
        addLog(`signUp error: ${errorDetail}`);
        const isTimeout =
          (error as { status?: number }).status === 504 ||
          error.message?.toLowerCase().includes('timeout') ||
          error.message?.toLowerCase().includes('deadline');
        const isEmailRateLimit =
          (error as { status?: number }).status === 429 ||
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('over_email_send_rate_limit');
        const isServiceUnavailable =
          (error as { status?: number }).status === 503 ||
          error.message?.toLowerCase().includes('service unavailable') ||
          error.message?.toLowerCase().includes('server closed');
        if (error.message?.toLowerCase().includes('already registered') || error.code === 'user_already_exists') {
          setAlreadyRegisteredAs('owner');
          toast.error(t('register.errorEmailInUseOwner'));
          setShowRetryAfterTimeout(false);
        } else if (isServiceUnavailable) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor no está disponible (503). Espera unos segundos y usa "Reintentar" o intenta de nuevo más tarde.'
          );
        } else if (isEmailRateLimit) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'Límite de envío de correos alcanzado. Desactiva "Confirmar email" en Supabase (Authentication → Email) o espera unos minutos y usa "Reintentar".'
          );
        } else if (isTimeout || !error.message) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor tardó demasiado (timeout). No se creó la cuenta. Usa "Reintentar" abajo o intenta de nuevo más tarde.'
          );
        } else {
          setShowRetryAfterTimeout(false);
          toast.error(t('register.errorGeneric'));
        }
        return;
      }
      setShowRetryAfterTimeout(false);

      if (data.session) {
        addLog('Session present, waiting for profile...');
        await new Promise((r) => setTimeout(r, 500));
        addLog('Calling complete_manager_signup...');
        await handleCompleteManagerSignup(businessName, selectedTier);
        addLog('complete_manager_signup done');
        localStorage.removeItem(PENDING_MANAGER_BUSINESS_NAME);
        localStorage.removeItem(PENDING_MANAGER_TIER);
        addLog('Calling refreshAuth...');
        await refreshAuth();
        addLog('refreshAuth done');

        // Default business timezone on creation (business owner flow only).
        try {
          await setDefaultBusinessTimezoneIfMissing(data.session.user.id);
        } catch {
          // non-blocking
        }
        try {
          await setDefaultBusinessQrIfMissing(data.session.user.id);
        } catch {
          // non-blocking
        }

        setAuthContext(AUTH_CONTEXTS.BUSINESS);
        const route = getDefaultRoute({ isAdmin: false, business: null });
        addLog(`Redirecting to ${route}`);
        navigate(route, { replace: true });
        toast.success('Cuenta creada. Bienvenido a Grumi.');
      } else {
        addLog('No session (confirm email): showing "Check your email" screen');
        setEmailConfirmSent(true);
      }
    } catch (err: unknown) {
      addLog(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      toast.error(t('register.errorGeneric'));
    } finally {
      setLoading(false);
      addLog('Signup flow finished');
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordMeetsComplexityRules(password)) {
      toast.error('Usa 8+ caracteres con mayuscula, minuscula, numero y simbolo.');
      return;
    }
    setLoading(true);
    setSignupLogs([]);
    setAlreadyRegisteredAs(null);
    addLog('Client signup started');
    try {
      addLog('Calling supabase.auth.signUp...');
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || undefined },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      const clientErrorDetail = error
        ? [error.message, error.code, (error as { status?: number }).status].filter(Boolean).join(' ') || JSON.stringify(error)
        : '';
      addLog(
        `signUp returned: session=${!!data?.session}, user=${!!data?.user}` +
          (error ? `, error=${clientErrorDetail}` : '')
      );

      if (error) {
        addLog(`signUp error: ${clientErrorDetail}`);
        const isTimeout =
          (error as { status?: number }).status === 504 ||
          error.message?.toLowerCase().includes('timeout') ||
          error.message?.toLowerCase().includes('deadline');
        const isEmailRateLimit =
          (error as { status?: number }).status === 429 ||
          error.message?.toLowerCase().includes('rate limit') ||
          error.message?.toLowerCase().includes('over_email_send_rate_limit');
        const isServiceUnavailable =
          (error as { status?: number }).status === 503 ||
          error.message?.toLowerCase().includes('service unavailable') ||
          error.message?.toLowerCase().includes('server closed');
        if (error.message?.toLowerCase().includes('already registered') || error.code === 'user_already_exists') {
          setAlreadyRegisteredAs('client');
          if (businessSlug && businessId) {
            setShowLinkingPage(true);
            toast.info(t('register.linkAccountPrompt'));
          } else {
            toast.error(t('register.errorEmailInUseClient'));
          }
          setShowRetryAfterTimeout(false);
        } else if (isServiceUnavailable) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor no está disponible (503). Espera unos segundos y usa "Reintentar" o intenta de nuevo más tarde.'
          );
        } else if (isEmailRateLimit) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'Límite de envío de correos alcanzado. Desactiva "Confirmar email" en Supabase (Authentication → Email) o espera unos minutos y usa "Reintentar".'
          );
        } else if (isTimeout || !error.message) {
          setShowRetryAfterTimeout(true);
          toast.error(
            'El servidor tardó demasiado (timeout). No se creó la cuenta. Usa "Reintentar" abajo o intenta de nuevo más tarde.'
          );
        } else {
          setShowRetryAfterTimeout(false);
          toast.error(t('register.errorGeneric'));
        }
        return;
      }
      setShowRetryAfterTimeout(false);

      if (data.session) {
        addLog('Session present, refreshAuth and redirect');
        if (data.user) {
          const nameParts = splitClientName(fullName);
          let globalClientId: string | null = null;
          await supabase
            .from('profiles')
            .update({
              role: 'client',
              full_name: fullName || null,
            } as never)
            .eq('id', data.user.id);

          const clientPayload = {
            profile_id: data.user.id,
            business_id: null,
            name: fullName || null,
            first_name: nameParts.firstName || null,
            last_name: nameParts.lastName || null,
            email: email.trim().toLowerCase(),
            phone: phone || null,
            notes: clientNotes.trim() || null,
            marketing_email_opt_in: marketingEmailOptIn,
            marketing_sms_opt_in: marketingSmsOptIn,
          } as const;

          const { data: existingClient, error: existingClientErr } = await supabase
            .from('clients')
            .select('id')
            .eq('profile_id', data.user.id)
            .maybeSingle();
          if (existingClientErr) throw existingClientErr;

          if (existingClient?.id) {
            const { error: updateClientErr } = await supabase
              .from('clients')
              .update(clientPayload as never)
              .eq('id', existingClient.id);
            if (updateClientErr) throw updateClientErr;
            globalClientId = existingClient.id;
          } else {
            const { data: insertedClient, error: insertClientErr } = await supabase
              .from('clients')
              .insert({ id: crypto.randomUUID(), ...clientPayload } as never)
              .select('id')
              .single();
            if (insertClientErr) throw insertClientErr;
            globalClientId = (insertedClient as { id: string } | null)?.id ?? null;
          }

          if (!globalClientId) throw new Error('No se pudo crear el perfil global del cliente.');

          const petsToInsert = pets
            .filter((pet) => pet.name.trim())
            .map((pet) => {
              const dobParsed = parseDobToBirthMonthYear(pet.dob);
              const notesLines = [pet.notes.trim()];
              if (pet.dob.trim()) notesLines.push(`DOB: ${pet.dob.trim()}`);
              const vaccineNotes = pet.vaccines
                .filter((v) => v.type.trim() || v.date)
                .map((v) => `${v.type.trim() || 'Vacuna'}${v.date ? ` (${v.date})` : ''}`);
              if (vaccineNotes.length) notesLines.push(`Vaccines: ${vaccineNotes.join(', ')}`);
              return {
                id: crypto.randomUUID(),
                business_id: null,
                client_id: globalClientId,
                name: pet.name.trim(),
                species: pet.species,
                breed_id: pet.breed_id || null,
                breed: '—',
                birth_month: dobParsed.birthMonth,
                birth_year: dobParsed.birthYear,
                weight: Number(pet.weight || 0),
                notes: notesLines.filter(Boolean).join('\n') || null,
                last_vaccination_date: latestVaccineDate(pet.vaccines),
              };
            });
          if (petsToInsert.length > 0) {
            await supabase.from('pets').insert(petsToInsert as never);
          }
        }
        await refreshAuth();
        if (businessSlug && businessId && data.user) {
          try {
            await ensureBusinessClientLink(data.user.id, businessId, 'pet_owner');
            navigate(`/portal?business=${encodeURIComponent(businessSlug)}`, { replace: true });
            toast.success(t('register.linkedAndWelcome'));
            return;
          } catch (linkErr) {
            addLog(`Link create failed: ${(linkErr as Error)?.message}`);
          }
        }
        navigate('/portal', { replace: true });
        toast.success('Cuenta creada. Inicia sesión para continuar.');
      } else {
        addLog('No session (confirm email)');
        if (businessSlug) {
          try {
            await supabase.functions.invoke('send-client-confirmation', {
              body: {
                email: email.trim().toLowerCase(),
                business_slug: businessSlug,
                business_name: linkedBusinessName ?? businessSlug,
              },
            });
          } catch (err) {
            addLog(`send-client-confirmation failed: ${(err as Error)?.message}`);
          }
        }
        setEmailConfirmSent(true);
      }
    } catch (err: unknown) {
      addLog(`Exception: ${err instanceof Error ? err.message : String(err)}`);
      toast.error(t('register.errorGeneric'));
    } finally {
      setLoading(false);
      addLog('Signup flow finished');
    }
  };

  const handleLinkAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !linkPassword || !businessId || !businessSlug) return;
    setLinkLoading(true);
    try {
      const emailForLink = email.trim();
      const pw = linkPassword;
      const { data, error } = await supabase.auth.signInWithPassword({ email: emailForLink, password: pw });
      if (error) {
        if (error.message?.toLowerCase().includes('invalid') || error.message?.toLowerCase().includes('password')) {
          toast.error(t('register.linkIncorrectPassword'));
        } else {
          devConsole.error('[Register] link account signIn', error);
          toast.error(t('register.errorGeneric'));
        }
        setLinkLoading(false);
        return;
      }
      if (!data.user) {
        toast.error(t('register.errorGeneric'));
        setLinkLoading(false);
        return;
      }
      await ensureBusinessClientLink(data.user.id, businessId, 'pet_owner');
      await refreshAuth();
      toast.success(t('register.linkSuccess'));
      navigate(`/${businessSlug}/dashboard`, { replace: true });
    } catch (err) {
      toast.error(t('register.errorGeneric'));
    } finally {
      setLinkLoading(false);
    }
  };

  if (emailConfirmSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <PageMeta route={REGISTER_ROUTE} />
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>{t('register.checkEmail')}</CardTitle>
              <CardDescription>{t('register.checkEmailMessage')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/login">
                <Button variant="outline" className="w-full">{t('register.signInHere')}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  if (showLinkingPage && businessSlug && businessId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
        <PageMeta route={REGISTER_ROUTE} />
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>{t('register.linkAccountTitle')}</CardTitle>
              <CardDescription>
                {t('register.linkAccountDescription', { businessName: linkedBusinessName ?? businessSlug ?? 'este negocio' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleLinkAccountSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('login.email')}</Label>
                  <Input type="email" value={email} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="link-password">{t('login.password')}</Label>
                  <Input
                    id="link-password"
                    type="password"
                    value={linkPassword}
                    onChange={(e) => setLinkPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={linkLoading}>
                  {linkLoading ? t('register.creating') : t('register.linkAccountButton')}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground">
                {t('register.linkAccountPrivacy', { businessName: linkedBusinessName ?? businessSlug ?? 'este negocio' })}
              </p>
              <Link to="/login" className="block text-center text-sm text-primary hover:underline">
                {t('login.forgotPassword')}
              </Link>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/10 flex flex-col">
      <PageMeta route={REGISTER_ROUTE} />
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div
              className="flex justify-center mb-4 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <img
                src={themedGrumiWordmarkSrc}
                alt="Grumi"
                className="h-12 w-auto max-w-[min(240px,85vw)] object-contain object-center"
              />
            </div>
            <CardTitle className="text-2xl">{t('register.title')}</CardTitle>
            <CardDescription>{t('register.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {signupType === null && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">{t('register.userTypeQuestion')}</p>
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => { setSignupType('owner'); setAlreadyRegisteredAs(null); setStep(1); }}
                  >
                    <Building2 className="w-8 h-8" />
                    <span>{t('register.businessOwner')}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => { setSignupType('employee'); setAlreadyRegisteredAs(null); }}
                  >
                    <Users className="w-8 h-8" />
                    <span>Employee</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => {
                      setSignupType('client');
                      setAlreadyRegisteredAs(null);
                      setClientStep(1);
                      setStep3SelectingKinds(true);
                      setSelectedPetKinds([]);
                      const firstPet = makeEmptyPet();
                      setPets([firstPet]);
                      setActivePetId(firstPet.id);
                    }}
                  >
                    <User className="w-8 h-8" />
                    <span>{t('register.client')}</span>
                  </Button>
                </div>
              </div>
            )}

            {isEmployee && (
              <div className="space-y-4 rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Los empleados no se registran directamente. Tu negocio debe invitarte y luego puedes iniciar sesion.
                </p>
                <Link to="/login">
                  <Button className="w-full">Ir a iniciar sesion</Button>
                </Link>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setSignupType(null)}>
                  Elegir otro tipo de cuenta
                </Button>
              </div>
            )}

            {isClient && (
              <form onSubmit={handleClientSubmit} className="space-y-4">
                {clientStep === 1 && (
                  <>
                    <p className="text-sm text-muted-foreground text-center">Paso 1 de 3: Credenciales</p>
                    <div className="space-y-2">
                      <Label htmlFor="client-email">{t('login.email')}</Label>
                      <Input
                        id="client-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-password">{t('login.password')}</Label>
                      <Input
                        id="client-password"
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Usa 8+ caracteres con mayuscula, minuscula, numero y simbolo.</p>
                    <Button type="button" className="w-full" onClick={() => setClientStep(2)} disabled={!email || !password}>
                      {t('register.next')}
                    </Button>
                  </>
                )}

                {clientStep === 2 && (
                  <>
                    <p className="text-sm text-muted-foreground text-center">Paso 2 de 3: Tu informacion</p>
                    <div className="space-y-2">
                      <Label htmlFor="client-fullName">{t('register.fullName')}</Label>
                      <Input
                        id="client-fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Tu nombre"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-phone">Telefono</Label>
                      <Input
                        id="client-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="787-000-0000"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client-notes">Notas para el negocio (opcional)</Label>
                      <Textarea
                        id="client-notes"
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                        placeholder="Alergias, preferencia de contacto, etc."
                        rows={3}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={marketingEmailOptIn} onChange={(e) => setMarketingEmailOptIn(e.target.checked)} />
                      Acepto recibir emails de promociones
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={marketingSmsOptIn} onChange={(e) => setMarketingSmsOptIn(e.target.checked)} />
                      Acepto recibir SMS de promociones
                    </label>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setClientStep(1)}>
                        {t('register.back')}
                      </Button>
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => {
                          setStep3SelectingKinds(true);
                          setClientStep(3);
                          setActivePetId(pets[0]?.id ?? null);
                        }}
                        disabled={!fullName.trim()}
                      >
                        {t('register.next')}
                      </Button>
                    </div>
                  </>
                )}

                {clientStep === 3 && (
                  <>
                    <div className="overflow-hidden rounded-xl border border-primary/20">
                      <div className="bg-[#014b66] px-3 py-2 text-white">
                        <p className="text-xs font-semibold uppercase tracking-wide">progress</p>
                        <div className="mt-2 grid grid-cols-5 gap-2">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span
                              key={n}
                              className={`h-2 rounded-full ${n <= 2 ? 'bg-white' : 'bg-white/30'}`}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 bg-[#007bb6] px-3 py-2 text-white">
                        <PawPrint className="h-4 w-4" />
                        <p className="text-sm font-semibold">choose your pet</p>
                      </div>
                    </div>
                    {step3SelectingKinds ? (
                      <div className="space-y-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-accent/10 to-background p-4">
                        <div className="pt-1 text-center space-y-1">
                          <p className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                            Perfil de mascotas
                          </p>
                          <h3 className="text-2xl font-semibold">Who do you love?</h3>
                          <p className="text-sm text-muted-foreground">Elige tipo de mascota para comenzar.</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {PET_SPECIES_CHOICES.map((option) => {
                            const Icon = option.icon;
                            const isActive = selectedPetKinds.includes(option.id);
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`rounded-2xl border p-3 text-center transition ${
                                  isActive ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/50'
                                }`}
                                onClick={() =>
                                  setSelectedPetKinds((prev) =>
                                    prev.includes(option.id)
                                      ? prev.filter((item) => item !== option.id)
                                      : [...prev, option.id]
                                  )
                                }
                              >
                                <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-full border border-primary/20 bg-background">
                                  <Icon className="h-10 w-10 text-primary" />
                                </div>
                                <p className="text-sm font-medium">{option.label}</p>
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          variant="secondary"
                          onClick={() => {
                            const fromSelection = selectedPetKinds.map((kind) =>
                              makeEmptyPet(
                                PET_SPECIES_CHOICES.find((choice) => choice.id === kind)?.species ?? 'other'
                              )
                            );
                            const generated = fromSelection.length ? fromSelection : [makeEmptyPet()];
                            setPets(generated);
                            setActivePetId(generated[0].id);
                            setStep3SelectingKinds(false);
                          }}
                        >
                          confirm and continue
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                          <p className="mb-2 text-sm font-medium text-primary">Please select the pet you want groomed</p>
                          <div className="flex flex-wrap gap-3">
                            {pets.map((pet) => (
                              <button
                                key={pet.id}
                                type="button"
                                onClick={() => setActivePetId(pet.id)}
                                className={`rounded-xl border p-2 text-center transition ${
                                  activePet?.id === pet.id ? 'border-primary bg-primary/10' : 'border-border bg-background'
                                }`}
                              >
                                <div className="mx-auto mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-primary/25 bg-background">
                                  <PawPrint className="h-7 w-7 text-primary/80" />
                                </div>
                                <p className="text-xs font-medium">{pet.name.trim() || 'Pet'}</p>
                              </button>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-auto rounded-xl border-dashed py-2"
                              onClick={() =>
                                setPets((prev) => {
                                  const newPet = makeEmptyPet(activePet?.species || 'dog');
                                  setActivePetId(newPet.id);
                                  return [...prev, newPet];
                                })
                              }
                            >
                              <span className="flex flex-col items-center">
                                <PlusCircle className="mb-1 h-8 w-8" />
                                Add pet
                              </span>
                            </Button>
                          </div>
                        </div>
                        {activePet && (
                          <div className="rounded-md border p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <PawPrint className="h-4 w-4 text-primary" />
                              <p className="text-sm font-medium">Pet profile details</p>
                            </div>
                            <Input
                              placeholder="Nombre de mascota"
                              value={activePet.name}
                              onChange={(e) =>
                                setPets((prev) =>
                                  prev.map((p) => (p.id === activePet.id ? { ...p, name: e.target.value } : p))
                                )
                              }
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Select
                                value={activePet.species}
                                onValueChange={(value: 'dog' | 'cat' | 'other') =>
                                  setPets((prev) =>
                                    prev.map((p) =>
                                      p.id === activePet.id ? { ...p, species: value, breed_id: '' } : p
                                    )
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccionar especie" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="dog">Perro</SelectItem>
                                  <SelectItem value="cat">Gato</SelectItem>
                                  <SelectItem value="other">Otro</SelectItem>
                                </SelectContent>
                              </Select>
                              <Select
                                value={activePet.breed_id || '__none__'}
                                onValueChange={(value) =>
                                  setPets((prev) =>
                                    prev.map((p) =>
                                      p.id === activePet.id ? { ...p, breed_id: value === '__none__' ? '' : value } : p
                                    )
                                  )
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Raza" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Seleccionar raza</SelectItem>
                                  {breedOptions
                                    .filter((b) => b.species === activePet.species)
                                    .map((b) => (
                                      <SelectItem key={b.id} value={b.id}>
                                        {b.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                type="date"
                                value={activePet.dob}
                                onChange={(e) =>
                                  setPets((prev) =>
                                    prev.map((p) => (p.id === activePet.id ? { ...p, dob: e.target.value } : p))
                                  )
                                }
                              />
                              <Input
                                placeholder="Peso (lbs)"
                                value={activePet.weight}
                                onChange={(e) =>
                                  setPets((prev) =>
                                    prev.map((p) => (p.id === activePet.id ? { ...p, weight: e.target.value } : p))
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                              <p className="text-sm font-medium">Vaccines (like PetSmart style)</p>
                              {activePet.vaccines.map((vx) => (
                                <div key={vx.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                  <Input
                                    placeholder="Tipo de vacuna"
                                    value={vx.type}
                                    onChange={(e) =>
                                      setPets((prev) =>
                                        prev.map((p) =>
                                          p.id === activePet.id
                                            ? {
                                                ...p,
                                                vaccines: p.vaccines.map((row) =>
                                                  row.id === vx.id ? { ...row, type: e.target.value } : row
                                                ),
                                              }
                                            : p
                                        )
                                      )
                                    }
                                  />
                                  <Input
                                    type="date"
                                    value={vx.date}
                                    onChange={(e) =>
                                      setPets((prev) =>
                                        prev.map((p) =>
                                          p.id === activePet.id
                                            ? {
                                                ...p,
                                                vaccines: p.vaccines.map((row) =>
                                                  row.id === vx.id ? { ...row, date: e.target.value } : row
                                                ),
                                              }
                                            : p
                                        )
                                      )
                                    }
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={activePet.vaccines.length <= 1}
                                    onClick={() =>
                                      setPets((prev) =>
                                        prev.map((p) =>
                                          p.id === activePet.id
                                            ? { ...p, vaccines: p.vaccines.filter((row) => row.id !== vx.id) }
                                            : p
                                        )
                                      )
                                    }
                                  >
                                    -
                                  </Button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setPets((prev) =>
                                    prev.map((p) =>
                                      p.id === activePet.id
                                        ? {
                                            ...p,
                                            vaccines: [...p.vaccines, { id: crypto.randomUUID(), type: '', date: '' }],
                                          }
                                        : p
                                    )
                                  )
                                }
                              >
                                Add another vaccine
                              </Button>
                            </div>
                            <Textarea
                              placeholder="Notas de la mascota (alergias, comportamiento, etc.)"
                              value={activePet.notes}
                              onChange={(e) =>
                                setPets((prev) =>
                                  prev.map((p) => (p.id === activePet.id ? { ...p, notes: e.target.value } : p))
                                )
                              }
                              rows={2}
                            />
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            setPets((prev) => {
                              const newPet = makeEmptyPet();
                              setActivePetId(newPet.id);
                              return [...prev, newPet];
                            })
                          }
                        >
                          <PlusCircle className="mr-1 h-4 w-4" />
                          Add another pet
                        </Button>
                      </div>
                    )}
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <p className="font-medium">Resumen</p>
                      <p>{fullName || 'Sin nombre'}</p>
                      <p>{email || 'Sin email'}</p>
                      <p>{phone || 'Sin telefono'}</p>
                      <p>Mascotas a registrar: {pets.filter((pet) => pet.name.trim()).length}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setClientStep(2)}>
                        {t('register.back')}
                      </Button>
                      {!step3SelectingKinds && (
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={() => setStep3SelectingKinds(true)}
                        >
                          Editar categorias
                        </Button>
                      )}
                      <Button type="submit" className="flex-1" disabled={loading}>
                        {loading ? t('register.creating') : t('register.createAccount')}
                      </Button>
                    </div>
                    {showRetryAfterTimeout && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="w-full mt-2"
                        disabled={loading}
                        onClick={(e) => {
                          e.preventDefault();
                          handleClientSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                        }}
                      >
                        Reintentar
                      </Button>
                    )}
                  </>
                )}
              </form>
            )}

            {isOwner && step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">{t('register.businessNameLabel')}</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder={t('register.businessNamePlaceholder')}
                    required
                  />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setStep(2)}
                  disabled={!businessName.trim()}
                >
                  {t('register.next')}
                </Button>
              </div>
            )}

            {isOwner && step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">{t('register.choosePlan')}</p>
                <div className="space-y-2">
                  {SIGNUP_TIERS.map(({ tier, nameKey, descKey, price }) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setSelectedTier(tier)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedTier === tier ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{t(nameKey)}</span>
                        <span className="text-muted-foreground">${price}/mes</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{t(descKey)}</p>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    {t('register.back')}
                  </Button>
                  <Button type="button" className="flex-1" onClick={() => setStep(3)}>
                    {t('register.next')}
                  </Button>
                </div>
              </div>
            )}

            {isOwner && step === 3 && (
              <form onSubmit={handleOwnerSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-fullName">{t('register.fullName')}</Label>
                  <Input
                    id="owner-fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-email">{t('login.email')}</Label>
                  <Input
                    id="owner-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@correo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner-password">{t('login.password')}</Label>
                  <Input
                    id="owner-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    {t('register.back')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={loading}>
                    {loading ? t('register.creating') : t('register.createAccount')}
                  </Button>
                </div>
                {showRetryAfterTimeout && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={loading}
                    onClick={(e) => {
                      e.preventDefault();
                      handleOwnerSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
                    }}
                  >
                    Reintentar
                  </Button>
                )}
              </form>
            )}

            {isClientDebugSurfacesEnabled() && signupLogs.length > 0 && (
              <div className="mt-4 rounded-md border border-muted bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Registration log</p>
                <pre className="text-xs font-mono overflow-auto max-h-32 whitespace-pre-wrap break-words">
                  {signupLogs.join('\n')}
                </pre>
              </div>
            )}

            {alreadyRegisteredAs === 'owner' && (
              <p className="mt-3 text-sm text-muted-foreground text-center">
                {t('register.errorEmailInUseOwner')}{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  {t('register.signInHere')}
                </Link>
              </p>
            )}
            {alreadyRegisteredAs === 'client' && (
              <p className="mt-3 text-sm text-muted-foreground text-center">
                {t('register.errorEmailInUseClient')}{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">
                  {t('register.clientPortalLogin')}
                </Link>
              </p>
            )}

            <p className="text-center text-sm text-muted-foreground mt-6">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline">
                {t('register.signInHere')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
