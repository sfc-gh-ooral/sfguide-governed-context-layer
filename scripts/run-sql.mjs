// Runs a SQL file (for example sql/setup.sql) with the key-pair settings in .env.local.
// Usage: node scripts/run-sql.mjs sql/setup.sql
import { readFileSync } from 'node:fs';
import snowflake from 'snowflake-sdk';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
snowflake.configure({ logLevel: 'ERROR' });
const conn = snowflake.createConnection({
  account: env.SNOWFLAKE_ACCOUNT, username: env.SNOWFLAKE_USERNAME,
  authenticator: 'SNOWFLAKE_JWT', privateKeyPath: env.SNOWFLAKE_PRIVATE_KEY_PATH, role: process.env.RUN_ROLE ?? 'ACCOUNTADMIN',
});
await new Promise((res, rej) => conn.connect((e) => (e ? rej(e) : res())));
const sqlText = readFileSync(process.argv[2], 'utf8');
const t0 = Date.now();
await new Promise((res, rej) => conn.execute({
  sqlText, parameters: { MULTI_STATEMENT_COUNT: 0 },
  complete: async (err, stmt, rows) => {
    if (err) return rej(err);
    console.log(JSON.stringify(rows));
    res();
  },
}));
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
