import postgres from "postgres";

const connectionString =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(connectionString, { ssl: "require", connect_timeout: 10 });
  try {
    const tables = await sql`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name)::int as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n=== Supabase Database Connection Verified ===`);
    console.log(`Total tables in public schema: ${tables.length}\n`);

    for (const t of tables) {
      const [countResult] = await sql.unsafe(
        `SELECT count(*)::int as total FROM "${t.table_name}"`,
      );
      console.log(
        `- ${t.table_name.padEnd(20)} | Columns: ${t.column_count.toString().padEnd(2)} | Rows: ${countResult.total}`,
      );
    }

    // Also check storage buckets
    const buckets =
      await sql`SELECT id, name, public, created_at FROM storage.buckets ORDER BY name;`;
    console.log(`\n=== Storage Buckets (${buckets.length}) ===`);
    for (const b of buckets) {
      console.log(`- Bucket: ${b.name} (public: ${b.public})`);
    }
  } catch (err) {
    console.error("Database connection error:", err);
  } finally {
    await sql.end();
  }
}

main();
