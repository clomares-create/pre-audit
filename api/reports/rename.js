import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });
  const { reportId, clientName } = req.body;
  if (!reportId || !clientName) return res.status(400).json({ error: 'Données manquantes' });
  const result = await db.execute({
    sql: 'UPDATE reports SET client_name = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
    args: [clientName, reportId, payload.userId]
  });
  if (result.rowsAffected === 0) return res.status(404).json({ error: 'Rapport introuvable' });
  return res.status(200).json({ ok: true });
}
