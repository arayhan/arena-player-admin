# 003 — `site_settings` and `bank_accounts`

**Status:** requested
**Unblocks:** admin Phase 2 — the Pengaturan screen, and the revenue estimate in Statistik/Ekspor
**Requires of arena-player-web:** yes — three reads, each replacing a hardcoded constant or a visible placeholder. Not order-critical; see below.

## Why

Four values are shown to customers and owned by nobody:

| Value             | Where it lives today                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| WhatsApp number   | hardcoded — `arena-player-web/src/modules/home/home.constants.ts`, `WHATSAPP_NUMBER = "6289682620666"` |
| Google Maps embed | does not exist — `HomePage.tsx` renders _"Alamat dan titik Google Maps menyusul"_ in a dashed box      |
| Bank accounts     | does not exist — `BookingForm.tsx` renders _"Nomor rekening & nama pemilik menyusul"_                  |
| Rate card         | does not exist anywhere in either repo; the admin mockup holds a `TARIF` constant in client code       |

Every one of them changes without a developer being involved: the field switches bank, the owner changes phone, the client finally supplies the rate card. Today each change is a code edit and a deploy of **two** applications, and the two applications can disagree in between.

**Rejected first: environment variables.** They need no migration, which is genuinely attractive here, but they make the Pengaturan screen a read-only display — the admin still cannot change a bank account without a developer, and the value must be set identically in two deploys. That is the same drift with more steps.

**Rejected second: one JSON blob.** A single settings row holding a JSON array of bank accounts loses the ordering guarantee the customer sees, cannot be constrained, and turns "add a bank account" into read-modify-write with a lost-update race between two admin tabs.

Two tables: one key-value for the singular values, one ordinary table for the list.

## DDL

```sql
-- db/migrations/<timestamp>_create_site_settings.sql
-- Requested by arena-player-admin (docs/schema-requests/003-site-settings.md).
-- ADDITIVE ONLY: bookings is not touched.
-- Run manually in the Neon SQL editor. Never auto-applied.
--
-- Wrapped in a transaction so a half-failed paste cannot leave site_settings
-- created without bank_accounts. The booking page reads both; having one
-- without the other renders a payment page with a bank list and no amount, or
-- an amount and nowhere to send it.
begin;

create table site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),

  -- An allow-list, not free-form config. A typo'd key would otherwise write a
  -- row nothing reads, and the screen would report success while the public
  -- site kept showing the old value.
  constraint site_settings_key_known check (key in (
    'whatsapp_number',   -- wa.me form, digits only, e.g. 6289682620666
    'maps_embed_url',    -- the src of the Google Maps "Embed a map" iframe
    'tariff_normal',     -- rupiah, integer, per 2-hour slot
    'tariff_prime',      -- rupiah, integer, per 2-hour slot
    'dp_percent'         -- integer 1..100
  )),

  constraint site_settings_value_length check (length(value) between 1 and 2000)
);

create table bank_accounts (
  id             uuid primary key default gen_random_uuid(),
  bank           text not null,
  account_number text not null,
  account_holder text not null,

  -- The customer is shown every account, in this order. Ordering is data, not
  -- an accident of insertion time, because the field will want its most-used
  -- bank first.
  sort_order     int  not null,

  created_at     timestamptz not null default now(),

  constraint bank_accounts_bank_length check (length(bank) between 1 and 40),
  constraint bank_accounts_number_length check (length(account_number) between 1 and 40),
  constraint bank_accounts_holder_length check (length(account_holder) between 1 and 100)
);

-- Deleting the last account would leave customers with nowhere to transfer and
-- the booking page with an empty list, so the admin UI blocks it. This index
-- only enforces that two accounts cannot claim the same position.
create unique index uniq_bank_account_order on bank_accounts (sort_order);

commit;
```

No seed rows. The values are client content, not schema — see [6-gate-settings-and-expiry.md](../tasks/6-gate-settings-and-expiry.md).

## What changes in arena-player-web

Three reads, all on already-rendered surfaces. No new routes, no new API.

1. **WhatsApp number** — `src/modules/home/home.constants.ts` stops exporting a literal; the number is read from `site_settings` where `key = 'whatsapp_number'` and passed to the existing `whatsappLink()` in `src/modules/home/order.utils.ts`. The link-building logic does not change.
2. **Maps embed** — the placeholder box in `HomePage.tsx` becomes an iframe whose `src` is `maps_embed_url`, and keeps the placeholder as its empty state when the row is absent.
3. **Bank accounts** — the placeholder in `BookingForm.tsx` becomes the list from `bank_accounts` ordered by `sort_order`, and keeps the placeholder as its empty state when the table is empty.

The rate card is deliberately **not** in that list. Whether `/booking` renders a rupiah figure is a web-repo decision recorded at its own 2026-08-11 checkpoint; this request only guarantees that when it does, it reads the same row the admin's revenue estimate reads.

### Deployment ordering: none required

Nothing breaks if web ships these reads late. The admin can populate the tables first and the public site keeps showing its existing constant and its two placeholders — which is exactly what it shows today. **The failure mode of 001 does not apply here:** a block web never reads is a silent no-op with a real customer consequence, whereas a bank account web never reads leaves a visible "menyusul" placeholder that anyone looking at the page can see.

## Verification

Added to `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `site_settings` exists with columns `key`, `value`, `updated_at`, and `key` is the primary key
- `site_settings_key_known` exists and its literals are **exactly** the five keys above — set equality, so a key added on one side and not the other fails loudly
- `site_settings_value_length` exists
- `bank_accounts` exists with columns `id`, `bank`, `account_number`, `account_holder`, `sort_order`, `created_at`
- `uniq_bank_account_order` exists and is **unique** on `(sort_order)`
- the three `bank_accounts` length constraints exist

Runtime, before the migration lands: `src/server/schema-guard.ts` returns false; the Pengaturan screen renders the migration-missing error naming this file and its save actions return 503, and the revenue estimate in Statistik and Ekspor is hidden rather than shown against a guessed tariff. **The bookings console is unaffected** — Phase 2's queue needs nothing from these tables.
