import postgres from "postgres";

const dbUrl = "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: "require", prepare: false });

async function main() {
  try {
    const cons = await sql`
      select conname, pg_get_constraintdef(oid) as def
      from pg_constraint
      where conrelid = 'site_settings'::regclass;
    `;
    console.log("Constraints:", cons);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
