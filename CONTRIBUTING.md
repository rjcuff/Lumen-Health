# Contributing

Thanks for your interest in contributing to Lumen.

## Development Setup

```bash
git clone https://github.com/rjcuff/lumen-health.git
cd lumen-health
npm install
npm run build
npm link   # makes 'lumen' available globally
```

Copy `.env.example` to `.env` and fill in credentials, or run `lumen setup` to configure interactively.

You can develop without real WHOOP or Garmin accounts — run `lumen demo` to seed realistic fake data.

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes in `src/`
3. Run `npm run build` to verify it compiles
4. Test with `lumen demo && lumen status`
5. Open a pull request

## Project Structure

```
src/
  commands/     # one file per CLI command
  integrations/ # whoop.ts, garmin.ts
  db/           # schema.ts, queries.ts
  ai/           # agent.ts, prompts.ts, redactor.ts, audit.ts, scoring.ts
  utils/        # normalize.ts, format.ts
index.ts        # CLI entry point
```

## Code Style

- TypeScript strict mode
- CommonJS modules
- No abstractions beyond what the task needs
- No comments unless the WHY is non-obvious

## Reporting Bugs

Open a GitHub issue with:
- What you expected to happen
- What actually happened  
- Steps to reproduce
- Node.js version and OS

## Security Issues

See [SECURITY.md](SECURITY.md). Do not open public issues for security vulnerabilities.
