import postgres from "postgres";

const dbUrl =
  "postgresql://postgres.lrelwuikjiuqvlduxzdy:4DcebvWK4LjC0FlJ@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
const sql = postgres(dbUrl, { ssl: "require", prepare: false });

async function main() {
  try {
    const rls = await sql`
      select c.relname, c.relrowsecurity, p.polname, p.polcmd, p.polroles::text
      from pg_class c
      left join pg_policy p on c.oid = p.polrelid
      join pg_namespace n on c.relnamespace = n.oid
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname, p.polname;
    `;
    console.log("RLS and Policies across public tables:", rls);
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}

main();
