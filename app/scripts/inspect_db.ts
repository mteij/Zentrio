import { Database } from "bun:sqlite";
import { join } from "path";

const dbPath = join(process.cwd(), "data/zentrio.db");
const db = new Database(dbPath);

const tables = ["user", "session", "account", "verification", "two_factor"];

for (const table of tables) {
  console.log(`\nTable: ${table}`);
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    console.table(columns);
  } catch (e) {
    console.log(`Error reading table ${table}:`, e);
  }
}