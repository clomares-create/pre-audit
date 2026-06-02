import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });
  const result = await db.execute({
    sql: 'SELECT id, email, name FROM users WHERE id = ?',
    args: [payload.userId]
  });
  const user = result.rows[0];
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  return res.status(200).json({ user });
}
