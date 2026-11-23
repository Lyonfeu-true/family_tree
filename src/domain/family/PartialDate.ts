import type { Brand } from "../shared/ids";

/**
 * ISO-8601 date with optional precision: `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
 *
 * Genealogy rarely has full dates ("born 1923"), so a strict Date would force
 * users to invent data. Strings sort correctly and survive CSV round trips.
 * Validation lives in `parsePartialDate` (added with the use cases).
 */
export type PartialDate = Brand<string, "PartialDate">;
