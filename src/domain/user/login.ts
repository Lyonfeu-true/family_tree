/** Canonical form used to compare logins: trimmed, Unicode-normalised, case-insensitive. */
export function normalizeLogin(login: string): string {
  return login.normalize('NFKC').trim().toLowerCase();
}
