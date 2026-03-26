import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  FEATURE_ROLES,
  FEATURE_SUBSCRIPTION_TIERS,
  normalizeFeatureKey,
  normalizeRolloutTierLabel,
  type RolloutTier,
} from '@/lib/featureRollout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type FeatureRow = {
  feature_key: string;
  display_name: string;
  min_tier: RolloutTier;
  roles: string[];
  subscription_tiers: string[];
};

const DEFAULT_FEATURE_ROW = {
  min_tier: 'development' as RolloutTier,
  roles: ['super_admin'],
  subscription_tiers: ['standard'],
};

function rolesLabel(roles: string[]): string {
  if (roles.includes('*')) return 'All roles';
  return roles.join(', ');
}

function tiersLabel(tiers: string[]): string {
  if (tiers.includes('*')) return 'All tiers';
  return tiers.map((tier) => tier.charAt(0).toUpperCase() + tier.slice(1)).join(', ');
}

function roleTagClass(role: string): string {
  if (role === 'super_admin') return 'bg-amber-100 text-amber-800 border-amber-300';
  if (role === 'manager') return 'bg-purple-100 text-purple-800 border-purple-300';
  if (role === 'employee') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (role === 'client') return 'bg-green-100 text-green-800 border-green-300';
  return 'bg-muted text-foreground border-border';
}

function normalizedRow(row: FeatureRow): FeatureRow {
  return {
    ...row,
    roles: [...row.roles].sort(),
    subscription_tiers: [...row.subscription_tiers].sort(),
  };
}

export function FeatureSettingsTable() {
  const queryClient = useQueryClient();
  const [newFeatureName, setNewFeatureName] = useState('');
  const [draftByKey, setDraftByKey] = useState<Record<string, FeatureRow>>({});

  const featureCatalogQuery = useQuery({
    queryKey: ['feature_catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('feature_catalog')
        .select('feature_key, display_name')
        .order('display_name', { ascending: true });
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

  const rows = useMemo<FeatureRow[]>(() => {
    const byKey = new Map<string, FeatureRow>();

    for (const row of featureCatalogQuery.data ?? []) {
      byKey.set(row.feature_key, {
        feature_key: row.feature_key,
        display_name: row.display_name,
        min_tier: DEFAULT_FEATURE_ROW.min_tier,
        roles: [...DEFAULT_FEATURE_ROW.roles],
        subscription_tiers: [...DEFAULT_FEATURE_ROW.subscription_tiers],
      });
    }
    for (const row of featureRolloutQuery.data ?? []) {
      const existing = byKey.get(row.feature_key);
      if (!existing) continue;
      existing.min_tier = normalizeRolloutTierLabel(row.min_tier);
    }
    for (const row of featureVisibilityQuery.data ?? []) {
      const existing = byKey.get(row.feature_key);
      if (!existing) continue;
      existing.roles = row.roles ?? [...DEFAULT_FEATURE_ROW.roles];
      existing.subscription_tiers = row.subscription_tiers ?? [...DEFAULT_FEATURE_ROW.subscription_tiers];
    }

    return Array.from(byKey.values()).sort((a, b) => a.display_name.localeCompare(b.display_name));
  }, [featureCatalogQuery.data, featureRolloutQuery.data, featureVisibilityQuery.data]);

  const queriesReady =
    featureCatalogQuery.isSuccess && featureRolloutQuery.isSuccess && featureVisibilityQuery.isSuccess;

  useEffect(() => {
    if (!queriesReady) return;
    setDraftByKey((prev) => {
      const next = { ...prev };
      for (const row of rows) {
        if (!next[row.feature_key]) next[row.feature_key] = row;
      }
      return next;
    });
  }, [rows, queriesReady]);

  const effectiveRows = useMemo(
    () => rows.map((row) => draftByKey[row.feature_key] ?? row),
    [rows, draftByKey]
  );

  const saveOne = async (row: FeatureRow) => {
    const { error: catalogError } = await supabase
      .from('feature_catalog')
      .upsert({ feature_key: row.feature_key, display_name: row.display_name });
    if (catalogError) {
      throw catalogError;
    }

    const { error: rolloutError } = await supabase
      .from('feature_rollout')
      .upsert({ feature_key: row.feature_key, min_tier: row.min_tier });
    if (rolloutError) {
      throw rolloutError;
    }

    const { error: visibilityError } = await supabase.from('feature_visibility_rules').upsert({
      feature_key: row.feature_key,
      roles: row.roles,
      subscription_tiers: row.subscription_tiers,
    });
    if (visibilityError) {
      throw visibilityError;
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    if (!queriesReady) return false;
    for (const row of rows) {
      const draft = draftByKey[row.feature_key];
      if (!draft) continue;
      if (JSON.stringify(normalizedRow(draft)) !== JSON.stringify(normalizedRow(row))) {
        return true;
      }
    }
    return false;
  }, [rows, draftByKey, queriesReady]);

  const saveAllSettingsMutation = useMutation({
    mutationFn: async (rowsToSave: FeatureRow[]) => {
      for (const row of rowsToSave) {
        await saveOne(row);
      }
    },
    onSuccess: () => {
      toast.success('All feature settings saved');
      void queryClient.invalidateQueries({ queryKey: ['feature_catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['feature_rollout_v2'] });
      void queryClient.invalidateQueries({ queryKey: ['feature_visibility_rules'] });
    },
    onError: (error) => {
      console.error('Save feature settings error', error);
      toast.error('Failed to save feature settings');
    },
  });

  const addFeatureMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const featureKey = normalizeFeatureKey(displayName);
      if (!featureKey) throw new Error('Feature name is required');

      const { error: catalogError } = await supabase.from('feature_catalog').insert({
        feature_key: featureKey,
        display_name: displayName.trim(),
      });
      if (catalogError) throw catalogError;

      const { error: rolloutError } = await supabase.from('feature_rollout').insert({
        feature_key: featureKey,
        min_tier: 'development',
      });
      if (rolloutError) throw rolloutError;

      const { error: visibilityError } = await supabase.from('feature_visibility_rules').insert({
        feature_key: featureKey,
        roles: ['super_admin'],
        subscription_tiers: ['standard'],
      });
      if (visibilityError) throw visibilityError;
    },
    onSuccess: () => {
      setNewFeatureName('');
      toast.success('Feature added with defaults');
      void queryClient.invalidateQueries({ queryKey: ['feature_catalog'] });
      void queryClient.invalidateQueries({ queryKey: ['feature_rollout_v2'] });
      void queryClient.invalidateQueries({ queryKey: ['feature_visibility_rules'] });
    },
    onError: (error) => {
      console.error('Add feature error', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add feature');
    },
  });

  const toggleRole = (row: FeatureRow, role: string, checked: boolean): FeatureRow => {
    const next = new Set(row.roles);
    next.delete('*');
    if (checked) next.add(role);
    else next.delete(role);
    const roles = Array.from(next);
    return { ...row, roles: roles.length > 0 ? roles : ['super_admin'] };
  };

  const toggleAllRoles = (row: FeatureRow, checked: boolean): FeatureRow => {
    return { ...row, roles: checked ? ['*'] : ['super_admin'] };
  };

  const toggleTier = (row: FeatureRow, tier: string, checked: boolean): FeatureRow => {
    const next = new Set(row.subscription_tiers);
    next.delete('*');
    if (checked) next.add(tier);
    else next.delete(tier);
    const tiers = Array.from(next);
    return { ...row, subscription_tiers: tiers.length > 0 ? tiers : ['standard'] };
  };

  const toggleAllTiers = (row: FeatureRow, checked: boolean): FeatureRow => {
    return { ...row, subscription_tiers: checked ? ['*'] : ['standard'] };
  };

  const loading =
    featureCatalogQuery.isLoading || featureRolloutQuery.isLoading || featureVisibilityQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newFeatureName}
          placeholder="New feature name"
          onChange={(e) => setNewFeatureName(e.target.value)}
          className="max-w-sm"
        />
        <Button
          onClick={() => addFeatureMutation.mutate(newFeatureName)}
          disabled={!newFeatureName.trim() || addFeatureMutation.isPending}
        >
          Add Feature
        </Button>
        <Button
          onClick={() => saveAllSettingsMutation.mutate(effectiveRows)}
          disabled={!queriesReady || !hasUnsavedChanges || saveAllSettingsMutation.isPending}
        >
          Save all settings
        </Button>
      </div>

      {!queriesReady || loading ? (
        <p className="text-sm text-muted-foreground">Loading feature settings...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No feature rows found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium">Feature</th>
                <th className="px-4 py-3 text-left font-medium">Roles</th>
                <th className="px-4 py-3 text-left font-medium">Subscription tiers</th>
                <th className="px-4 py-3 text-left font-medium">Environment</th>
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((row) => (
                <FeatureSettingsTableRow
                  key={row.feature_key}
                  row={row}
                  onChange={(next) => setDraftByKey((prev) => ({ ...prev, [next.feature_key]: next }))}
                  toggleRole={toggleRole}
                  toggleAllRoles={toggleAllRoles}
                  toggleTier={toggleTier}
                  toggleAllTiers={toggleAllTiers}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FeatureSettingsTableRow({
  row,
  onChange,
  toggleRole,
  toggleAllRoles,
  toggleTier,
  toggleAllTiers,
}: {
  row: FeatureRow;
  onChange: (row: FeatureRow) => void;
  toggleRole: (row: FeatureRow, role: string, checked: boolean) => FeatureRow;
  toggleAllRoles: (row: FeatureRow, checked: boolean) => FeatureRow;
  toggleTier: (row: FeatureRow, tier: string, checked: boolean) => FeatureRow;
  toggleAllTiers: (row: FeatureRow, checked: boolean) => FeatureRow;
}) {
  const draft = row;

  const setDraft = (next: FeatureRow) => onChange(next);
  const visibleRoleTags = draft.roles.includes('*') ? ['all_roles'] : draft.roles.slice(0, 2);
  const extraRoles = draft.roles.includes('*') ? 0 : Math.max(0, draft.roles.length - visibleRoleTags.length);

  return (
    <tr className="border-b align-top hover:bg-muted/50">
      <td className="px-4 py-3">
        <div className="font-medium">{draft.display_name}</div>
        <div className="font-mono text-xs text-muted-foreground">{draft.feature_key}</div>
      </td>
      <td className="px-4 py-3">
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[260px] justify-between gap-2">
                <span className="flex min-w-0 flex-wrap gap-1">
                  {visibleRoleTags.map((role) =>
                    role === 'all_roles' ? (
                      <Badge
                        key="all_roles"
                        variant="outline"
                        className="border-gray-300 bg-white text-[10px] text-gray-700"
                      >
                        All roles
                      </Badge>
                    ) : (
                      <Badge
                        key={role}
                        variant="outline"
                        className={`text-[10px] capitalize ${roleTagClass(role)}`}
                      >
                        {role.replace('_', ' ')}
                      </Badge>
                    )
                  )}
                  {extraRoles > 0 ? (
                    <Badge variant="outline" className="text-[10px]">
                      +{extraRoles}
                    </Badge>
                  ) : null}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[230px]">
              <DropdownMenuCheckboxItem
                checked={draft.roles.includes('*')}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => setDraft(toggleAllRoles(draft, checked))}
              >
                All roles
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {FEATURE_ROLES.map((role) => (
                <DropdownMenuCheckboxItem
                  key={role}
                  checked={draft.roles.includes(role)}
                  disabled={draft.roles.includes('*')}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => {
                    const next = toggleRole(draft, role, checked);
                    setDraft(next);
                  }}
                >
                  {role.replace('_', ' ')}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[230px] justify-between text-xs">
                <span className="truncate">{tiersLabel(draft.subscription_tiers)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px]">
              <DropdownMenuCheckboxItem
                checked={draft.subscription_tiers.includes('*')}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => setDraft(toggleAllTiers(draft, checked))}
              >
                All tiers
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {FEATURE_SUBSCRIPTION_TIERS.map((tier) => (
                <DropdownMenuCheckboxItem
                  key={tier}
                  checked={draft.subscription_tiers.includes(tier)}
                  disabled={draft.subscription_tiers.includes('*')}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) => setDraft(toggleTier(draft, tier, checked))}
                >
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
      <td className="px-4 py-3">
        <Select
          value={draft.min_tier}
          onValueChange={(value) => setDraft({ ...draft, min_tier: normalizeRolloutTierLabel(value) })}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="staged">Staged</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </td>
    </tr>
  );
}
