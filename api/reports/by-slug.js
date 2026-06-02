import { db, initDB } from '../_db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDB();
  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'Slug manquant' });
  const result = await db.execute({
    sql: 'SELECT id, client_name, client_url, content, status, created_at FROM reports WHERE slug = ?',
    args: [slug]
  });
  const report = result.rows[0];
  if (!report) return res.status(404).json({ error: 'Rapport introuvable' });
  return res.status(200).json({
    report: {
      ...report,
      clientName: report.client_name,
      clientUrl: report.client_url,
      createdAt: report.created_at,
      content: JSON.parse(report.content)
    }
  });
}
