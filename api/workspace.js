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

  // GET /api/workspace?action=members
  if (req.method === 'GET' && action === 'members') {
    const userRow = await db.execute({ sql: 'SELECT workspace_id FROM users WHERE id = ?', args: [payload.userId] });
    const user = userRow.rows[0];
    let workspaceId = user?.workspace_id;
    if (!workspaceId) {
      const ownedRow = await db.execute({ sql: 'SELECT id FROM workspaces WHERE owner_id = ?', args: [payload.userId] });
      workspaceId = ownedRow.rows[0]?.id;
    }
    if (!workspaceId) return res.status(404).json({ error: 'Espace introuvable' });

    const wsRow = await db.execute({ sql: 'SELECT owner_id FROM workspaces WHERE id = ?', args: [workspaceId] });
    const ownerId = wsRow.rows[0]?.owner_id;

    const membersRow = await db.execute({
      sql: 'SELECT id, name, email FROM users WHERE workspace_id = ?',
      args: [workspaceId]
    });
    const members = membersRow.rows.map(m => ({ ...m, is_owner: m.id === ownerId }));
    return res.status(200).json({ members });
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

  // POST /api/workspace?action=invite — invite by email
  if (req.method === 'POST' && action === 'invite') {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email manquant' });

    const wsRow = await db.execute({
      sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
      args: [payload.userId]
    });
    const workspace = wsRow.rows[0];
    if (!workspace) return res.status(403).json({ error: 'Aucun espace de travail trouvé' });

    // Check if user already exists
    const userRow = await db.execute({
      sql: 'SELECT id, name, email, workspace_id FROM users WHERE email = ?',
      args: [email.toLowerCase().trim()]
    });
    const target = userRow.rows[0];

    if (target) {
      if (target.workspace_id === workspace.id) {
        return res.status(409).json({ error: 'Cet utilisateur est déjà membre de votre espace' });
      }
      // Add them directly
      await db.execute({
        sql: 'UPDATE users SET workspace_id = ? WHERE id = ?',
        args: [workspace.id, target.id]
      });
      return res.status(200).json({ status: 'added', name: target.name || target.email });
    }

    // User doesn't exist yet — store a pending invite by email
    try { await db.execute(`ALTER TABLE workspace_invites ADD COLUMN invited_email TEXT`); } catch {}
    // Remove any existing pending invite for this email in this workspace
    await db.execute({
      sql: 'DELETE FROM workspace_invites WHERE workspace_id = ? AND invited_email = ? AND used = 0',
      args: [workspace.id, email.toLowerCase().trim()]
    });
    const token = randomUUID();
    await db.execute({
      sql: 'INSERT INTO workspace_invites (token, workspace_id, created_by, invited_email, used) VALUES (?, ?, ?, ?, 0)',
      args: [token, workspace.id, payload.userId, email.toLowerCase().trim()]
    });
    return res.status(201).json({ status: 'pending', email });
  }

  // GET /api/workspace?action=pending-invites
  if (req.method === 'GET' && action === 'pending-invites') {
    const wsRow = await db.execute({ sql: 'SELECT id FROM workspaces WHERE owner_id = ?', args: [payload.userId] });
    const workspace = wsRow.rows[0];
    if (!workspace) return res.status(403).json({ error: 'Non autorisé' });
    try { await db.execute(`ALTER TABLE workspace_invites ADD COLUMN invited_email TEXT`); } catch {}
    const rows = await db.execute({
      sql: 'SELECT invited_email FROM workspace_invites WHERE workspace_id = ? AND used = 0 AND invited_email IS NOT NULL',
      args: [workspace.id]
    });
    return res.status(200).json({ invites: rows.rows });
  }

  // POST /api/workspace?action=remove-member
  if (req.method === 'POST' && action === 'remove-member') {
    const { userId: targetId } = req.body;
    if (!targetId) return res.status(400).json({ error: 'Utilisateur manquant' });
    const wsRow = await db.execute({ sql: 'SELECT * FROM workspaces WHERE owner_id = ?', args: [payload.userId] });
    const workspace = wsRow.rows[0];
    if (!workspace) return res.status(403).json({ error: 'Non autorisé' });
    await db.execute({ sql: 'UPDATE users SET workspace_id = NULL WHERE id = ? AND workspace_id = ?', args: [targetId, workspace.id] });
    return res.status(200).json({ ok: true });
  }

  return res.status(404).json({ error: 'Action inconnue' });
}
