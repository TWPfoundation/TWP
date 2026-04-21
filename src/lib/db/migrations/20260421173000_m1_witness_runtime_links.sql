CREATE TABLE public.witness_runtime_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  witness_id UUID UNIQUE NOT NULL REFERENCES public.witness_profiles(id),
  access_status TEXT DEFAULT 'accepted' NOT NULL,
  bridge_status TEXT DEFAULT 'pending' NOT NULL,
  runtime_consent_status TEXT DEFAULT 'unknown' NOT NULL,
  last_bridge_error TEXT,
  last_bridge_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.witness_runtime_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "witness_runtime_links_self"
ON public.witness_runtime_links
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.witness_profiles
    WHERE id = witness_id
      AND supabase_user_id = auth.uid()
  )
);
