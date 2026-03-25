import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Business } from '@/lib/auth';
import { fetchBusinessByPublicSlug } from '@/lib/businessSlug';

/**
 * Resolve business by slug from route (e.g. /:businessSlug/login).
 * Use for login/register pages to show business name and get business_id for linking.
 */
export function useBusinessBySlug() {
  const { businessSlug } = useParams<{ businessSlug?: string }>();
  const slug = businessSlug ?? null;

  const query = useQuery({
    queryKey: ['businessBySlug', slug],
    enabled: !!slug,
    queryFn: async (): Promise<Business | null> => {
      if (!slug) return null;
      return fetchBusinessByPublicSlug(supabase, slug);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    businessSlug: slug,
    business: query.data ?? null,
    businessId: query.data?.id ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
