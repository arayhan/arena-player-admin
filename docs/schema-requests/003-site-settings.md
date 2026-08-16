# 003 — `site_settings`, `site_rules`, `rate_card` and `bank_accounts`

**Status:** requested
**Unblocks:** admin Phase 2 — the Pengaturan screen, and the revenue figures in Statistik/Ekspor
**Requires of arena-player-web:** yes — five reads. **Two of them are order-critical and two are not**, for a reason worth reading before assuming this behaves like the rest of the folder

> **Amended 2026-08-15.** The original request gave the rate card one home as a pair of `site_settings` keys, and covered the WhatsApp number, the Maps embed and the bank accounts. It now has to hold a **rate table keyed by slot and day type**, the **address**, and the **Ketentuan** — and the last of those changes the deployment story, because a value web currently hardcodes is a value that goes silently stale rather than visibly blank. Amended in place rather than superseded: nothing here has landed, so there is no history to preserve, and a second file would leave two descriptions of one Pengaturan screen.

> **Amended again, 2026-08-17.** The client supplied a real pricelist — weekday tiers, and a
> weekend tier that also covers public holidays. That answers the "which days are weekend" open
> item below only halfway: Saturday/Sunday is confirmed, but "public holiday" is not a function of
> a date alone, so a **new `public_holidays` table** is added — an admin-managed list, not a
> hardcoded yearly calendar, because Indonesian national holidays shift and this project has
> already paid once for a value that goes stale silently. `bank_accounts.is_active` is also
> formalized here: it was added to the live table outside this document's own process (see
> PROGRESS.md, 2026-08-17) and is already relied on by the shipped settings UI, so this
> amendment catches the doc up to what shipped rather than fighting it. `site_rules` remains
> requested-not-built and out of scope for this amendment — nobody has asked for it yet.

## Why

Values shown to customers, owned by nobody:

| Value                | Where it lives today                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- |
| WhatsApp number      | hardcoded — `arena-player-web/src/modules/home/home.constants.ts`, `WHATSAPP_NUMBER = "6289682620666"`              |
| Ketentuan (10 rules) | hardcoded — `arena-player-web/src/modules/home/home.content.ts`, `KETENTUAN` as a 10-element `readonly string[]`    |
| Address              | does not exist — `LocationBlock.tsx` renders _"Alamat menyusul — menunggu data dari pihak lapangan"_ under a `TODO` |
| Google Maps embed    | does not exist — same component renders _"Titik lokasi di peta ini menyusul"_                                       |
| Bank accounts        | does not exist — `BookingForm.tsx` renders _"Nomor rekening & nama pemilik menyusul"_                               |
| Rate card            | does not exist anywhere in either repo; `/booking` labels every slot `Harga menyusul`                               |

Every one of them changes without a developer being involved: the field switches bank, the owner changes phone, the client finally supplies the rate card, a rule about studded boots gets rewritten after an incident. Today each change is a code edit and a deploy of **two** applications, and the two applications can disagree in between.

**Rejected first: environment variables.** They need no migration, which is genuinely attractive here, but they make the Pengaturan screen a read-only display — the admin still cannot change a bank account without a developer, and the value must be set identically in two deploys. That is the same drift with more steps.

**Rejected second: one JSON blob.** A single settings row holding a JSON array of bank accounts loses the ordering guarantee the customer sees, cannot be constrained, and turns "add a bank account" into read-modify-write with a lost-update race between two admin tabs.

**Rejected third, added by this amendment: the rate card as one value, or two.** The original wrote `tariff_normal` and `tariff_prime` as `site_settings` keys, which quietly hardcodes the peak boundary — `6-gate-settings-and-expiry.md` phrases it as "06.00–16.00" and "16.00–24.00", and that boundary would then have to be written as a constant in both repos to decide which key applies to a slot. Two copies of a boundary is a boundary that will eventually disagree with itself, and the disagreement is a customer quoted one price and charged another.

**Rejected fourth: a `peak boolean` column beside `time_slot`.** It is the same mistake wearing a schema. Peak-ness is a **function of the slot**, so a column asserting it is a second definition of a fact the slot already carries, free to contradict it.

**Rejected fifth: the Ketentuan as one newline-joined `site_settings` value.** A rule containing a line break silently becomes two rules. The numerals web renders in `KetentuanRows` come from position, and position in a blob is a parse result rather than data. Per-rule length cannot be constrained. The bank-account reasoning applies unchanged: an ordered list that a customer sees is an ordered list in the schema.

Four tables: one key-value for the singular scalars, three ordinary tables for the three ordered or keyed sets.

## DDL

```sql
-- db/migrations/<timestamp>_create_site_settings.sql
-- Requested by arena-player-admin (docs/schema-requests/003-site-settings.md).
-- ADDITIVE ONLY: bookings is not touched.
-- Run manually in the Supabase SQL editor. Never auto-applied.
--
-- Wrapped in a transaction so a half-failed paste cannot leave some of these
-- four tables created and others missing. The booking page reads across them:
-- having one without another renders a payment page with a bank list and no
-- amount, or an amount and nowhere to send it.
begin;

create table site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now(),

  -- An allow-list, not free-form config. A typo'd key would otherwise write a
  -- row nothing reads, and the screen would report success while the public
  -- site kept showing the old value.
  --
  -- SCALARS ONLY. Anything with an order or a compound key is its own table
  -- below. The two tariff keys the first draft of this request carried are
  -- gone; they are rate_card rows now.
  constraint site_settings_key_known check (key in (
    'whatsapp_number',   -- wa.me form, digits only, e.g. 6289682620666
    'address',           -- the field's street address, as it should read on the page
    'maps_embed_url',    -- the src of the Google Maps "Embed a map" iframe
    'dp_percent'         -- integer 1..100. THE ONLY PLACE THE NUMBER 50 IS STORED
  )),

  -- No lower bound: `maps_embed_url` is optional and the app writes an empty
  -- string for "not configured yet", the same way `address` reads as empty
  -- rather than a placeholder. A `between 1 and 2000` bound (this file's
  -- original figure) rejects that legitimate state — caught by testing
  -- against the live row before applying, not assumed from the DDL alone.
  constraint site_settings_value_length check (length(value) <= 2000)
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

  -- Added by the 2026-08-17 amendment, formalizing a column that was already
  -- live and already relied on by the shipped settings UI's toggle button.
  -- An inactive account stays in the admin's list (so re-enabling it needs no
  -- re-typing) but is dropped from what the customer sees on the booking page.
  is_active      boolean not null default true,

  created_at     timestamptz not null default now(),

  constraint bank_accounts_bank_length check (length(bank) between 1 and 40),
  constraint bank_accounts_number_length check (length(account_number) between 1 and 40),
  constraint bank_accounts_holder_length check (length(account_holder) between 1 and 100)
);

-- Deleting the last account would leave customers with nowhere to transfer and
-- the booking page with an empty list, so the admin UI blocks it. This index
-- only enforces that two accounts cannot claim the same position.
create unique index uniq_bank_account_order on bank_accounts (sort_order);

-- THE KETENTUAN. One row per rule, because that is how the customer reads them
-- and how KetentuanRows renders them — numbered, in order, individually.
--
-- arena-player-web's home.content.ts calls this "the one text on this site that
-- must never be improved": it is the field's own terms, verbatim, and the text a
-- visitor agrees to when they book. Moving it into a table does not relax that
-- rule. It moves who may change it from a developer editing a constant to the
-- client editing their own agreement, which is the correct owner and the whole
-- point. Nothing here licenses tidying the grammar.
create table site_rules (
  id         uuid primary key default gen_random_uuid(),
  body       text not null,
  sort_order int  not null,
  updated_at timestamptz not null default now(),

  constraint site_rules_body_length check (length(body) between 1 and 500)
);

create unique index uniq_site_rule_order on site_rules (sort_order);

-- THE RATE CARD. Keyed by slot AND day type, one price per combination.
-- At most 36 rows: eighteen slots by two day types.
--
-- Peak / off-peak is NOT a column. It is a property of the slot, so the price
-- rows ARE the peak boundary — if 16.00 - 17.00 costs more than 15.00 - 16.00,
-- that is where prime time starts, and no constant in either repo says so.
-- Moving the boundary is editing a price, not shipping a deploy.
create table rate_card (
  id           uuid primary key default gen_random_uuid(),
  time_slot    text not null,
  day_type     text not null,

  -- Rupiah, whole. `integer` rather than `numeric` because there is no
  -- fractional rupiah in this business and the schema should say so; the
  -- rounding question the DP introduces is answered in ONE function, not by
  -- widening the column. See "Revenue" below.
  price_rupiah integer not null,

  updated_at   timestamptz not null default now(),

  -- The same eighteen literals as bookings.time_slot_canonical and
  -- src/domain/slots.ts — the 1-hour set, after 20260815_alter_time_slot_1h.sql.
  -- Deliberately duplicated rather than factored into a
  -- DOMAIN, for the reason 001 gives: a DOMAIN needs `alter column type` on
  -- bookings by hand, on the one table the race guard sits on. Drift between
  -- the copies is caught by arena-player-admin's `pnpm check:schema`, which
  -- reads these out of pg_get_constraintdef and asserts set equality with
  -- TIME_SLOTS.
  constraint rate_card_time_slot_canonical check (time_slot in (
    '06.00 - 07.00','07.00 - 08.00','08.00 - 09.00','09.00 - 10.00','10.00 - 11.00','11.00 - 12.00',
    '12.00 - 13.00','13.00 - 14.00','14.00 - 15.00','15.00 - 16.00','16.00 - 17.00','17.00 - 18.00',
    '18.00 - 19.00','19.00 - 20.00','20.00 - 21.00','21.00 - 22.00','22.00 - 23.00','23.00 - 24.00'
  )),

  -- Which calendar days are 'weekend' is NOT decided here and is not derivable
  -- from this table. See the open item; the mapping is one function in
  -- src/domain/, authored in arena-player-web.
  constraint rate_card_day_type_valid check (day_type in ('weekday','weekend')),

  -- A zero or negative price is a data-entry accident, never an offer.
  constraint rate_card_price_positive check (price_rupiah > 0)
);

-- One price per slot per day type. Two rows for the same pair would make
-- "the price" a question about insertion order.
create unique index uniq_rate_card_slot on rate_card (time_slot, day_type);

-- ADDED BY THE 2026-08-17 AMENDMENT. Answers the other half of "which days
-- are weekend": Saturday/Sunday is a function of the date alone, but a public
-- holiday is not — Idul Fitri moves every year, a regional holiday is not a
-- national one. An admin-managed list, not a hardcoded calendar: Indonesian
-- national holidays are gazetted yearly and a constant here would go stale
-- exactly the way the WhatsApp number and the Ketentuan used to.
create table public_holidays (
  id           uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  label        text not null,
  created_at   timestamptz not null default now(),

  constraint public_holidays_label_length check (length(label) between 1 and 100)
);

commit;
```

**No seed rows, and no example prices anywhere in this file.** The tables are schema; the values are client content that has not arrived — see [6-gate-settings-and-expiry.md](../tasks/6-gate-settings-and-expiry.md), question 3. A plausible-looking figure written here as an illustration is a figure that gets copied into a seed script by the next reader.

**`price_rupiah % 1000 = 0` was considered and rejected.** It would make the 50% DP land on a whole rupiah by construction, which is tempting. But it encodes a pricing convention the client has never stated, and its failure mode is a save button that rejects a legitimate price with a constraint-violation message the admin cannot act on. The rounding rule is cheaper to write down once than to enforce by making some prices unrepresentable.

## Revenue, and the one place 50% may live

**Revenue = DP collected = `dp_percent` of the rate, over `confirmed` bookings only.**

Three consequences, each of which has somewhere it can go wrong:

1. **The percentage is data, not code.** `site_settings.dp_percent` is the only place the number is stored. **The literal `50` must not appear in either repo's source.** It appears in exactly one other place, and that place is also data: rule 1 of the Ketentuan, _"Booking, wajib DP sebesar 50% (harga sewa lapangan)"_, which is prose the client owns and nothing computes with. Those two are free to disagree, and the Pengaturan screen must therefore show them adjacent — an admin who edits `dp_percent` to 30 while rule 1 still says 50% has made the site contradict its own arithmetic in front of the customer.

2. **The arithmetic belongs in `src/domain/`, authored in `arena-player-web`.** Recommended shape: a `src/domain/pricing.ts` holding two functions and no values — `booking_date → day_type`, and `(price_rupiah, dp_percent) → DP rupiah` with its rounding rule stated. Both are things the two apps **must agree on**: web's `/booking` is the page allowed to quote a rupiah figure, and the admin's Statistik totals what was actually collected. Two implementations of one rounding rule is `toSlotStatus` all over again — nothing throws, the numbers just differ by a few hundred rupiah and nobody can say which is right.

   The cost is real and worth naming: a `src/domain/` module has to be authored in web (CLAUDE.md hard rule 4), and web has **no consumer for it today** — `/booking` still says `Harga menyusul`. A byte-identical module with one consumer is overhead. The alternative — keep it in `src/utils/` here until web needs it — is the cheaper option that works right up until web renders a price, at which point somebody copies the function instead of moving it. Pay the overhead.

3. **Per-slot pricing answers a question web has open.** `arena-player-web/docs/database.md` asks whether four hours costs twice two hours. It does, by construction: a multi-slot booking is **several `bookings` rows**, one per slot, and each row prices from its own `rate_card` entry. Revenue is a sum over rows and needs no multi-slot arithmetic at all. That holds only while there is no bulk discount, and none is known to exist — see the open items.

**`confirmed` only, as an inclusion list.** The revenue read is `where b.status = 'confirmed'`, never a `not in`. That is what makes [005](005-admin-writes-bookings.md)'s soft delete free: a `deleted` row drops out of revenue without the query being edited, and a soft-deleted booking that once counted stops counting.

**And revenue cannot be plotted against a date until [002](002-booking-events.md) lands.** `bookings` has no `confirmed_at`, so this table gives the amount and 002 gives the moment. That dependency is the reason 002 moved to Phase-2 blocking.

## What changes in arena-player-web

Five reads, all on already-rendered surfaces. No new routes, no new API.

1. **WhatsApp number** — `home.constants.ts` stops exporting a literal; the number is read from `site_settings` where `key = 'whatsapp_number'` and passed to the existing `whatsappLink()` in `order.utils.ts`. The link-building logic does not change.
2. **Ketentuan** — `home.content.ts` stops exporting `KETENTUAN`; `KetentuanRows` reads `site_rules` ordered by `sort_order`. `KETENTUAN_TITLE` may stay a constant or become a sixth settings key; this request does not decide it.
3. **Address** — the `TODO(content)` placeholder in `LocationBlock.tsx` renders `site_settings.address`, keeping the "menyusul" text as its empty state.
4. **Maps embed** — the same component's map placeholder becomes an iframe whose `src` is `maps_embed_url`, keeping the placeholder as its empty state.
5. **Bank accounts** — the placeholder in `BookingForm.tsx` becomes the list from `bank_accounts` ordered by `sort_order`, keeping the placeholder as its empty state.

The rate card is deliberately **not** in that list. Whether `/booking` renders a rupiah figure at all is a web-repo decision recorded at its own 2026-08-11 checkpoint; this request only guarantees that when it does, it reads the same rows the admin's revenue figures read, through the same `src/domain/pricing.ts`.

### Deployment ordering — and the amendment changed the answer

The original request said "none required", and for three of the five that is still true. It is **not** true for the two values web currently hardcodes, and the difference is the failure mode, not the importance:

| Value           | Web today               | If the admin can edit it before web reads it                                              | Order-critical |
| --------------- | ----------------------- | ----------------------------------------------------------------------------------------- | -------------- |
| Bank accounts   | visible "menyusul"      | The page stays visibly incomplete. Anyone looking at it sees the gap                      | no             |
| Address         | visible "menyusul"      | Same                                                                                      | no             |
| Maps embed      | visible "menyusul"      | Same                                                                                      | no             |
| WhatsApp number | **hardcoded `628968…`** | Admin changes the number, screen says saved, customers keep messaging the old one         | **yes**        |
| Ketentuan       | **hardcoded, 10 rules** | Admin rewrites a rule, screen says saved, customers keep agreeing to the superseded terms | **yes**        |

**A blank is safe; a stale value that looks current is not.** That is the whole distinction, and it is why 001's "silent no-op" framing does apply here after all — to two rows of that table, and to nothing else.

The rule that falls out of it:

```
this DDL transcribed into web's db/migrations/
  →  applied by hand in the Supabase SQL editor
  →  check:schema green in arena-player-admin
  →  rows populated from the client's answers (gate 6)
  →  web deploys reads 1 and 2  ─────────────┐
  →  only then does Pengaturan expose the    │  the other three reads may ship
     WhatsApp number and the Ketentuan       │  before, after, or never, without
     as EDITABLE                             ┘  anybody being misled
```

Until web's reads 1 and 2 are deployed, those two fields render **read-only** in Pengaturan, with the reason stated on the screen. A disabled field that says why is honest; an enabled field that saves into a value nothing reads is not.

## Verification

Added to `src/server/required-schema.ts`, asserted by `pnpm check:schema`:

- `site_settings` exists with columns `key`, `value`, `updated_at`, and `key` is the primary key
- `site_settings_key_known` exists and its literals are **exactly** the four keys above — set equality, so a key added on one side and not the other fails loudly
- `site_settings_value_length` exists
- `bank_accounts` exists with columns `id`, `bank`, `account_number`, `account_holder`, `sort_order`, `created_at`; `uniq_bank_account_order` exists and is **unique** on `(sort_order)`; the three length constraints exist
- `site_rules` exists with columns `id`, `body`, `sort_order`, `updated_at`; `uniq_site_rule_order` exists and is **unique** on `(sort_order)`; `site_rules_body_length` exists
- `rate_card` exists with columns `id`, `time_slot`, `day_type`, `price_rupiah`, `updated_at`
- `uniq_rate_card_slot` exists and is **unique** on `(time_slot, day_type)`
- `rate_card_time_slot_canonical` exists, and its literals read out of `pg_get_constraintdef` are **set-equal to `TIME_SLOTS`** from `src/domain/slots.ts` — the same assertion `bookings` and `slot_blocks` already carry, and the reason the eighteen strings are repeated rather than factored out
- `rate_card_day_type_valid` and `rate_card_price_positive` exist
- `public_holidays` exists with columns `id`, `holiday_date`, `label`, `created_at`; `holiday_date` is `unique`; `public_holidays_label_length` exists
- `bank_accounts.is_active` exists, `boolean`, `not null`, default `true`

`check:schema` cannot assert that the table is **populated**, and must not try. An empty `rate_card` is a valid schema and a broken product; that gap is a gate ([6-gate-settings-and-expiry.md](../tasks/6-gate-settings-and-expiry.md)), not a check.

Runtime, before the migration lands: `src/server/schema-guard.ts` returns false; the Pengaturan screen renders the migration-missing error naming this file and its save actions return 503, and every revenue figure in Statistik and Ekspor is **hidden rather than estimated against a guess**. A number on a dashboard is read as a fact. **The bookings console is unaffected** — Phase 2's queue needs nothing from these tables.

## Open items

> **RESOLVED 2026-08-17 — which days are `weekend`.** Saturday and Sunday, or any date in `public_holidays`. The client's pricelist prices Sabtu–Minggu and public holidays identically, one tier, so the two are one `day_type = 'weekend'` rather than a three-value enum — a `holiday` row would need its own price column nobody has supplied and the pricelist doesn't ask for. The resolver is `resolveDayType()` in **`src/server/pricing.ts`**, not `src/domain/pricing.ts` as originally proposed here — see arena-player-admin's PROGRESS.md, 2026-08-17: web has no consumer for a price today (`rateCard()` still returns `[]`), so a byte-identical shared module with nothing on the other side to use it is the overhead this very document argued against paying early (§ "The arithmetic belongs in `src/domain/`" below). Promote it when web starts quoting a price, not before.

> **RESOLVED 2026-08-17 — rounding.** Round-half-up to the nearest rupiah: `round(price_rupiah * dp_percent / 100)`. Every price in the client's pricelist divides evenly at the current 50% `dp_percent`, so this has no visible effect today — it only matters if `dp_percent` changes or a future price isn't a round number, which is exactly why it needed to be decided now rather than discovered later. Lives beside `dpAmount()` in `src/server/pricing.ts`, same caveat as above about promotion to `src/domain/`.

> **ASSUMPTION FLAGGED — "admin phone" and "WhatsApp number" are treated as one value.** `whatsapp_number` is stored in `wa.me` form (`628…`, no `+`, no punctuation) because that is what `wa.me` and the WhatsApp Business API expect, and because `src/domain/phone.ts` normalises visitor numbers into the same shape. If the field also has a voice number that is not on WhatsApp, that is a **second key**, not a rename of this one — a display number pushed through `wa.me` produces a link that opens a chat with nobody.

> **ASSUMPTION FLAGGED — bulk pricing, and the 1-hour split made it likelier to bite.** The per-slot table prices a four-hour booking as **four** slots summed. If the field gives a discount for consecutive slots, that is not expressible here and the schema would need a rule table, not another column. This mattered less when a slot was two hours and a long booking meant two rows; with eighteen 1-hour slots the ordinary two-hour game is now two rows and a four-hour block is four, so consecutive-slot bookings are the common case rather than the long tail. Ask before the first revenue figure is shown to the client, because a total that is 10% high is not visibly wrong.
