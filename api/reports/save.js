import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

function toSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function randomChars(n = 6) {
  return Math.random().toString(36).slice(2, 2 + n);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const { clientName, clientUrl, content, reportId } = req.body;
  if (!clientName || !content) return res.status(400).json({ error: 'clientName et content requis' });

  const now = new Date().toISOString();

  // UPDATE existing report
  if (reportId) {
    const existing = await db.execute({
      sql: 'SELECT id, slug FROM reports WHERE id = ? AND user_id = ?',
      args: [reportId, payload.userId],
    });
    if (!existing.rows[0]) return res.status(404).json({ error: 'Rapport introuvable' });

    const { slug } = existing.rows[0];
    await db.execute({
      sql: 'UPDATE reports SET client_name = ?, client_url = ?, content = ?, updated_at = ? WHERE id = ?',
      args: [clientName, clientUrl || null, JSON.stringify(content), now, reportId],
    });
    return res.status(200).json({ reportId, slug, url: `/r/${slug}` });
  }

  // CREATE new report
  const id = crypto.randomUUID();
  const slug = `${toSlug(clientName)}-${randomChars(6)}`;

  await db.execute({
    sql: `INSERT INTO reports (id, user_id, client_name, client_url, slug, content, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    args: [id, payload.userId, clientName, clientUrl || null, slug, JSON.stringify(content), now, now],
  });

  return res.status(201).json({ reportId: id, slug, url: `/r/${slug}` });
}
