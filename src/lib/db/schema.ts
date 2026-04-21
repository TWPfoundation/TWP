/**
 * Drizzle ORM Schema — The Witness Protocol Foundation
 * ════════════════════════════════════════════════════
 * 
 * SCHEMA AUTHORITY: The live Supabase database + checked migration files
 * are the SINGLE SOURCE OF TRUTH. This file is a mirror of that authority.
 * 
 * If the DB changes via migration, this file MUST be updated in the same commit.
 * If this file drifts from the DB, the DB wins.
 * 
 * Migrations:
 *   1. 20260410112008_phase0_foundation_schema
 *   2. 20260410125805_phase2_gate_vetting_schema
 *   3. 20260410130600_phase2_tighten_rls_policies
 *   4. 20260410153030_phase3_inquisitor_schema
 *   5. 20260410211344_add_annotations_to_testimony_records
 *   6. 20260421173000_m1_witness_runtime_links
 * 
 * Last reconciled: 2026-04-11 (session: 0ce279d6)
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
} from 'drizzle-orm/pg-core';

// ============================================================
// Phase 0 Tables (Migration 1: phase0_foundation_schema)
// ============================================================

/** Email registrations for MHS Packet distribution */
export const summons = pgTable('summons', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Raw essay submissions through The Gate */
export const witnessSubmissions = pgTable('witness_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  essayText: text('essay_text').notNull(),
  wordCount: integer('word_count').notNull(),
  submissionStatus: text('submission_status').default('pending_sieve'),

  // Evaluation Rubric (legacy — scored by Phase 0 manual review)
  scoreDepth: numeric('score_depth'),
  scoreSpecificity: numeric('score_specificity'),
  scoreEthics: numeric('score_ethics'),
  scoreOriginality: numeric('score_originality'),
  scoreCoherence: numeric('score_coherence'),
  scoreCultural: numeric('score_cultural'),
  totalScore: numeric('total_score'),
  reviewerNotes: text('reviewer_notes'),

  // Gate pipeline fields (added in phase2_gate_vetting_schema)
  contentHash: text('content_hash'),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/** Authenticated witness profiles */
export const witnessProfiles = pgTable('witness_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  supabaseUserId: uuid('supabase_user_id').unique().notNull(),
  pseudonym: text('pseudonym').unique().notNull(),
  displayName: text('display_name'),
  regionalCode: text('regional_code'),
  tier: text('tier'),        // CHECK: A, B, C, D
  status: text('status').default('invited'),  // CHECK: invited, vetting, active, rejected, exited
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/** Public, append-only transparency feed */
export const failureLogEntries = pgTable('failure_log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),    // CHECK: prompt, gate, annotation, security, methodology, other
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').default('info'),  // CHECK: info, warning, critical
  discoveredBy: text('discovered_by'),
  remedy: text('remedy'),
  isPublic: boolean('is_public').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/** Expert outreach campaign tracking */
export const expertTargets = pgTable('expert_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  tier: text('tier').notNull(),           // CHECK: A, B, C, D
  email: text('email'),
  institution: text('institution'),
  domain: text('domain'),                 // CHECK: ai_safety, ethics, global_south, indigenous, tech_leader
  status: text('status').default('identified'), // CHECK: identified, contacted, responded, engaged, declined
  mhsSent: boolean('mhs_sent').default(false),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

/** Immutable, append-only audit log */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  actorId: uuid('actor_id'),
  targetType: text('target_type'),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// Phase 2 Tables (Migration 2: phase2_gate_vetting_schema)
// ============================================================

/** Gate assessment records — one per submission, tracks all three tiers */
export const gateAssessments = pgTable('gate_assessments', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => witnessSubmissions.id).notNull(),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id),

  // Tier 1: AI Sieve
  tier1Status: text('tier1_status').default('pending'),  // CHECK: pending, passed, failed
  tier1Score: numeric('tier1_score'),
  tier1Reason: text('tier1_reason'),
  tier1Model: text('tier1_model'),
  tier1ProcessedAt: timestamp('tier1_processed_at', { withTimezone: true }),

  // Tier 2: AI Qualifier
  tier2Status: text('tier2_status').default('pending'),  // CHECK: pending, passed, failed
  tier2CapTags: jsonb('tier2_cap_tags').default([]),
  tier2RelTags: jsonb('tier2_rel_tags').default([]),
  tier2FeltTags: jsonb('tier2_felt_tags').default([]),
  tier2Specificity: numeric('tier2_specificity'),
  tier2Counterfactual: numeric('tier2_counterfactual'),
  tier2Relational: numeric('tier2_relational'),
  tier2Model: text('tier2_model'),
  tier2ProcessedAt: timestamp('tier2_processed_at', { withTimezone: true }),

  // Tier 3: Human Curation Council
  tier3ReviewerA: uuid('tier3_reviewer_a'),
  tier3ReviewerB: uuid('tier3_reviewer_b'),
  tier3ScoreA: jsonb('tier3_score_a'),
  tier3ScoreB: jsonb('tier3_score_b'),
  tier3Kappa: numeric('tier3_kappa'),
  tier3Decision: text('tier3_decision'),  // CHECK: accept, reject, review
  tier3Notes: text('tier3_notes'),
  tier3CompletedAt: timestamp('tier3_completed_at', { withTimezone: true }),

  // Overall
  finalStatus: text('final_status').default('pending'),  // CHECK: pending, passed, failed, review
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/** De-identified testimony records — created after Gate passage */
export const testimonyRecords = pgTable('testimony_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  contentHash: text('content_hash').unique().notNull(),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id),
  deIdentifiedText: text('de_identified_text').notNull(),
  originalSubmissionId: uuid('original_submission_id').references(() => witnessSubmissions.id),
  gateAssessmentId: uuid('gate_assessment_id').references(() => gateAssessments.id),
  status: text('status').default('gated'),  // CHECK: gated, annotating, published, archived
  ipfsCid: text('ipfs_cid'),
  rfc3161Token: text('rfc3161_token'),
  annotations: jsonb('annotations'),  // Added by migration 5
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// Phase 3 Tables (Migration 4: phase3_inquisitor_schema)
// ============================================================

/** Inquisitor dialogue sessions */
export const inquisitorSessions = pgTable('inquisitor_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id).notNull(),
  testimonyId: uuid('testimony_id').references(() => testimonyRecords.id).notNull(),
  sessionNumber: integer('session_number').default(1).notNull(),
  status: text('status').default('active'),   // CHECK: active, paused, completed, terminated
  turnCount: integer('turn_count').default(0),
  questionCount: integer('question_count').default(0),
  statementCount: integer('statement_count').default(0),
  depthLevel: text('depth_level').default('surface'),  // CHECK: surface, intermediate, deep, philosophical
  topicsCovered: jsonb('topics_covered').default([]),
  distressSignals: integer('distress_signals').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/** Individual turns within an Inquisitor session */
export const inquisitorTurns = pgTable('inquisitor_turns', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => inquisitorSessions.id).notNull(),
  turnNumber: integer('turn_number').notNull(),
  role: text('role').notNull(),       // CHECK: witness, inquisitor, system, synthesis
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/** Synthesis entries — distilled thoughts generated periodically */
export const synthesisEntries = pgTable('synthesis_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').references(() => inquisitorSessions.id).notNull(),
  triggerTurn: integer('trigger_turn').notNull(),
  distilledThought: text('distilled_thought').notNull(),
  themes: jsonb('themes').default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================================
// Internal & Governance Tables (Added for reconciliation)
// ============================================================

/** Administrative roles for the backoffice */
export const adminRoles = pgTable('admin_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').unique().notNull(), // References auth.users
  email: text('email').notNull(),
  role: text('role').notNull(), // CHECK: admin, hcc, sac, board
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/** Granular consent preferences for witnesses */
export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id).unique().notNull(),
  internalResearch: boolean('internal_research').default(true),
  partnerSharing: boolean('partner_sharing').default(false),
  publicPublication: boolean('public_publication').default(false),
  lastUpdatedAt: timestamp('last_updated_at', { withTimezone: true }).defaultNow(),
});

/** Minimal accepted-witness bridge linkage state */
export const witnessRuntimeLinks = pgTable('witness_runtime_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  witnessId: uuid('witness_id').references(() => witnessProfiles.id).unique().notNull(),
  accessStatus: text('access_status').default('accepted').notNull(),
  bridgeStatus: text('bridge_status').default('pending').notNull(),
  runtimeConsentStatus: text('runtime_consent_status').default('unknown').notNull(),
  lastBridgeError: text('last_bridge_error'),
  lastBridgeSyncedAt: timestamp('last_bridge_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
