import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __heiWorkPgPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@postgres-hayexperiencia:5432/hayexperiencia";

export const pool: Pool =
  global.__heiWorkPgPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.__heiWorkPgPool = pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params as unknown[]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[db.query] failed:", (err as Error).message);
    // eslint-disable-next-line no-console
    console.error("[db.query] sql:", text.slice(0, 300).replace(/\s+/g, " "));
    // eslint-disable-next-line no-console
    console.error("[db.query] params:", JSON.stringify(params).slice(0, 500));
    throw err;
  }
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function pingDb(): Promise<boolean> {
  try {
    const r = await query<{ ok: number }>("SELECT 1 AS ok");
    return r.rows[0]?.ok === 1;
  } catch {
    return false;
  }
}
