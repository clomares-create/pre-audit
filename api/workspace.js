import { db, initDB } from './_db.js';
import { verifyToken } from './_auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const action = req.query.action;

  // GET /api/workspace?action=me
  if (req.method === 'GET' && action === 'me') {
    const userRow = await db.execute({
      sql: 'SELECT workspace_id FROM users WHERE id = ?',
      args: [payload.userId]
    });
    const user = userRow.rows[0];
    let workspace = null;

    if (user && user.workspace_id) {
      const wsRow = await db.execute({
        sql: 'SELECT * FROM workspaces WHERE id = ?',
        args: [user.workspace_id]
      });
      workspace = wsRow.rows[0] || null;
    }

    if (!workspace) {
      const ownedRow = await db.execute({
        sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
        args: [payload.userId]
      });
      workspace = ownedRow.rows[0] || null;

      if (!workspace) {
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

  // PATCH /api/workspace?action=settings
  if (req.method === 'PATCH' && action === 'settings') {
    const wsRow = await db.execute({
      sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
      args: [payload.userId]
    });
    const workspace = wsRow.rows[0];
    if (!workspace) return res.status(403).json({ error: 'Aucun espace de travail trouvé' });

    const { api_key, pagespeed_key } = req.body;
    await db.execute({
      sql: 'UPDATE workspaces SET api_key = ?, pagespeed_key = ? WHERE id = ?',
      args: [api_key ?? workspace.api_key, pagespeed_key ?? workspace.pagespeed_key, workspace.id]
    });

    return res.status(200).json({ success: true });
  }

  // POST /api/workspace?action=invite
  if (req.method === 'POST' && action === 'invite') {
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

  // POST /api/workspace?action=join
  if (req.method === 'POST' && action === 'join') {
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

  return res.status(404).json({ error: 'Action inconnue' });
}
