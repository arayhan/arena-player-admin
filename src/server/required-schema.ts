/**
 * The declarative expectation `pnpm check:schema` asserts against live Supabase Postgres.
 *
 * This file is the ONLY place that expectation is written down. It is never
 * used to create anything — this repo may not run DDL (CLAUDE.md hard rule
 * 1) — only to describe what the migration in `arena-player-web/db/migrations/`
 * is supposed to have produced, so `scripts/check-schema.test.ts` can compare
 * it against `information_schema` / `pg_indexes` / `pg_get_constraintdef`.
 *
 * Deliberately NOT deduplicated with a Postgres `DOMAIN`. A `DOMAIN` would
 * need `alter column type` on `bookings` — a hand-run, destructive change to
 * the one table the entire anti-double-booking guard sits on. Duplicating
 * the nine slot literals here (imported from `src/domain/slots.ts`, so this
 * file and the source can never drift from EACH OTHER) and detecting drift
 * against the database at check time is the whole point: it trades a
 * dangerous refactor for an always-on comparison. See docs/database.md and
 * docs/architecture.md, "The schema guard" / "Web owns db/migrations/".
 */
import "server-only";

import { ACTIVE_STATUSES, BOOKING_STATUSES } from "@/domain/status";
import { TIME_SLOTS } from "@/domain/slots";

export interface RequiredColumn {
  /** Column name, as it appears in `information_schema.columns.column_name`. */
  name: string;
  /** Expected `information_schema.columns.data_type` value. */
  dataType: string;
  /** Expected `information_schema.columns.is_nullable === 'NO'` iff this is false. */
  nullable: boolean;
}

export interface RequiredIndex {
  /** Index name, matched against `pg_indexes.indexname`. */
  name: string;
  unique: boolean;
  /** Leading columns, in order, that the index's `indexdef` must mention. */
  columns: readonly string[];
  /**
   * Substrings the partial predicate (the `where …` clause in `indexdef`)
   * must all contain. Matched loosely on purpose — Postgres round-trips a
   * `where` clause through its own pretty-printer, adding parentheses and
   * `::text` casts nobody hand-wrote, so this checks for the values that
   * matter rather than a byte-exact clause. `undefined` means the index is
   * not partial and `indexdef` must contain no `where`.
   */
  wherePredicateContains?: readonly string[];
}

export type RequiredCheckConstraint =
  | {
      kind: "enum-set-equal";
      /** Constraint name, matched against `pg_constraint.conname`. */
      name: string;
      /**
       * The literals inside this CHECK's `in (...)` list, read out of
       * `pg_get_constraintdef`, must be SET-EQUAL (not merely a subset, not
       * merely the same length) to this list. This is assertion 3 from
       * docs/database.md — the one no check in either repo did before this
       * file: source (`src/domain/slots.ts`) against the LIVE database,
       * proving the migration was actually run, and run unedited.
       */
      expectedLiterals: readonly string[];
    }
  | {
      kind: "enum-subset";
      name: string;
      /**
       * `status_valid` allows exactly these four values — checked as
       * set-equality too, since a fifth silently-added status (or a missing
       * one) is exactly the kind of drift this check exists to catch.
       */
      expectedLiterals: readonly string[];
    }
  | {
      kind: "max-length";
      name: string;
      /** The numeric bound the CHECK's `length(...) <= N` must contain. */
      maxLength: number;
    };

export interface RequiredTable {
  name: string;
  columns: readonly RequiredColumn[];
  indexes: readonly RequiredIndex[];
  checkConstraints: readonly RequiredCheckConstraint[];
}

/**
 * `bookings` — from `arena-player-web/db/migrations/20260809_create_bookings.sql`.
 * This repo never migrated it; see docs/database.md for the full DDL, which
 * is intentionally not pasted here (a second copy is a second authority).
 */
const BOOKINGS: RequiredTable = {
  name: "bookings",
  columns: [
    { name: "id", dataType: "uuid", nullable: false },
    { name: "booking_date", dataType: "date", nullable: false },
    { name: "time_slot", dataType: "text", nullable: false },
    { name: "team_name", dataType: "text", nullable: false },
    { name: "phone", dataType: "text", nullable: false },
    { name: "notes", dataType: "text", nullable: true },
    { name: "proof_key", dataType: "text", nullable: true },
    { name: "status", dataType: "text", nullable: false },
    { name: "created_at", dataType: "timestamp with time zone", nullable: false },
  ],
  indexes: [
    {
      // The ONLY anti-double-booking guard in the system. Partial on
      // ACTIVE_STATUSES — mirrors src/domain/status.ts, which mirrors this.
      name: "uniq_active_slot",
      unique: true,
      columns: ["booking_date", "time_slot"],
      wherePredicateContains: ACTIVE_STATUSES,
    },
    {
      // Supports the lazy-expiry / oldest-pending-age read. Not unique.
      name: "bookings_pending_expiry_idx",
      unique: false,
      columns: ["booking_date", "created_at"],
      wherePredicateContains: ["pending"],
    },
  ],
  checkConstraints: [
    {
      kind: "enum-set-equal",
      name: "time_slot_canonical",
      expectedLiterals: TIME_SLOTS,
    },
    {
      kind: "enum-subset",
      name: "status_valid",
      expectedLiterals: BOOKING_STATUSES,
    },
    {
      kind: "max-length",
      name: "notes_length",
      maxLength: 500,
    },
  ],
};

/**
 * `slot_blocks` — Phase 4. Requested in
 * docs/schema-requests/001-slot-blocks.md, not yet applied anywhere. Added
 * here per that request's own "Verification" section, NOT in
 * `scripts/check-schema.test.ts` — the check stays generic over
 * `REQUIRED_TABLES`, so a future table costs an entry here, not a new
 * assertion block in the check itself.
 */
const SLOT_BLOCKS: RequiredTable = {
  name: "slot_blocks",
  columns: [
    { name: "id", dataType: "uuid", nullable: false },
    { name: "block_date", dataType: "date", nullable: false },
    { name: "time_slot", dataType: "text", nullable: false },
    { name: "reason", dataType: "text", nullable: true },
    { name: "created_at", dataType: "timestamp with time zone", nullable: false },
  ],
  indexes: [
    {
      name: "uniq_slot_block",
      unique: true,
      columns: ["block_date", "time_slot"],
      // Not partial: a block has no lifecycle, it exists or it does not.
    },
  ],
  checkConstraints: [
    {
      kind: "enum-set-equal",
      name: "slot_blocks_time_slot_canonical",
      expectedLiterals: TIME_SLOTS,
    },
    {
      kind: "max-length",
      name: "slot_blocks_reason_length",
      maxLength: 200,
    },
  ],
};

/**
 * `rate_card` and `public_holidays` — Phase 6. Requested (and, for
 * `public_holidays`, added by amendment) in
 * docs/schema-requests/003-site-settings.md.
 */
const RATE_CARD: RequiredTable = {
  name: "rate_card",
  columns: [
    { name: "id", dataType: "uuid", nullable: false },
    { name: "time_slot", dataType: "text", nullable: false },
    { name: "day_type", dataType: "text", nullable: false },
    { name: "price_rupiah", dataType: "integer", nullable: false },
    { name: "updated_at", dataType: "timestamp with time zone", nullable: false },
  ],
  indexes: [
    {
      name: "uniq_rate_card_slot",
      unique: true,
      columns: ["time_slot", "day_type"],
    },
  ],
  checkConstraints: [
    {
      kind: "enum-set-equal",
      name: "rate_card_time_slot_canonical",
      expectedLiterals: TIME_SLOTS,
    },
    {
      kind: "enum-subset",
      name: "rate_card_day_type_valid",
      expectedLiterals: ["weekday", "weekend"],
    },
  ],
};

const PUBLIC_HOLIDAYS: RequiredTable = {
  name: "public_holidays",
  columns: [
    { name: "id", dataType: "uuid", nullable: false },
    { name: "holiday_date", dataType: "date", nullable: false },
    { name: "label", dataType: "text", nullable: false },
    { name: "created_at", dataType: "timestamp with time zone", nullable: false },
  ],
  indexes: [],
  checkConstraints: [
    {
      kind: "max-length",
      name: "public_holidays_label_length",
      maxLength: 100,
    },
  ],
};

export const REQUIRED_TABLES: readonly RequiredTable[] = [
  BOOKINGS,
  SLOT_BLOCKS,
  RATE_CARD,
  PUBLIC_HOLIDAYS,
];
