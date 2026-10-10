import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/translations';
import {
  FEATURE_ROLES,
  FEATURE_SUBSCRIPTION_TIERS,
  normalizeRolloutTierLabel,
  type RolloutTier,
} from '@/lib/featureRollout';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { devConsole } from '@/lib/clientDebug';

type FeatureRow = {
  feature_key: string;
  display_name: string;
  min_tier: RolloutTier;
  roles: string[];
  subscription_tiers: string[];
};

/**
 * The features the app actually checks (isFeatureVisible), grouped by area. Rows in the database that
 * aren't listed here do nothing, so they aren't shown. Add a key here when code starts checking it.
 */
const FEATURE_GROUPS: { id: string; features: string[] }[] = [
  { id: 'appointments', features: ['appointments', 'appointment_book', 'booking_settings'] },
  {
    id: 'sales',
    features: [
      'transactions_list',
      'transaction_create',
      'transaction_detail',
      'payments',
      'payment_configuration',
      'tax_settings',
      'receipt_personalization',
    ],
  },
  { id: 'inventory', features: ['inventory', 'barcode_lookup'] },
  { id: 'staff', features: ['employee_mobile_punch', 'geofencing', 'geofencing_settings'] },
  { id: 'account', features: ['account_settings'] },
];

const KNOWN_KEYS = FEATURE_GROUPS.flatMap((g) => g.features);

/** Same defaults the old "Add feature" used: hidden (development, super admin only). */
const DEFAULT_ROW: Omit<FeatureRow, 'feature_key' | 'display_name'> = {
  min_tier: 'development',
  roles: ['super_admin'],
  subscription_tiers: ['standard'],
};

function featureLabel(key: string, fallback: string): string {
  const tKey = `admin.features.name.${key}`;
  const label = t(tKey);
  return label === tKey ? fallback : label;
}

function roleLabel(role: string): string {
  const tKey = `admin.features.role.${role}`;
  const label = t(tKey);
  return label === tKey ? role : label;
}

function tierLabel(tier: string): string {
  if (tier === 'standard') return t('admin.features.tierStandard');
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

function sameRow(a: FeatureRow, b: FeatureRow): boolean {
  const key = (r: FeatureRow) =>
    JSON.stringify([r.min_tier, [...r.roles].sort(), [...r.subscription_tiers].sort()]);
  return key(a) === key(b);
}

function toggleInList(list: string[], value: string, checked: boolean, fallback: string): string[] {
  const next = new Set(list);
  next.delete('*');
  if (checked) next.add(value);
  else next.delete(value);
  return next.size > 0 ? Array.from(next) : [fallback];
}

export function FeatureSettingsTable() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, FeatureRow>>({});
  const [openAdvanced, setOpenAdvanced] = useState<string | null>(null);

  const featureCatalogQuery = useQuery({
    queryKey: ['feature_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_catalog').select('feature_key, display_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const featureRolloutQuery = useQuery({
    queryKey: ['feature_rollout_v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('feature_rollout').select('feature_key, min_tier');
      if (error) throw error;
      return data ?? [];
    },
  });

  const featureVisibilityQuery = useQuery({
    queryKey: ['feature_visibility_rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_visibility_rules')
        .select('feature_key, roles, subscription_tiers');
      if (error) throw error;
      return data ?? [];
    },
  });

  const queriesReady =
    featureCatalogQuery.isSuccess && featureRolloutQuery.isSuccess && featureVisibilityQuery.isSuccess;

  /** Saved state of every feature the app uses (defaults if a row is missing in the database). */
  const savedByKey = useMemo(() => {
    const m = new Map<string, FeatureRow>();
    for (const key of KNOWN_KEYS) {
      m.set(key, { feature_key: key, display_name: key, ...DEFAULT_ROW, roles: [...DEFAULT_ROW.roles], subscription_tiers: [...DEFAULT_ROW.subscription_tiers] });
    }
    for (const row of featureCatalogQuery.data ?? []) {
      const r = m.get(row.feature_key);
      if (r) r.display_name = row.display_name;
    }
    for (const row of featureRolloutQuery.data ?? []) {
      const r = m.get(row.feature_key);
      if (r) r.min_tier = normalizeRolloutTierLabel(row.min_tier);
    }
    for (const row of featureVisibilityQuery.data ?? []) {
      const r = m.get(row.feature_key);
      if (!r) continue;
      if (row.roles) r.roles = row.roles;
      if (row.subscription_tiers) r.subscription_tiers = row.subscription_tiers;
    }
    return m;
  }, [featureCatalogQuery.data, featureRolloutQuery.data, featureVisibilityQuery.data]);

  const current = (key: string): FeatureRow => drafts[key] ?? (savedByKey.get(key) as FeatureRow);

  const changedRows = useMemo(
    () =>
      Object.values(drafts).filter((d) => {
        const saved = savedByKey.get(d.feature_key);
        return saved ? !sameRow(d, saved) : true;
      }),
    [drafts, savedByKey]
  );

  const setDraft = (row: FeatureRow) => setDrafts((prev) => ({ ...prev, [row.feature_key]: row }));

  const saveMutation = useMutation({
    mutationFn: async (rowsToSave: FeatureRow[]) => {
      for (const row of rowsToSave) {
        const { error: catalogError } = await supabase
          .from('feature_catalog')
          .upsert({ feature_key: row.feature_key, display_name: row.display_name });
        if (catalogError) throw catalogError;
        const { error: rolloutError } = await supabase
          .from('feature_rollout')
          .upsert({ feature_key: row.feature_key, min_tier: row.min_tier });
        if (rolloutError) throw rolloutError;
        const { error: visibilityError } = await supabase.from('feature_visibility_rules').upsert({
          feature_key: row.feature_key,
          roles: row.roles,
          subscription_tiers: row.subscription_tiers,
        });
        if (visibilityError) throw visibilityError;
      }
    },
    onSuccess: async () => {
      toast.success(t('admin.features.saved'));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['feature_catalog'] }),
        queryClient.invalidateQueries({ queryKey: ['feature_rollout_v2'] }),
        queryClient.invalidateQueries({ queryKey: ['feature_visibility_rules'] }),
      ]);
      setDrafts({});
    },
    onError: (error) => {
      devConsole.error('Save feature settings error', error);
      toast.error(t('admin.features.saveError'));
    },
  });

  if (!queriesReady) {
    return <p className="text-sm text-muted-foreground">{t('admin.features.loading')}</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{t('admin.features.intro')}</p>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.id} className="space-y-1">
          <h3 className="text-sm font-semibold text-muted-foreground">{t(`admin.features.group.${group.id}`)}</h3>
          <ul className="divide-y rounded-lg border">
            {group.features.map((key) => {
              const row = current(key);
              const live = row.min_tier === 'production';
              const isOpen = openAdvanced === key;
              const changed = !!drafts[key] && !sameRow(drafts[key], savedByKey.get(key) as FeatureRow);
              const switchId = `feature-live-${key}`;
              return (
                <Fragment key={key}>
                  <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setOpenAdvanced(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      aria-label={`${featureLabel(key, row.display_name)}: ${isOpen ? t('admin.features.hideDetails') : t('admin.features.showDetails')}`}
                      title={isOpen ? t('admin.features.hideDetails') : t('admin.features.showDetails')}
                    >
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        aria-hidden
                      />
                      <span className="font-medium">{featureLabel(key, row.display_name)}</span>
                      {changed && (
                        <span className="text-xs font-normal text-muted-foreground">{t('admin.features.unsaved')}</span>
                      )}
                    </button>
                    <label htmlFor={switchId} className="flex shrink-0 items-center gap-3 text-sm">
                      <span className={live ? 'font-medium' : 'text-muted-foreground'}>
                        {live ? t('admin.features.live') : t('admin.features.devOnly')}
                      </span>
                      <Switch
                        id={switchId}
                        checked={live}
                        onCheckedChange={(on) => setDraft({ ...row, min_tier: on ? 'production' : 'development' })}
                      />
                    </label>
                  </li>
                  {isOpen && (
                    <li className="grid gap-4 bg-muted/30 py-3 pl-10 pr-4 text-sm sm:grid-cols-2">
                      <fieldset className="space-y-2">
                        <legend className="mb-1 font-medium">{t('admin.features.colRoles')}</legend>
                        <CheckRow
                          id={`${key}-roles-all`}
                          label={t('admin.features.allRoles')}
                          checked={row.roles.includes('*')}
                          onChange={(c) => setDraft({ ...row, roles: c ? ['*'] : ['super_admin'] })}
                        />
                        {FEATURE_ROLES.map((role) => (
                          <CheckRow
                            key={role}
                            id={`${key}-role-${role}`}
                            label={roleLabel(role)}
                            disabled={row.roles.includes('*')}
                            checked={row.roles.includes('*') || row.roles.includes(role)}
                            onChange={(c) => setDraft({ ...row, roles: toggleInList(row.roles, role, c, 'super_admin') })}
                          />
                        ))}
                      </fieldset>
                      <fieldset className="space-y-2">
                        <legend className="mb-1 font-medium">{t('admin.features.colTiers')}</legend>
                        <CheckRow
                          id={`${key}-tiers-all`}
                          label={t('admin.features.allTiers')}
                          checked={row.subscription_tiers.includes('*')}
                          onChange={(c) => setDraft({ ...row, subscription_tiers: c ? ['*'] : ['standard'] })}
                        />
                        {FEATURE_SUBSCRIPTION_TIERS.map((tier) => (
                          <CheckRow
                            key={tier}
                            id={`${key}-tier-${tier}`}
                            label={tierLabel(tier)}
                            disabled={row.subscription_tiers.includes('*')}
                            checked={row.subscription_tiers.includes('*') || row.subscription_tiers.includes(tier)}
                            onChange={(c) =>
                              setDraft({
                                ...row,
                                subscription_tiers: toggleInList(row.subscription_tiers, tier, c, 'standard'),
                              })
                            }
                          />
                        ))}
                      </fieldset>
                    </li>
                  )}
                </Fragment>
              );
            })}
          </ul>
        </section>
      ))}

      {changedRows.length > 0 && (
      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card/95 px-4 py-3 shadow-md backdrop-blur">
        <span className="mr-auto text-sm text-muted-foreground">
          {t('admin.features.pendingChanges', { count: changedRows.length })}
        </span>
        <Button
          variant="outline"
          onClick={() => setDrafts({})}
          disabled={saveMutation.isPending}
        >
          {t('admin.features.discard')}
        </Button>
        <Button
          onClick={() => saveMutation.mutate(changedRows)}
          disabled={saveMutation.isPending}
        >
          {t('admin.features.saveAll')}
        </Button>
      </div>
      )}
    </div>
  );
}

function CheckRow({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(c) => onChange(c === true)} />
      <label htmlFor={id} className={disabled ? 'text-muted-foreground' : undefined}>
        {label}
      </label>
    </div>
  );
}
