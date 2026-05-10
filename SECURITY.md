# Security

## Architecture

Lumen is local-first. All health data is stored on your machine. There are no Lumen servers.

### Data Flow

Lumen makes outbound calls to exactly three services:

| Service | Purpose | When |
|---------|---------|------|
| WHOOP API | Sync recovery, sleep, strain | `lumen sync`, `lumen link whoop` |
| Garmin Connect | Sync activity, sleep, HR | `lumen sync`, `lumen link garmin` |
| AI provider | Chat responses (PII-masked) | `lumen ask`, `lumen plan` |

No telemetry. No analytics. No data sent to Lumen servers because there are no Lumen servers.

### PII Handling

Before anything is sent to an AI provider, Lumen strips personally identifiable information:

- Your name is replaced with `[USER]`
- Any names found in your memory notes are replaced with `[CONTACT]`
- SSNs, credit card numbers, and account numbers are replaced with `[SSN]`, `[CARD]`, `[ACCT]`

You can audit every AI call with `lumen score` — it shows what was called, when, and how many tokens were used.

### Local Storage

All data lives in `~/.lumen/`:

```
~/.lumen/
  db.sqlite    # SQLite database — profile, health data, config, AI audit log
```

The database uses Node.js built-in SQLite (`node:sqlite`). The file is readable only by your user account.

### Credentials

- **WHOOP OAuth tokens** — stored in the local SQLite database
- **Garmin credentials** — stored in the local SQLite database (never transmitted except to Garmin's servers)
- **AI API keys** — stored in the local SQLite database or read from environment variables

## Reporting a Vulnerability

If you find a security issue, please do not open a public GitHub issue.

1. Email the maintainer with details
2. Include steps to reproduce if possible
3. Allow 48 hours for a response

We will address confirmed vulnerabilities before any public disclosure.
