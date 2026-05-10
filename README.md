# Lumen

**Other health apps show you your data. Lumen tells you what to do about it.**

The open-source AI health advisor that turns your WHOOP and Garmin data into your next move — running entirely on your machine.

[![npm version](https://img.shields.io/npm/v/lumen-health.svg)](https://www.npmjs.com/package/lumen-health)
[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/rjcuff/lumen-health?style=social)](https://github.com/rjcuff/lumen-health)

---

```
$ lumen status

saturday, may 10

recovery 78/100 · hrv 62ms · rhr 52bpm
sleep 84/100 · 7h 5m · 91% efficient

███░░░░░░░░░░░░░  deep   1h 18m  18%
████░░░░░░░░░░░░  rem    1h 35m  22%
█████████░░░░░░░  light  4h 12m  60%

lumen · whoop · lumen ask "..." for insights

$ lumen ask "am I ready to train hard today?"

"am I ready to train hard today?"

Your recovery score of 78 and HRV of 62ms both sit in the green, but
your deep sleep was only 18% of total — below the 20% threshold where
full neuromuscular recovery is confident. You're cleared for high
intensity, but I'd cap the session at 75 minutes and skip a second
workout today if you were considering one.

Next action: go ahead and train — aim for 70–75% max effort for the
first 10 minutes before pushing harder.
```

## Why Lumen

Every fitness tracker shows you your scores. None of them tell you what to do about a 44 recovery day, why your HRV dropped this week, or whether you should train hard or rest tomorrow. Lumen closes that loop.

Tell Lumen your goals and context once. From then on, every answer is a specific recommendation grounded in your actual biometric data — not generic advice.

| Generic AI | Lumen |
|---|---|
| "Make sure to get enough sleep and stay hydrated." | "Your HRV dropped 18ms over 3 days. That's a parasympathetic suppression pattern — likely accumulated fatigue. Cut intensity by 40% today and prioritize 8+ hours tonight." |
| "Recovery depends on many individual factors." | "Recovery 44. Two consecutive high-strain days (15.2, 16.1) with only 5h 50m sleep. Your body is telling you to stop. Active recovery only today." |

## Features

- **AI advisor** — ask anything about your health data in plain English
- **Daily readiness score** — 0–100 score with streaks and achievements
- **Full 7-day history** — recovery, sleep, HRV, strain in one clean table
- **Personalized daily plans** — workout, nutrition, recovery, sleep prep
- **Persistent memory** — tell Lumen things once, it factors them in forever
- **PII redaction** — your name never reaches the AI. fully auditable.
- **Multi-provider AI** — Anthropic Claude, OpenAI, or Ollama (free, fully local)
- **Local-first** — everything in `~/.lumen/db.sqlite`. no cloud, no accounts

## Install

```bash
npm install -g lumen-health
```

## Try It

No WHOOP or Garmin? Try the demo first:

```bash
lumen demo      # seed 7 days of realistic fake data
lumen status    # today's summary
lumen history   # 7-day table
lumen score     # readiness score + streaks
lumen ask "am I ready to train hard today?"
lumen plan      # full personalized day plan
```

## Quick Start

```bash
lumen setup
```

The setup wizard covers everything in one flow:
1. Your profile (age, height, weight, goal, activity level)
2. AI provider — Ollama (free, local), Anthropic, or OpenAI
3. Connect a device — WHOOP or Garmin

Then:

```bash
lumen sync      # pull your data
lumen status    # see today
```

## Commands

| Command | Description |
|---|---|
| `lumen setup` | First-time setup wizard |
| `lumen setup --reset` | Re-run setup |
| `lumen link whoop` | Connect WHOOP via OAuth |
| `lumen link garmin` | Connect Garmin Connect |
| `lumen sync` | Pull latest data from all devices |
| `lumen status` | Today's recovery, sleep, and strain |
| `lumen history` | Last 7 days |
| `lumen score` | Readiness score, streaks, achievements |
| `lumen ask "..."` | Ask your AI health advisor |
| `lumen plan` | Generate a full personalized day plan |
| `lumen remember "..."` | Save context for the AI |
| `lumen doctor` | Check setup status |
| `lumen demo` | Seed demo data — no device needed |

## AI Providers

| Provider | Cost | Quality | Setup |
|---|---|---|---|
| **Ollama** | Free | Good | Install from ollama.com, run `ollama serve` |
| **Anthropic** | ~$0.01/query | Best | API key from console.anthropic.com |
| **OpenAI** | ~$0.01/query | Very good | API key from platform.openai.com |

Configure during `lumen setup` or via environment variables — see `.env.example`.

## Privacy

Lumen makes outbound calls to exactly three services: WHOOP, Garmin, and your AI provider. That's it.

- Your name and any PII are stripped before anything reaches the AI
- Every AI call is logged locally — run `lumen score` to see the full audit log
- No telemetry. No analytics. No Lumen servers.

See [SECURITY.md](SECURITY.md) for full details.

## How It Works

```
WHOOP API · Garmin Connect
         │
    lumen sync
         │
  ~/.lumen/db.sqlite
         │
    lumen ask "..."
         │
  PII redaction layer
         │
  AI provider (Anthropic / OpenAI / Ollama)
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). PRs welcome — open an issue first for large changes.

## License

MIT — see [LICENSE](LICENSE).
