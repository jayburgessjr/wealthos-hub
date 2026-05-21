-- Create private 'vision' storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vision',
  'vision',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload to their household folder
CREATE POLICY "Users can upload to household folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vision'
  AND (storage.foldername(name))[1] = get_user_household_id(auth.uid())::text
);

-- RLS: Users can view files in their household folder
CREATE POLICY "Users can view household files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vision'
  AND (storage.foldername(name))[1] = get_user_household_id(auth.uid())::text
);

-- RLS: Users can update files in their household folder
CREATE POLICY "Users can update household files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vision'
  AND (storage.foldername(name))[1] = get_user_household_id(auth.uid())::text
);

-- RLS: Users can delete files in their household folder
CREATE POLICY "Users can delete household files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vision'
  AND (storage.foldername(name))[1] = get_user_household_id(auth.uid())::text
);