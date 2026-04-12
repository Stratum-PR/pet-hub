import type { SupabaseClient } from '@supabase/supabase-js';
import { devConsole } from '@/lib/clientDebug';

const BUCKET = 'staff-photos';

export function extractStaffPhotoPathFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.indexOf(BUCKET);
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/');
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteStaffPhotoFromStorage(
  supabase: SupabaseClient,
  photoUrl: string
): Promise<void> {
  const filePath = extractStaffPhotoPathFromUrl(photoUrl);
  if (!filePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  if (error) devConsole.warn('[staffPhoto] delete failed', error);
}

export async function uploadStaffPhotoDataUrl(
  supabase: SupabaseClient,
  businessId: string,
  dataUrl: string
): Promise<{ publicUrl: string } | { error: string }> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const fileExt = blob.type.split('/')[1] || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${businessId}/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, blob, {
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) return { error: uploadError.message };
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return { publicUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'upload failed' };
  }
}
