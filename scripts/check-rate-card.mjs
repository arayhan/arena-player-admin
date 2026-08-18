import postgres from "postgres";

const connectionString =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(connectionString, { ssl: "require", connect_timeout: 10 });
  try {
    const rows = await sql`
      SELECT day_type, time_slot, price_rupiah, updated_at
      FROM rate_card
      ORDER BY day_type, time_slot;
    `;

    console.log("=== CURRENT RATE CARD IN SUPABASE ===");
    console.table(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
