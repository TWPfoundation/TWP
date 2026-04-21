-- The Witness Protocol Foundation — Database Schema
-- ════════════════════════════════════════════════════════
-- SCHEMA AUTHORITY: This file serves as the SQL documentation 
-- for the live Supabase database.
-- Last Reconciled: 2026-04-11 (Phase 5 Alpha)

-- ────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────

-- 1. summons: Email registrations for MHS Packet distribution
CREATE TABLE public.summons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. witness_profiles: Authenticated witness identities
CREATE TABLE public.witness_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supabase_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  pseudonym TEXT UNIQUE NOT NULL,
  display_name TEXT,
  regional_code TEXT,
  tier TEXT DEFAULT 'D',
  status TEXT DEFAULT 'invited', -- invited, vetting, active, rejected, exited
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. witness_submissions: Raw essay submissions through The Gate
CREATE TABLE public.witness_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  witness_id UUID REFERENCES public.witness_profiles(id),
  essay_text TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  content_hash TEXT,
  submission_status TEXT DEFAULT 'pending_sieve',
  
  -- Legacy manual review fields
  score_depth NUMERIC,
  score_specificity NUMERIC,
  score_ethics NUMERIC,
  score_originality NUMERIC,
  score_coherence NUMERIC,
  score_cultural NUMERIC,
  total_score NUMERIC,
  reviewer_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. gate_assessments: AI and Human evaluation records
CREATE TABLE public.gate_assessments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID REFERENCES public.witness_submissions(id) NOT NULL,
  witness_id UUID REFERENCES public.witness_profiles(id),
  
  -- Tier 1: AI Sieve
  tier1_status TEXT DEFAULT 'pending',
  tier1_score NUMERIC,
  tier1_reason TEXT,
  tier1_model TEXT,
  tier1_processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Tier 2: AI Qualifier
  tier2_status TEXT DEFAULT 'pending',
  tier2_cap_tags JSONB DEFAULT '[]',
  tier2_rel_tags JSONB DEFAULT '[]',
  tier2_felt_tags JSONB DEFAULT '[]',
  tier2_specificity NUMERIC,
  tier2_counterfactual NUMERIC,
  tier2_relational NUMERIC,
  tier2_model TEXT,
  tier2_processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Tier 3: Human Curation Council
  tier3_reviewer_a UUID,
  tier3_reviewer_b UUID,
  tier3_score_a JSONB,
  tier3_score_b JSONB,
  tier3_kappa NUMERIC,
  tier3_decision TEXT,
  tier3_notes TEXT,
  tier3_completed_at TIMESTAMP WITH TIME ZONE,
  
  final_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. testimony_records: De-identified records created after Gate passage
CREATE TABLE public.testimony_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content_hash TEXT UNIQUE NOT NULL,
  witness_id UUID REFERENCES public.witness_profiles(id),
  de_identified_text TEXT NOT NULL,
  original_submission_id UUID REFERENCES public.witness_submissions(id),
  gate_assessment_id UUID REFERENCES public.gate_assessments(id),
  status TEXT DEFAULT 'gated', -- gated, annotating, published, archived
  ipfs_cid TEXT,
  rfc3161_token TEXT,
  annotations JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. inquisitor_sessions: Dialogue tracking
CREATE TABLE public.inquisitor_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  witness_id UUID REFERENCES public.witness_profiles(id) NOT NULL,
  testimony_id UUID REFERENCES public.testimony_records(id) NOT NULL,
  session_number INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', -- active, paused, completed, terminated
  turn_count INTEGER DEFAULT 0,
  question_count INTEGER DEFAULT 0,
  statement_count INTEGER DEFAULT 0,
  depth_level TEXT DEFAULT 'surface',
  topics_covered JSONB DEFAULT '[]',
  distress_signals INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 7. inquisitor_turns: Individual turn records
CREATE TABLE public.inquisitor_turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.inquisitor_sessions(id) NOT NULL,
  turn_number INTEGER NOT NULL,
  role TEXT NOT NULL, -- witness, inquisitor, system, synthesis
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 8. synthesis_entries: Background thoughts generated by Inquisitor
CREATE TABLE public.synthesis_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.inquisitor_sessions(id) NOT NULL,
  trigger_turn INTEGER NOT NULL,
  distilled_thought TEXT NOT NULL,
  themes JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 9. failure_log_entries: Public transparency feed
CREATE TABLE public.failure_log_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  discovered_by TEXT,
  remedy TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 10. audit_log: Immutable action trail
CREATE TABLE public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  actor_id UUID,
  target_type TEXT,
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 11. expert_targets: Outreach campaign tracking
CREATE TABLE public.expert_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tier TEXT NOT NULL,
  email TEXT,
  institution TEXT,
  domain TEXT,
  status TEXT DEFAULT 'identified',
  mhs_sent BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 12. admin_roles: Role-based access control for backoffice
CREATE TABLE public.admin_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id),
  email TEXT NOT NULL,
  role TEXT NOT NULL, -- admin, hcc, sac, board
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 13. consent_records: Granular preferences
CREATE TABLE public.consent_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  witness_id UUID UNIQUE NOT NULL REFERENCES public.witness_profiles(id),
  internal_research BOOLEAN DEFAULT true,
  partner_sharing BOOLEAN DEFAULT false,
  public_publication BOOLEAN DEFAULT false,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 14. witness_runtime_links: Minimal accepted-witness bridge state
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

-- ────────────────────────────────────────────────────────
-- SECURITY (RLS POLICIES)
-- ────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE public.summons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimony_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquisitor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquisitor_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthesis_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failure_log_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.witness_runtime_links ENABLE ROW LEVEL SECURITY;

-- Anonymous Intake Policies
CREATE POLICY "summons_insert_anon" ON public.summons FOR INSERT TO anon WITH CHECK (true);

-- Authenticated User Policies (Witnesses)
CREATE POLICY "witness_profile_self" ON public.witness_profiles FOR SELECT TO authenticated USING (auth.uid() = supabase_user_id);
CREATE POLICY "witness_submission_self_insert" ON public.witness_submissions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.witness_profiles WHERE id = witness_id AND supabase_user_id = auth.uid()));
CREATE POLICY "consent_records_self" ON public.consent_records FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.witness_profiles WHERE id = witness_id AND supabase_user_id = auth.uid()));
CREATE POLICY "witness_runtime_links_self" ON public.witness_runtime_links FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.witness_profiles WHERE id = witness_id AND supabase_user_id = auth.uid()));

-- Inquisitor Policies
CREATE POLICY "inquisitor_sessions_self" ON public.inquisitor_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.witness_profiles WHERE id = witness_id AND supabase_user_id = auth.uid()));
CREATE POLICY "inquisitor_turns_self" ON public.inquisitor_turns FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.inquisitor_sessions s JOIN public.witness_profiles p ON s.witness_id = p.id WHERE s.id = session_id AND p.supabase_user_id = auth.uid()));

-- Public Transparency
CREATE POLICY "failure_log_public" ON public.failure_log_entries FOR SELECT TO anon USING (is_public = true);

-- Admin Policies (Restricted to admin_roles)
CREATE POLICY "admin_all_restricted" ON public.audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.admin_roles WHERE user_id = auth.uid() AND is_active = true));
-- ... similar policies for other admin-facing tables ...
