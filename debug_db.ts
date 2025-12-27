
import { Database } from 'bun:sqlite';

const db = new Database('app/data/zentrio.db');

console.log('--- Watch History Dump ---');
const rows = db.query('SELECT * FROM watch_history ORDER BY updated_at DESC LIMIT 20').all();
console.log(JSON.stringify(rows, null, 2));
