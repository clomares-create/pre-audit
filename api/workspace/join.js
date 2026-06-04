import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token manquant' });

  const inviteRow = await db.execute({
    sql: 'SELECT * FROM workspace_invites WHERE token = ?',
    args: [token]
  });
  const invite = inviteRow.rows[0];
  if (!invite) return res.status(404).json({ error: 'Invitation introuvable' });
  if (invite.used) return res.status(410).json({ error: 'Invitation déjà utilisée' });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'Invitation expirée' });
  }

  const wsRow = await db.execute({
    sql: 'SELECT * FROM workspaces WHERE id = ?',
    args: [invite.workspace_id]
  });
  const workspace = wsRow.rows[0];
  if (!workspace) return res.status(404).json({ error: 'Espace de travail introuvable' });

  await db.execute({
    sql: 'UPDATE users SET workspace_id = ? WHERE id = ?',
    args: [workspace.id, payload.userId]
  });

  await db.execute({
    sql: 'UPDATE workspace_invites SET used = 1 WHERE token = ?',
    args: [token]
  });

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
      isOwner: workspace.owner_id === payload.userId,
      memberCount
    }
  });
}
