import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { buildSystemPrompt, buildUserContext, type HealthContext } from './prompts';
import { getConfig } from '../db/queries';
import { redact } from './redactor';
import { logAiCall } from './audit';

const MAX_TOKENS = 2048;
const PLAN_MAX_TOKENS = 3000;

// ─── Provider resolution ──────────────────────────────────────────────────────

type Provider = 'anthropic' | 'openai' | 'ollama';

interface ProviderConfig {
  provider: Provider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

function resolveProvider(): ProviderConfig {
  const provider = (process.env.LUMEN_PROVIDER ?? getConfig('ai_provider') ?? 'anthropic') as Provider;
  const model    = process.env.LUMEN_MODEL     ?? getConfig('ai_model') ?? defaultModel(provider);
  const apiKey   = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY ?? getConfig('anthropic_api_key') ?? getConfig('openai_api_key') ?? undefined;
  const baseUrl  = process.env.LUMEN_BASE_URL  ?? getConfig('ai_base_url') ?? undefined;
  return { provider, model, apiKey, baseUrl };
}

function defaultModel(provider: Provider): string {
  if (provider === 'anthropic') return 'claude-sonnet-4-20250514';
  if (provider === 'ollama')    return 'llama3.1';
  return 'gpt-4o';
}

// ─── Clients ──────────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
let _openai: OpenAI | null = null;

function getAnthropicClient(cfg: ProviderConfig): Anthropic {
  if (_anthropic) return _anthropic;
  if (!cfg.apiKey) throw new Error(
    'no anthropic api key — run lumen setup to add one\n  or set ANTHROPIC_API_KEY in your environment'
  );
  _anthropic = new Anthropic({ apiKey: cfg.apiKey });
  return _anthropic;
}

function getOpenAICompatibleClient(cfg: ProviderConfig): OpenAI {
  if (_openai) return _openai;
  const baseURL = cfg.baseUrl ?? (cfg.provider === 'ollama' ? 'http://localhost:11434/v1' : undefined);
  _openai = new OpenAI({
    apiKey: cfg.apiKey ?? 'ollama',  // Ollama ignores the key but the SDK requires one
    baseURL,
  });
  return _openai;
}

// ─── Core call ────────────────────────────────────────────────────────────────

async function callLLM(
  type: 'ask' | 'plan',
  system: string,
  userMessage: string,
  maxTokens: number
): Promise<string> {
  const cfg = resolveProvider();

  // Strip PII before anything leaves the machine
  const safeSystem  = redact(system);
  const safeMessage = redact(userMessage);

  let result: string;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;

  if (cfg.provider === 'anthropic') {
    const client = getAnthropicClient(cfg);
    const res = await client.messages.create({
      model: cfg.model,
      max_tokens: maxTokens,
      system: safeSystem,
      messages: [{ role: 'user', content: safeMessage }],
    });
    const block = res.content[0];
    if (block.type !== 'text') throw new Error('unexpected response type from anthropic');
    result = block.text;
    promptTokens     = res.usage?.input_tokens;
    completionTokens = res.usage?.output_tokens;
  } else {
    const client = getOpenAICompatibleClient(cfg);
    const res = await client.chat.completions.create({
      model: cfg.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: safeSystem },
        { role: 'user',   content: safeMessage },
      ],
    });
    result = res.choices[0]?.message?.content ?? '';
    promptTokens     = res.usage?.prompt_tokens;
    completionTokens = res.usage?.completion_tokens;
  }

  logAiCall({ type, provider: cfg.provider, model: cfg.model, promptTokens, completionTokens });
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function askLumen(question: string, ctx: HealthContext): Promise<string> {
  const userContext = buildUserContext(ctx);
  return callLLM('ask', buildSystemPrompt(), `${userContext}\n\n---\n\n${question}`, MAX_TOKENS);
}

export async function generateDailyPlan(ctx: HealthContext): Promise<string> {
  const userContext = buildUserContext(ctx);
  const planPrompt = `Based on the health data and profile above, generate a comprehensive daily plan for today.

Structure your response as:

## Morning Assessment
[Brief interpretation of today's recovery and sleep data]

## Recommended Training
[Specific workout based on recovery score and goals. Include: type, duration, intensity]

## Nutrition Plan
[3 meals + optional snack. Specific foods, approximate portions, timing]

## Recovery Priorities
[Top 2-3 specific actions based on the data]

## Evening Optimization
[Sleep preparation to optimize tomorrow's recovery]

## Next Action
[The single most important thing to do in the next 30 minutes]`;

  return callLLM('plan', buildSystemPrompt(), `${userContext}\n\n---\n\n${planPrompt}`, PLAN_MAX_TOKENS);
}

export function getActiveProvider(): string {
  const cfg = resolveProvider();
  return `${cfg.provider} · ${cfg.model}`;
}
