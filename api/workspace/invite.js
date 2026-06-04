import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const wsRow = await db.execute({
    sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
    args: [payload.userId]
  });
  const workspace = wsRow.rows[0];
  if (!workspace) return res.status(403).json({ error: 'Aucun espace de travail trouvé' });

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.execute({
    sql: 'INSERT INTO workspace_invites (token, workspace_id, created_by, expires_at) VALUES (?, ?, ?, ?)',
    args: [token, workspace.id, payload.userId, expiresAt]
  });

  return res.status(201).json({ token });
}
