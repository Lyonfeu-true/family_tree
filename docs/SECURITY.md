# Security Design

Status: Phase 3 design. Implementation follows in the core and synchronization phases.

## 1. Assets and goals

| Asset | Examples | Goal |
|---|---|---|
| Family data | names, dates, notes, photos, relationships | Confidentiality, integrity |
| Keys | account key, private key, tree keys | Never leave the device in usable form |
| Secrets | passwords, recovery code, GitHub token | Never stored or transmitted in plaintext |

Goal: a party who obtains the entire repository, and the hosting account's logs, learns nothing about the family beyond coarse metadata.

## 2. Assumptions

1. The browser's WebCrypto implementation and the user's browser/OS are not compromised.
2. The JavaScript served from the app's origin is the code we built. This is the weakest assumption in any web-delivered encrypted app (see threat A3).
3. Users choose strong passwords and keep their recovery code safe.
4. All 1-3 users are trusted: they can read and edit everything in the trees they belong to.
5. GitHub and Cloudflare are NOT trusted with plaintext. We rely on them only for availability.

## 3. Threat model

| ID | Adversary | Capability | Mitigations | Residual risk |
|---|---|---|---|---|
| A1 | Passive repository reader (GitHub, breach, leaked read token) | Sees all repo files, commit times, sizes | AES-256-GCM everywhere; random file names; no plaintext logins | Metadata: number of users/trees/devices, activity times, photo sizes |
| A2 | Active repository writer (stolen write token) | Delete, truncate, roll back, replay, corrupt files; add junk accounts | AEAD with AAD binding (cannot forge or move ciphertext); per-device seq numbers detect truncation/rollback; git history allows recovery; accounts without grants read nothing | Denial of service and rollback to an older valid state until noticed |
| A3 | Hosting or supply-chain compromise (Cloudflare account takeover, malicious npm package) | Serve modified JS that steals the password | Strict CSP, pinned lockfile, `npm ci`, few dependencies, CI-only deploys, 2FA on GitHub and Cloudflare, branch protection | **Cannot be eliminated.** Mitigate with operational hygiene |
| A4 | XSS via stored data (names, notes, CSV import) | Run script in the app origin and use unlocked keys | React escaping, no `dangerouslySetInnerHTML`, notes rendered as text, CSP without `unsafe-inline`/`unsafe-eval`, Trusted Types, strict CSV parsing, spreadsheet-formula neutralisation on export | A CSP bypass in a dependency |
| A5 | Lost or stolen device | Reads IndexedDB offline | Local state, token and keys are encrypted at rest; keys held only in memory; auto-lock | An unlocked, unattended session is exposed |
| A6 | Offline password cracker | Has account envelope from the repo | Argon2id 64 MiB x3 (PBKDF2 600k fallback), password strength gate, optional passphrase guidance | A weak password falls; this is the main cryptographic dependency |
| A7 | Removed or departed member | Keeps old keys, old token, git history | Rotation of the tree key; token revocation by repo owner | **Everything up to rotation stays readable to them forever** |
| A8 | Insider mistakes or malice | A member writes bad or forged operations | Trusted-user assumption; HLC future-skew rejection; git history | Operations are not individually signed, so `authorId` is not authenticated |
| A9 | Phishing / look-alike domain | User types password into a fake site | Dedicated custom domain, HSTS preload | Human factor |
| A10 | Network attacker | MITM | HTTPS, HSTS, `connect-src` limited to `api.github.com` | None beyond TLS |
| A11 | Malicious import file | Oversized, malformed or formula-laden CSV | Size and row limits, schema validation, no HTML rendering, CSV export prefixes `= + - @` cells with `'` | Resource exhaustion on very large files |

Out of scope: malware on the user's device, malicious browser extensions, coercion, side channels in the CPU or browser.

## 4. Key hierarchy

```
password ──Argon2id/PBKDF2──▶ passwordKey ──unwraps──▶ AccountKey (random 256-bit AES)
recovery code ──HKDF──────▶ recoveryKey ──unwraps──▶ AccountKey (same key)

AccountKey ──decrypts──▶ privateKey (ECDH P-256)  and  profile {login, displayName}
AccountKey ──encrypts──▶ local SyncConfig {repo, token}

tree key (random 256-bit AES, versioned)
   sealed to each member's publicKey  ──▶ TreeKeyGrant (one file per recipient and version)
   encrypts: operation batches, snapshots, photos, roster, local tree state
```

Design rules:
- **Random keys, derived wrappers.** Passwords only unlock a random AccountKey. Changing the password re-wraps one key and re-encrypts nothing else.
- **Per-purpose AAD** (`domain/security/aad.ts`) binds each ciphertext to tree, key version, file and user.
- **Fresh 96-bit random IV** for every encryption. Volume is far below the 2^32 messages-per-key limit that makes random IVs unsafe; rotation resets the counter anyway.
- **Versioned formats.** Every payload carries `version`, so algorithms can change later.

### Parameters

| Item | Choice | Reason |
|---|---|---|
| Password KDF | Argon2id, 64 MiB, 3 iterations, 1 lane (`hash-wasm`) | Memory-hard, above OWASP minimum, still ~1-2 s on phones |
| KDF fallback | PBKDF2-HMAC-SHA256, 600,000 iterations (native WebCrypto) | Only if WASM is unavailable. The envelope records which was used |
| Recovery code | 160 random bits, Base32, HKDF-SHA256 | High entropy, so no slow KDF needed |
| Symmetric cipher | AES-256-GCM | WebCrypto native, authenticated |
| Key sharing | ECDH P-256 + HKDF + AES-GCM (sealed box) | P-256 is supported by every browser; X25519 is not yet universal |
| Bounds on read | Reject KDF params outside `KDF_BOUNDS` | Stops weakened or memory-bomb envelopes (`kdfPolicy.ts`) |

Password policy: at least 12 characters and a strength estimate of 3/4 or better (lazy-loaded `@zxcvbn-ts/core`). Recommend a 5+ word passphrase.

## 5. Account lifecycle

**Create account.** Generate AccountKey and an ECDH key pair; derive the password key; store `UserAccountRecord`. Generate and display the recovery code once and require the user to confirm they saved it. The first account on a repository creates trees and their keys.

**Log in.** Download `vault/accounts/*` (cached locally for offline use). For each record (at most 8 are tried), derive the key with its KDF params and attempt to unwrap. On success, decrypt the profile and compare `normalizeLogin(typed)` with it. A wrong login, wrong password, tampered or foreign record all produce the same generic error. A last-used `userId` is tried first. The wrapped-key AEAD tag means no password hash is ever stored.

**Change password.** Re-enter the old password, unwrap AccountKey as extractable, wrap it under the new password key, and write the new envelope. The AccountKey itself does not change.

**Change login.** Re-authenticate, re-encrypt the profile. Nothing else changes.

**Delete account.** Remove the account file, that user's grants and their roster entry, and the local data. Offer to rotate each shared tree key.

**Forgot password.** Log in with login + recovery code (HKDF path), then set a new password and a new recovery code. If both are lost but another member remains, they can re-grant the tree keys to a new account of the same person, so data is recoverable as long as one member still holds it.

**Sensitive operations** (change password, share, rotate, show recovery) always re-prompt for the password. Keys are non-extractable during normal use and unwrapped as extractable only for these operations.

## 6. Sharing and revocation

Tree keys are distributed with public-key sealing, not invite codes.

| Option | Pros | Cons |
|---|---|---|
| Invite code sent out of band | Simple, no public keys | Cannot re-grant after rotation without a new code for every user; code leakage grants the key |
| **Public-key grants (chosen)** | Any key holder can grant or re-grant without the recipient being online; rotation works naturally | Needs key verification to stop key substitution |

**Granting access.** The new user registers an account (public key only, no access yet). An existing member sees them as "pending" with a **fingerprint** and must confirm it with the person over another channel (phone, in person) before sealing the tree key to that public key. This prevents an attacker with write access from injecting their own account and being approved blindly.

**Roster.** Each grant also writes `trees/<id>/roster/<userId>.enc`, an encrypted record of the member's public key. Only tree-key holders can create it, so a repository writer cannot swap a member's public key before a rotation.

**Revocation (rotation).** Create tree key version N+1; compact the current state into a fresh snapshot encrypted under it; seal N+1 to each remaining roster member; stop accepting writes under version N. Then the owner removes the departed person's GitHub access and token.

**What rotation does NOT do.** The removed person already holds key N and can read everything encrypted under it, including old git history, indefinitely. Rotation only protects data written after it. This is inherent to a no-server design.

## 7. What lives where

Repository (private), ciphertext except where marked:

```
vault/accounts/<userId>.json                    account record (plaintext public key and KDF params; secrets wrapped)
vault/grants/<treeId>/<userId>.v<N>.json        sealed tree key; written once by the granter
trees/<treeId>/roster/<userId>.enc              member public keys
trees/<treeId>/ops/<deviceId>/<first>-<last>.enc   immutable operation batches
trees/<treeId>/snapshots/<snapshotId>.enc
trees/<treeId>/photos/<photoId>.enc
```

Every file has exactly one writer (or is written once), which is also what avoids sync conflicts. GitHub can observe: user, tree and device ids (random), file counts and sizes, and timestamps. It cannot observe names, logins, dates, relationships or photos.

Device (IndexedDB), all encrypted: cached account records (already wrapped), `SyncConfig` {repo, token} under AccountKey, tree state under the tree key, sync cursors (no secrets).

## 8. GitHub token handling

- Fine-grained personal access token, restricted to the single data repository, **Contents: read/write only**, with an expiry.
- Typed once per device into memory, then stored encrypted under the AccountKey. Never written to the repository, `localStorage` or logs.
- Only ever sent to `https://api.github.com` (enforced by `connect-src`).
- A fresh device needs repo name + token before it can fetch account records. If the password was changed on another device and this device's cached record is stale, login offers "Reconnect repository" (re-enter repo + token).

## 9. Browser hardening

`public/_headers` (Cloudflare Pages) sets:
- CSP: `default-src 'none'`; scripts from self plus `'wasm-unsafe-eval'` (needed only for Argon2 WASM, not for `eval`); `connect-src` limited to self and `api.github.com`; no framing; `require-trusted-types-for 'script'`.
- HSTS with preload, `nosniff`, `Referrer-Policy: no-referrer`, COOP/CORP same-origin, minimal `Permissions-Policy`, `noindex`.

Operational rules: dedicated domain (no other apps on it), 2FA and hardware keys on GitHub and Cloudflare, deploy only from CI on a protected branch, commit `package-lock.json`, review dependency updates, run `npm audit` in CI.

Session handling: auto-lock after 15 minutes idle (configurable), lock when the tab has been hidden for 5 minutes, explicit Lock button. "Stay unlocked on this device" is off by default.

## 10. Known limitations

1. **A3 is the core weakness.** If the delivered JavaScript is replaced, passwords can be stolen. Mitigation is process, not cryptography. For maximum assurance, run the built app from a local file or a self-hosted copy you control.
2. **Removed users keep old data** (section 6).
3. **Weak passwords are crackable offline** by anyone who has the repository.
4. **Changing a password does not rotate the AccountKey.** If a password was compromised, an attacker with git history can still unwrap an old envelope. A "compromise reset" (new AccountKey, new key pair, re-grant) is planned as a separate use case.
5. **Rollback and truncation by a repo writer** can be detected only against what this device has already seen (per-device seq cursors); a brand-new device cannot tell.
6. **Operations are not individually signed**, so one member could impersonate another. Acceptable under the trusted-user assumption.
7. **A clock far in the future** would win every last-writer-wins conflict. Operations whose HLC is more than 24 hours ahead of the local clock are quarantined and reported.
8. **JavaScript cannot reliably wipe memory.** Locking drops key references, but keys may linger until garbage collection.
9. **Unencrypted exports.** CSV export is plaintext by design. The UI warns, and an encrypted backup export is recommended alongside it.
10. **Metadata leakage** as listed in section 7. Photo sizes are visible; padding is not implemented.
