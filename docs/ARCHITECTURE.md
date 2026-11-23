# Architecture

## Layers and the dependency rule

```
app  ─────────────▶ presentation ─┐
 │                                ├──▶ application ──▶ domain
 └──────▶ infrastructure ─────────┘
shared  (leaf: any layer may import it; it imports nothing)
```

Source code dependencies point inward only. The rule is enforced by ESLint (`no-restricted-imports` in `eslint.config.js`), so a violation fails `npm run lint` and CI.

| Layer | Contains | May import | Must not import |
|---|---|---|---|
| `domain` | Entities, value types, pure rules (HLC, LWW merge, KDF policy, AAD) | `shared` | everything else; React, idb, hash-wasm |
| `application` | Use cases and **ports** (interfaces) | `domain`, `shared` | `infrastructure`, `presentation`, `app`; any UI or platform library |
| `infrastructure` | **Adapters** that implement ports: WebCrypto, Argon2, IndexedDB, GitHub API, CSV | `application`, `domain`, `shared`, `idb`, `hash-wasm` | `presentation`, `app`, React |
| `presentation` | React components, hooks, state, React Flow views | `application`, `domain`, `shared`, React | `infrastructure`, `app`, `idb`, `hash-wasm` |
| `app` | Composition root: builds adapters, injects them into use cases, mounts React | everything | n/a |
| `shared` | `Result`, small helpers | nothing | every layer |

`src/domain/shared/` holds domain primitives (ids, clocks). `src/shared/` holds generic utilities with no domain meaning.

## Folder map

```
src/
├── app/               main.tsx, App.tsx, composition root
├── domain/
│   ├── shared/        branded ids, HLC and LWW types
│   ├── family/        FamilyTree, FamilyMember, Relationship, PartialDate
│   ├── user/          UserAccountRecord, UserProfile, login normalisation
│   ├── security/      envelope/payload types, KDF policy, AAD builders
│   └── sync/          Operation, SyncMetadata
├── application/
│   ├── ports/         CryptoPorts now; repositories, SyncPort, Clock, IdGenerator later
│   └── usecases/      account/ tree/ member/ relationship/ sync/ importExport/
├── infrastructure/
│   ├── crypto/        WebCrypto + Argon2 adapters
│   ├── persistence/   IndexedDB repositories (encrypted at rest)
│   ├── sync/github/   Contents API client and remote layout
│   ├── csv/           CSV reader/writer
│   └── system/        clock, UUID generation
├── presentation/
│   ├── components/    shared UI pieces
│   ├── features/      auth, trees, members, relationships, sync, settings
│   ├── tree-view/     React Flow canvas, layout, relationship colours
│   ├── state/         UI stores
│   ├── hooks/
│   └── styles/
└── shared/            result.ts
```

Tests live next to the code (`*.test.ts`). Pure domain and application code is tested in Node; infrastructure tests use `fake-indexeddb`; component tests use jsdom via a per-file `// @vitest-environment jsdom`.

## Conventions

- **Use cases are factories of functions.** `createX(deps) => (input) => Promise<Result<Output, XError>>`. Dependencies are ports passed in, so tests substitute in-memory fakes.
- **Expected failures are values** (`Result` with a typed error union). Exceptions are for bugs and unrecoverable states.
- **Cross-layer imports use aliases** (`@domain/...`); imports inside a layer are relative.
- **Domain is pure and immutable**: no `Date.now()`, no `Math.random()`, no `crypto`. Time and ids arrive through ports.
- **Types do the documentation**: `readonly` everywhere, branded ids, discriminated unions, exhaustive `switch`.
- **One writer per remote file**, which is what avoids sync conflicts (see `SECURITY.md`).

## Tooling decisions

| Concern | Choice | Why |
|---|---|---|
| Build | Vite 7 | Fast, static output, first-class React support |
| Types | `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, no unused code | Catches the bug classes that matter for merge logic |
| Lint | ESLint flat config, `strictTypeChecked` | Type-aware rules; built-in rules enforce layers instead of an extra plugin (one fewer dependency) |
| Security lint | Bans `localStorage`, `Math.random`, `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `console.log` | Mechanically enforces `SECURITY.md` rules |
| Format | Prettier | No style debates |
| Tests | Vitest | Same config as Vite, fast |
| Dependencies | Added only in the phase that uses them; `.npmrc` disables install scripts and saves exact versions; `npm ci` in CI | Smaller supply-chain surface (threat A3) |

## Not decided yet (later phases)

- UI state library (Zustand is the likely choice; decided in the presentation phase so it is not installed unused).
- Graph layout library (`dagre` vs `elkjs`; decided in the visualization phase).
- Remote file batching details (synchronization phase).
