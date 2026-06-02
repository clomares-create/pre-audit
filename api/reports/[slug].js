import { db, initDB } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Slug requis' });

  const result = await db.execute({
    sql: `SELECT id, client_name, client_url, content, status, created_at
          FROM reports WHERE slug = ?`,
    args: [slug],
  });

  const row = result.rows[0];
  if (!row) return res.status(404).json({ error: 'Rapport introuvable' });

  return res.status(200).json({
    report: {
      id: row.id,
      clientName: row.client_name,
      clientUrl: row.client_url,
      content: JSON.parse(row.content),
      status: row.status,
      createdAt: row.created_at,
    },
  });
}
