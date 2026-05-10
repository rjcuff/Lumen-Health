import { getDb } from '../db/schema';

export function logAiCall(opts: {
  type: 'ask' | 'plan';
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO ai_audit_log (type, provider, model, prompt_tokens, completion_tokens, called_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(opts.type, opts.provider, opts.model, opts.promptTokens ?? null, opts.completionTokens ?? null);
}

export interface AuditEntry {
  id: number;
  type: string;
  provider: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  called_at: string;
}

export function getAuditLog(limit = 20): AuditEntry[] {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM ai_audit_log ORDER BY id DESC LIMIT ?'
  ).all(limit) as unknown as AuditEntry[];
}
