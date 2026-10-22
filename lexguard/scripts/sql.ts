// Petit client SQL pour inspecter la base locale ou Aiven : npm run sql -- "select …"
import { db } from "../lib/db";

async function main() {
  const client = await db();
  for (const sql of process.argv.slice(2)) console.table((await client.query(sql)).rows);
  await client.close();
}
main();
