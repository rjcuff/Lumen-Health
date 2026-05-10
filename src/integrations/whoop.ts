import axios from 'axios';
import * as http from 'http';
import * as url from 'url';
import * as crypto from 'crypto';
import open from 'open';
import chalk from 'chalk';
import { getToken, upsertToken, getConfig } from '../db/queries';
import {
  normalizeWhoopSleep,
  normalizeWhoopRecovery,
  normalizeWhoopCycle,
  type WhoopSleep,
  type WhoopRecovery,
  type WhoopCycle,
} from '../utils/normalize';
import type { HealthData } from '../db/schema';

const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API_BASE = 'https://api.prod.whoop.com/developer/v1';
const REDIRECT_PORT = 8492;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = 'offline read:recovery read:cycles read:sleep read:profile read:body_measurement';

export interface WhoopCredentials {
  clientId: string;
  clientSecret: string;
}

function getCredentials(): WhoopCredentials {
  const clientId = process.env.WHOOP_CLIENT_ID ?? getConfig('whoop_client_id');
  const clientSecret = process.env.WHOOP_CLIENT_SECRET ?? getConfig('whoop_client_secret');
  if (!clientId || !clientSecret) {
    throw new Error(
      'Whoop app credentials not configured.\n  Run: lumen link whoop  and follow the prompts.'
    );
  }
  return { clientId, clientSecret };
}

// ─── OAuth flow ───────────────────────────────────────────────────────────────

export async function connectWhoop(): Promise<void> {
  const creds = getCredentials();
  const state = crypto.randomBytes(16).toString('hex');

  const authUrl = new URL(WHOOP_AUTH_URL);
  authUrl.searchParams.set('client_id', creds.clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);

  const code = await waitForOAuthCallback(authUrl.toString(), state);
  await exchangeCodeForToken(code, creds);
}

async function waitForOAuthCallback(authUrl: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url ?? '', true);

      if (parsed.pathname !== '/callback') {
        res.writeHead(404);
        res.end();
        return;
      }

      const { code, state, error } = parsed.query as Record<string, string>;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#111;color:#fff">
          <h2 style="color:#6366f1">✓ Lumen connected to WHOOP</h2>
          <p>You can close this window and return to the terminal.</p>
        </body></html>
      `);
      server.close();

      if (error) return reject(new Error(`OAuth error: ${error}`));
      if (state !== expectedState) return reject(new Error('OAuth state mismatch — possible CSRF'));
      if (!code) return reject(new Error('No authorization code received'));

      resolve(code);
    });

    server.listen(REDIRECT_PORT, () => {
      console.log('');
      console.log(`  ${chalk.hex('#6366f1')('ℹ')}  Opening WHOOP authorization in your browser...`);
      console.log(`  ${chalk.hex('#9ca3af')('Listening on')} ${chalk.white(`http://localhost:${REDIRECT_PORT}`)}`);
      console.log('');
      open(authUrl).catch(() => {
        console.log(`  ${chalk.yellow('⚠')}  Could not open browser automatically.`);
        console.log(`  ${chalk.white('Please visit:')} ${chalk.cyan(authUrl)}`);
      });
    });

    server.on('error', reject);

    setTimeout(() => {
      server.close();
      reject(new Error('OAuth timeout — no callback received within 5 minutes'));
    }, 300_000);
  });
}

async function exchangeCodeForToken(code: string, creds: WhoopCredentials): Promise<void> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await axios.post(WHOOP_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in, scope } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  upsertToken({
    provider: 'whoop',
    access_token,
    refresh_token,
    expires_at: expiresAt,
    scope,
  });
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const token = getToken('whoop');
  if (!token) throw new Error('Whoop not connected. Run: lumen link whoop');

  if (token.expires_at && new Date(token.expires_at) < new Date(Date.now() + 60_000)) {
    return refreshAccessToken(token.refresh_token ?? '');
  }

  return token.access_token;
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const creds = getCredentials();

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
  });

  const res = await axios.post(WHOOP_TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  const { access_token, refresh_token, expires_in, scope } = res.data;
  const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  upsertToken({
    provider: 'whoop',
    access_token,
    refresh_token: refresh_token ?? refreshToken,
    expires_at: expiresAt,
    scope,
  });

  return access_token;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function whoopGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await axios.get(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data as T;
}

async function whoopGetAll<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const results: T[] = [];
  let nextToken: string | undefined;

  do {
    const queryParams: Record<string, string> = { limit: '25', ...params };
    if (nextToken) queryParams.nextToken = nextToken;

    const data = await whoopGet<{ records: T[]; next_token?: string }>(path, queryParams);
    results.push(...data.records);
    nextToken = data.next_token;
  } while (nextToken);

  return results;
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

export async function fetchWhoopData(startDate: string, endDate: string): Promise<HealthData[]> {
  const start = new Date(startDate).toISOString();
  const end = new Date(endDate + 'T23:59:59').toISOString();

  const [cycles, recoveries, sleeps] = await Promise.all([
    whoopGetAll<WhoopCycle>('/cycle', { start, end }),
    whoopGetAll<WhoopRecovery>('/recovery', { start, end }),
    whoopGetAll<WhoopSleep>('/activity/sleep', { start, end }),
  ]);

  const items: HealthData[] = [];

  // Map recovery to cycle date for date alignment
  const cycleMap = new Map(cycles.map(c => [c.id, c.start.split('T')[0]]));
  const recoveryByCycle = new Map(recoveries.map(r => [r.cycle_id, r]));

  for (const cycle of cycles) {
    items.push(normalizeWhoopCycle(cycle));
    const recovery = recoveryByCycle.get(cycle.id);
    if (recovery) {
      const date = cycleMap.get(cycle.id) ?? cycle.start.split('T')[0];
      items.push(normalizeWhoopRecovery(recovery, date));
    }
  }

  for (const sleep of sleeps) {
    if (!sleep.nap) {
      items.push(normalizeWhoopSleep(sleep));
    }
  }

  return items;
}

export function isWhoopConnected(): boolean {
  return getToken('whoop') !== null;
}
