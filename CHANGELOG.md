# Changelog

## 1.0.0

### Features
- `lumen setup` — guided wizard: profile, AI provider, device connection in one flow
- `lumen status` — today's recovery, sleep, strain, HRV, resting HR
- `lumen history` — 7-day table of all key metrics
- `lumen ask "..."` — AI health advisor grounded in your real biometric data
- `lumen plan` — AI-generated personalized daily plan
- `lumen sync` — pull latest data from WHOOP and/or Garmin
- `lumen score` — daily readiness score (0–100), streaks, achievements, AI audit log
- `lumen remember "..."` — persistent memory injected into every AI response
- `lumen doctor` — setup status checker
- `lumen demo` — seed realistic fake data, no device required
- `lumen link whoop` — WHOOP OAuth 2.0 with local credential storage
- `lumen link garmin` — Garmin Connect with local credential storage
- Multi-provider AI: Anthropic Claude, OpenAI, Ollama (free, fully local)
- PII redaction before any data leaves the machine
- Full AI audit log: every call logged locally with provider, model, token count
- All data stored in `~/.lumen/db.sqlite` — nothing in the cloud
