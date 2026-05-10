import { getProfile, getMemories } from '../db/queries';

interface RedactionEntry {
  real: string;
  token: string;
}

const NUMERIC_PII: [RegExp, string][] = [
  [/\b\d{3}-\d{2}-\d{4}\b/g,           '[SSN]'],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD]'],
  [/\b\d{9,12}\b(?=\s|$|[,.])/g,       '[ACCT]'],
];

function buildRedactions(): RedactionEntry[] {
  const entries: RedactionEntry[] = [];
  const seen = new Set<string>();

  function add(real: string, token: string) {
    const t = real.trim();
    if (t.length < 2 || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    entries.push({ real: t, token });
  }

  const profile = getProfile();
  if (profile && profile.name && profile.name !== 'User' && profile.name !== 'Demo') {
    add(profile.name, '[USER]');
    const parts = profile.name.split(/\s+/);
    if (parts.length > 1) {
      add(parts[0], '[USER_FIRST]');
      add(parts[parts.length - 1], '[USER_LAST]');
    }
  }

  // Also scan memory notes for names people have mentioned
  const memories = getMemories();
  for (const m of memories) {
    const match = m.match(/\b(?:my\s+)?(?:partner|wife|husband|son|daughter|coach|trainer)[:\s]+([A-Z][a-z]+)/i);
    if (match) add(match[1], '[CONTACT]');
  }

  // Sort longest first so "John Smith" replaces before "John"
  entries.sort((a, b) => b.real.length - a.real.length);
  return entries;
}

export function redact(text: string): string {
  const redactions = buildRedactions();
  let result = text;
  for (const { real, token } of redactions) {
    result = result.replaceAll(real, token);
  }
  for (const [pattern, replacement] of NUMERIC_PII) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
