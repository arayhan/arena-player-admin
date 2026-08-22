import postgres from "postgres";

const dbUrl =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: "require", prepare: false });

async function main() {
  try {
    console.log("Updating site_settings constraint to include operating_hours...");
    await sql.unsafe(`
      alter table site_settings drop constraint if exists site_settings_key_known;
      alter table site_settings add constraint site_settings_key_known check (
        key in ('whatsapp_number', 'address', 'maps_embed_url', 'dp_percent', 'operating_hours')
      );
      insert into site_settings (key, value, updated_at)
      values ('operating_hours', '06.00–24.00 WITA', now())
      on conflict (key) do nothing;
    `);
    const rows = await sql`select * from site_settings order by key`;
    console.log("Updated site_settings rows:", rows);
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await sql.end();
  }
}

main();
