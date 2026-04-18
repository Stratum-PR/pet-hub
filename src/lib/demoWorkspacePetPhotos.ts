import { DEMO_WORKSPACE_BUSINESS_ID } from '@/lib/demoWorkspace';

/**
 * Stock dog photos (Dog CEO CDN) for named demo pets that have no `photo_url` in the shared seed DB.
 * Keep URLs in sync with `supabase/migrations/20260417130000_demo_workspace_pet_photos.sql`.
 */
const DEMO_PET_NAME_TO_PHOTO: Record<string, string> = {
  Luna: 'https://images.dog.ceo/breeds/terrier-yorkshire/n02094433_515.jpg',
  Rocky: 'https://images.dog.ceo/breeds/bulldog-french/n02108915_7806.jpg',
  Coco: 'https://images.dog.ceo/breeds/poodle-standard/n02113799_983.jpg',
};

export function withDemoWorkspacePetPhotoFallbacks<T extends { name?: string | null; photo_url?: string | null }>(
  businessId: string | null | undefined,
  pets: T[]
): T[] {
  if (!businessId || businessId !== DEMO_WORKSPACE_BUSINESS_ID) return pets;
  return pets.map((p) => {
    const existing = p.photo_url?.trim();
    if (existing) return p;
    const name = p.name?.trim();
    if (!name) return p;
    const fallback = DEMO_PET_NAME_TO_PHOTO[name];
    if (!fallback) return p;
    return { ...p, photo_url: fallback };
  });
}
