import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const result = await db.execute({
    sql: `SELECT id, client_name, client_url, slug, status, created_at, updated_at
          FROM reports WHERE user_id = ? ORDER BY updated_at DESC`,
    args: [payload.userId],
  });

  const reports = result.rows.map(r => ({
    id: r.id,
    clientName: r.client_name,
    clientUrl: r.client_url,
    slug: r.slug,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return res.status(200).json({ reports });
}
