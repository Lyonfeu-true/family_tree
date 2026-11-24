# Family Tree

A private, end-to-end encrypted family-tree app for 1-3 trusted users. Static frontend only: no backend, no database. Data is encrypted in the browser and synchronised as ciphertext through a private GitHub repository.

## Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): layers, dependency rule, conventions
- [docs/SECURITY.md](docs/SECURITY.md): threat model, key hierarchy, limitations

## Getting started

Requires Node 22 (`nvm use`).

```bash
npm install        # first time only; commit the generated package-lock.json
npm run dev        # local development server
npm run check      # typecheck + lint + format check + tests
npm run build      # production build into dist/
```

Dependency install scripts are disabled in `.npmrc` on purpose. If a future package needs one, allow it explicitly and review it.

## Two repositories

1. **This code repository.** Contains no secrets and no family data, so it may be public or private.
2. **A separate private data repository** that stores only ciphertext. Each user creates a fine-grained token limited to that repository (Contents: read/write).

## Status

| Phase | State |
|---|---|
| 1 Architecture | done |
| 2 Data model | done |
| 3 Security design | done |
| 4 Project structure | done |
| 5-10 | pending |
