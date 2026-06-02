import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });
  const { reportId, status } = req.body;
  if (!['draft', 'sent', 'signed'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
  await db.execute({
    sql: 'UPDATE reports SET status=?, updated_at=datetime("now") WHERE id=? AND user_id=?',
    args: [status, reportId, payload.userId]
  });
  return res.status(200).json({ ok: true });
}
