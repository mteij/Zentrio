import { db } from './src/services/database.js';

console.log('Database tables:');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
tables.forEach(t => console.log('- ' + t.name));

console.log('\nProxy tables check:');
const proxyTables = ['proxy_sessions', 'proxy_logs', 'profile_proxy_settings', 'proxy_rate_limits'];
proxyTables.forEach(table => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`✅ ${table}: ${count.count} records`);
  } catch(e) {
    console.log(`❌ ${table}: ERROR - ${e.message}`);
  }
});

console.log('\nExisting tables check:');
const existingTables = ['users', 'profiles', 'user_sessions'];
existingTables.forEach(table => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    console.log(`✅ ${table}: ${count.count} records`);
  } catch(e) {
    console.log(`❌ ${table}: ERROR - ${e.message}`);
  }
});