import { createClient } from '@libsql/client/web';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDB() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_url TEXT,
      slug TEXT UNIQUE NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT,
      api_key TEXT,
      pagespeed_key TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_invites (
      token TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      created_by TEXT NOT NULL,
      expires_at TEXT,
      used INTEGER DEFAULT 0
    )
  `);
  try { await db.execute(`ALTER TABLE users ADD COLUMN workspace_id TEXT`); } catch {}
  try { await db.execute(`ALTER TABLE reports ADD COLUMN workspace_id TEXT`); } catch {}
}
