// Live mode: one Snowflake connection as GCL_DEMO_ROLE, the least-privilege role from
// sql/setup.sql. Server only. Every statement uses bind variables.
import snowflake from 'snowflake-sdk';

snowflake.configure({ logLevel: 'ERROR' });

let pool: Promise<snowflake.Connection> | null = null;

export function isSnowflakeConfigured(): boolean {
  return !!(process.env.SNOWFLAKE_ACCOUNT && process.env.SNOWFLAKE_USERNAME &&
    (process.env.SNOWFLAKE_PRIVATE_KEY_PATH || process.env.SNOWFLAKE_TOKEN || process.env.SNOWFLAKE_BROWSER_AUTH === 'true'));
}

function config(): snowflake.ConnectionOptions {
  const base: snowflake.ConnectionOptions = {
    account: process.env.SNOWFLAKE_ACCOUNT!,
    username: process.env.SNOWFLAKE_USERNAME!,
    role: process.env.SNOWFLAKE_ROLE ?? 'GCL_DEMO_ROLE',
    warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? 'GCL_WH',
    database: process.env.SNOWFLAKE_DATABASE ?? 'GOVERNED_CONTEXT_DEMO',
    schema: 'AGENTS',
    clientSessionKeepAlive: true,
    timeout: 600000,
  };
  // Key-pair auth is recommended. A programmatic access token or browser SSO also work for local testing.
  if (process.env.SNOWFLAKE_PRIVATE_KEY_PATH) return { ...base, authenticator: 'SNOWFLAKE_JWT', privateKeyPath: process.env.SNOWFLAKE_PRIVATE_KEY_PATH };
  if (process.env.SNOWFLAKE_TOKEN) return { ...base, authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: process.env.SNOWFLAKE_TOKEN };
  return { ...base, authenticator: 'EXTERNALBROWSER' };
}

async function connect(): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection(config());
  await new Promise<void>((resolve, reject) => {
    const cb = (err: snowflake.SnowflakeError | undefined) => (err ? reject(err) : resolve());
    if (process.env.SNOWFLAKE_BROWSER_AUTH === 'true' && !process.env.SNOWFLAKE_PRIVATE_KEY_PATH && !process.env.SNOWFLAKE_TOKEN) conn.connectAsync(cb);
    else conn.connect(cb);
  });
  return conn;
}

export async function query<T = Record<string, unknown>>(sqlText: string, binds?: snowflake.Binds): Promise<T[]> {
  if (!pool) { pool = connect(); pool.catch(() => { pool = null; }); }
  const conn = await pool;
  if (!conn.isUp()) { pool = null; return query(sqlText, binds); }
  return new Promise((resolve, reject) => {
    conn.execute({ sqlText, binds, complete: (err, _s, rows) => (err ? reject(new Error(err.message)) : resolve((rows ?? []) as T[])) });
  });
}
