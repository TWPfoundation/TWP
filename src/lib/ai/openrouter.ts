import OpenAI from 'openai';

/**
 * OpenRouter API client.
 * Uses the OpenAI SDK since OpenRouter is OpenAI-compatible.
 * 
 * Models are referenced as: "anthropic/claude-3.5-sonnet", "anthropic/claude-3-haiku", etc.
 * Full model list: https://openrouter.ai/models
 */
export const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'X-Title': 'The Witness Protocol Foundation',
  },
});

/** Default models for each function */
export const MODELS = {
  /** Fast, cheap — spam/quality classification */
  SIEVE: 'anthropic/claude-3-haiku',
  /** Balanced — CAP/REL/FELT tag extraction, synthesis */
  QUALIFIER: 'anthropic/claude-sonnet-4',
  /** Creative — Inquisitor dialogue generation */
  INQUISITOR: 'anthropic/claude-sonnet-4',
  /** Cheap — PII detection */
  PII_DETECT: 'anthropic/claude-3-haiku',
} as const;

export type ModelKey = keyof typeof MODELS;
