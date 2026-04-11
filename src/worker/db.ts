// Pool de pg compartido del worker. No reutilizamos src/lib/db.ts porque
// el worker corre en CommonJS y src/lib/db.ts vive en el bundle de Next.
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@postgres-hayexperiencia:5432/hayexperiencia";

export const pool = new Pool({
  connectionString,
  max: 4,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

export async function q<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

export async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
