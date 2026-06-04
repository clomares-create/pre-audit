import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';
import { randomUUID } from 'crypto';

function toSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${base}-${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });
  const { clientName, clientUrl, content, reportId } = req.body;
  if (!clientName || !content) return res.status(400).json({ error: 'Données manquantes' });
  const contentStr = JSON.stringify(content);

  const userRow = await db.execute({
    sql: 'SELECT workspace_id FROM users WHERE id = ?',
    args: [payload.userId]
  });
  const workspaceId = userRow.rows[0]?.workspace_id || null;

  if (reportId) {
    const existing = await db.execute({
      sql: 'SELECT id, slug FROM reports WHERE id = ? AND user_id = ?',
      args: [reportId, payload.userId]
    });
    if (!existing.rows[0]) return res.status(404).json({ error: 'Rapport introuvable' });
    await db.execute({
      sql: 'UPDATE reports SET client_name=?, client_url=?, content=?, updated_at=datetime("now") WHERE id=?',
      args: [clientName, clientUrl || '', contentStr, reportId]
    });
    return res.status(200).json({ reportId, slug: existing.rows[0].slug, url: '/r/' + existing.rows[0].slug });
  }

  const id = randomUUID();
  const slug = toSlug(clientName);
  await db.execute({
    sql: 'INSERT INTO reports (id, user_id, workspace_id, client_name, client_url, slug, content) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [id, payload.userId, workspaceId, clientName, clientUrl || '', slug, contentStr]
  });
  return res.status(201).json({ reportId: id, slug, url: '/r/' + slug });
}
