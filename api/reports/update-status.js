import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

const VALID_STATUSES = ['draft', 'sent', 'signed'];

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const { reportId, status } = req.body;
  if (!reportId || !status) return res.status(400).json({ error: 'reportId et status requis' });
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` });
  }

  const existing = await db.execute({
    sql: 'SELECT id FROM reports WHERE id = ? AND user_id = ?',
    args: [reportId, payload.userId],
  });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Rapport introuvable' });

  await db.execute({
    sql: 'UPDATE reports SET status = ?, updated_at = ? WHERE id = ?',
    args: [status, new Date().toISOString(), reportId],
  });

  return res.status(200).json({ ok: true });
}
