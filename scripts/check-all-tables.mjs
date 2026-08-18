import postgres from "postgres";

const connectionString =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(connectionString, { ssl: "require", connect_timeout: 10 });
  try {
    const publicTables = await sql`
      SELECT 
        table_name,
        (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name)::int as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    console.log(`\n--- Public Schema: ${publicTables.length} Tables ---`);
    for (const t of publicTables) {
      const [countResult] = await sql.unsafe(
        `SELECT count(*)::int as total FROM "${t.table_name}"`,
      );
      console.log(
        `- ${t.table_name.padEnd(20)}: ${t.column_count} columns | ${countResult.total} rows`,
      );
    }

    const allSchemas = await sql`
      SELECT table_schema, count(*)::int as table_count
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      GROUP BY table_schema
      ORDER BY table_schema;
    `;
    console.log(`\n--- All Schemas Summary ---`);
    for (const s of allSchemas) {
      console.log(`- Schema "${s.table_schema}": ${s.table_count} tables`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
