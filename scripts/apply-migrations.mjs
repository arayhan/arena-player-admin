import postgres from "postgres";

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

console.log("[migration] Connecting to database:", databaseUrl.replace(/:[^:@]+@/, ":***@"));
const sql = postgres(databaseUrl, {
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function main() {
  try {
    console.log("[migration] 1. Creating bookings table & indexes...");
    await sql.unsafe(`
      create table if not exists bookings (
        id           uuid primary key default gen_random_uuid(),
        booking_date date not null,
        time_slot    text not null,
        team_name    text not null,
        phone        text not null,
        notes        text,
        proof_key    text,
        status       text not null default 'pending',
        created_at   timestamptz not null default now(),

        constraint time_slot_canonical check (time_slot in (
          '06.00 - 07.00','07.00 - 08.00','08.00 - 09.00','09.00 - 10.00','10.00 - 11.00','11.00 - 12.00',
          '12.00 - 13.00','13.00 - 14.00','14.00 - 15.00','15.00 - 16.00','16.00 - 17.00','17.00 - 18.00',
          '18.00 - 19.00','19.00 - 20.00','20.00 - 21.00','21.00 - 22.00','22.00 - 23.00','23.00 - 24.00'
        )),
        constraint status_valid check (status in ('pending', 'confirmed', 'rejected', 'expired')),
        constraint notes_length check (notes is null or length(notes) <= 500)
      );

      create unique index if not exists uniq_active_slot
        on bookings (booking_date, time_slot)
        where status in ('pending', 'confirmed');

      create index if not exists bookings_pending_expiry_idx
        on bookings (booking_date, created_at)
        where status = 'pending';
    `);
    console.log("[migration] ✅ bookings table created.");

    console.log("[migration] 2. Creating slot_blocks table...");
    await sql.unsafe(`
      create table if not exists slot_blocks (
        id uuid primary key default gen_random_uuid(),
        block_date date not null,
        time_slot text not null,
        reason text,
        created_at timestamptz not null default now(),
        constraint slot_blocks_time_slot_canonical check (time_slot in (
          '06.00 - 07.00','07.00 - 08.00','08.00 - 09.00','09.00 - 10.00','10.00 - 11.00','11.00 - 12.00',
          '12.00 - 13.00','13.00 - 14.00','14.00 - 15.00','15.00 - 16.00','16.00 - 17.00','17.00 - 18.00',
          '18.00 - 19.00','19.00 - 20.00','20.00 - 21.00','21.00 - 22.00','22.00 - 23.00','23.00 - 24.00'
        )),
        constraint slot_blocks_reason_length check (reason is null or length(reason) <= 200)
      );
      create unique index if not exists uniq_slot_block on slot_blocks (block_date, time_slot);
    `);
    console.log("[migration] ✅ slot_blocks table created.");

    console.log("[migration] 3. Creating site_settings table...");
    await sql.unsafe(`
      create table if not exists site_settings (
        key text primary key,
        value text not null,
        updated_at timestamptz not null default now()
      );
    `);
    console.log("[migration] ✅ site_settings table created.");

    console.log("[migration] 4. Creating bank_accounts table...");
    await sql.unsafe(`
      create table if not exists bank_accounts (
        id uuid primary key default gen_random_uuid(),
        bank text not null,
        account_number text not null,
        account_holder text not null,
        sort_order int not null,
        created_at timestamptz not null default now()
      );
      create unique index if not exists uniq_bank_account_order on bank_accounts (sort_order);
    `);
    console.log("[migration] ✅ bank_accounts table created.");

    console.log("[migration] 5. Seeding initial default settings...");
    await sql.unsafe(`
      insert into site_settings (key, value)
      values
        ('whatsapp_number', '6289682620666'),
        ('address', 'Jl. Lapangan Futsal Arena No. 1, Lombok'),
        ('maps_embed_url', ''),
        ('dp_percent', '50')
      on conflict (key) do update set value = excluded.value;
    `);

    console.log("[migration] 6. Seeding initial bank account if empty...");
    await sql.unsafe(`
      insert into bank_accounts (bank, account_number, account_holder, sort_order)
      select 'BCA', '1234567890', 'Arena Futsal Lombok', 1
      where not exists (select 1 from bank_accounts);
    `);

    console.log("[migration] 7. Checking tables status in Supabase...");
    const tables = await sql`
      select table_name from information_schema.tables where table_schema = 'public';
    `;
    console.log("[migration] Tables in public schema:", tables.map((t) => t.table_name).join(", "));

    console.log("[migration] 🎉 ALL DATABASE TABLES & MIGRATIONS CREATED SUCCESSFULLY!");
  } catch (error) {
    console.error("[migration] ❌ Migration error:", error);
  } finally {
    await sql.end();
  }
}

main();
