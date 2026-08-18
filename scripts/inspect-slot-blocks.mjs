import postgres from "postgres";

const connectionString =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";

async function main() {
  const sql = postgres(connectionString, { ssl: "require", connect_timeout: 10 });
  try {
    // Columns
    const columns = await sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'slot_blocks'
      ORDER BY ordinal_position;
    `;

    // Constraints & Indexes
    const constraints = await sql`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      LEFT JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public' AND tc.table_name = 'slot_blocks'
      ORDER BY tc.constraint_name;
    `;

    // Indexes
    const indexes = await sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'slot_blocks';
    `;

    console.log("=== COLUMNS ===");
    console.log(JSON.stringify(columns, null, 2));
    console.log("=== CONSTRAINTS ===");
    console.log(JSON.stringify(constraints, null, 2));
    console.log("=== INDEXES ===");
    console.log(JSON.stringify(indexes, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
