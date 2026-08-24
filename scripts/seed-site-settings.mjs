import postgres from "postgres";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

const settingsToSeed = [
  {
    key: "maps_embed_url",
    value:
      "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3943.324280937278!2d116.4750677!3d-8.755528299999998!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dcc53005adc6011%3A0x48fd9a87865f0a08!2sArena%20Player%20Soccer!5e0!3m2!1sen!2sid!4v1786803816454!5m2!1sen!2sid",
  },
  {
    key: "address",
    value: "Selebung Ketangga, Kec. Keruak, Kab. Lombok Timur, Nusa Tenggara Barat",
  },
  {
    key: "operating_hours",
    value: "06.00–24.00 WITA",
  },
  {
    key: "whatsapp_number",
    value: "6289682620666",
  },
  {
    key: "dp_percent",
    value: "50",
  },
];

async function main() {
  console.log("Connecting to database...");
  const sql = postgres(DATABASE_URL, { prepare: false, ssl: "require" });

  try {
    for (const item of settingsToSeed) {
      console.log(`Upserting ${item.key}...`);
      await sql`
        insert into site_settings (key, value, updated_at)
        values (${item.key}, ${item.value}, now())
        on conflict (key) do update
        set value = ${item.value}, updated_at = now()
      `;
    }
    console.log("✅ Successfully synced site_settings to database!");
  } catch (error) {
    console.error("❌ Failed to sync site_settings:", error);
  } finally {
    await sql.end().catch(() => {});
  }
}

main();
