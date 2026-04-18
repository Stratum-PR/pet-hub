-- Demo workspace pets: add breed-appropriate stock photos where missing.
-- URLs mirror src/lib/demoWorkspacePetPhotos.ts (Dog CEO CDN).

UPDATE public.pets
SET photo_url = CASE trim(name)
  WHEN 'Luna' THEN 'https://images.dog.ceo/breeds/terrier-yorkshire/n02094433_515.jpg'
  WHEN 'Rocky' THEN 'https://images.dog.ceo/breeds/bulldog-french/n02108915_7806.jpg'
  WHEN 'Coco' THEN 'https://images.dog.ceo/breeds/poodle-standard/n02113799_983.jpg'
  ELSE photo_url
END
WHERE (business_id = '00000000-0000-0000-0000-000000000001'::uuid
   OR business_id::text = '00000000-0000-0000-0000-000000000001')
  AND trim(name) IN ('Luna', 'Rocky', 'Coco')
  AND (photo_url IS NULL OR btrim(photo_url) = '');
