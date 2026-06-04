import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  // Check if user has a workspace_id
  const userRow = await db.execute({
    sql: 'SELECT workspace_id FROM users WHERE id = ?',
    args: [payload.userId]
  });
  const user = userRow.rows[0];
  let workspace = null;

  if (user && user.workspace_id) {
    // Fetch the workspace they belong to
    const wsRow = await db.execute({
      sql: 'SELECT * FROM workspaces WHERE id = ?',
      args: [user.workspace_id]
    });
    workspace = wsRow.rows[0] || null;
  }

  if (!workspace) {
    // Check if user owns a workspace
    const ownedRow = await db.execute({
      sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
      args: [payload.userId]
    });
    workspace = ownedRow.rows[0] || null;

    if (!workspace) {
      // Auto-create workspace for this user
      const id = randomUUID();
      await db.execute({
        sql: 'INSERT INTO workspaces (id, owner_id, name) VALUES (?, ?, ?)',
        args: [id, payload.userId, '']
      });
      await db.execute({
        sql: 'UPDATE users SET workspace_id = ? WHERE id = ?',
        args: [id, payload.userId]
      });
      workspace = { id, owner_id: payload.userId, name: '', api_key: null, pagespeed_key: null };
    }
  }

  const isOwner = workspace.owner_id === payload.userId;

  const memberCountRow = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM users WHERE workspace_id = ?',
    args: [workspace.id]
  });
  const memberCount = memberCountRow.rows[0]?.count ?? 0;

  return res.status(200).json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      api_key: workspace.api_key,
      pagespeed_key: workspace.pagespeed_key,
      isOwner,
      memberCount
    }
  });
}
