import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  // PATCH — rename
  if (req.method === 'PATCH') {
    const { reportId, clientName } = req.body;
    if (!reportId || !clientName) return res.status(400).json({ error: 'Données manquantes' });
    const result = await db.execute({
      sql: 'UPDATE reports SET client_name = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
      args: [clientName, reportId, payload.userId]
    });
    if (result.rowsAffected === 0) return res.status(404).json({ error: 'Rapport introuvable' });
    return res.status(200).json({ ok: true });
  }

  // DELETE — single or bulk
  if (req.method === 'DELETE') {
    const { reportId, reportIds } = req.body;
    const ids = reportIds ?? (reportId ? [reportId] : []);
    if (!ids.length) return res.status(400).json({ error: 'Aucun rapport spécifié' });

    let deleted = 0;
    for (const id of ids) {
      const result = await db.execute({
        sql: 'DELETE FROM reports WHERE id = ? AND user_id = ?',
        args: [id, payload.userId]
      });
      deleted += result.rowsAffected;
    }
    return res.status(200).json({ ok: true, deleted });
  }

  return res.status(405).end();
}
