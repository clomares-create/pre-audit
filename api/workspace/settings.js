import { db, initDB } from '../_db.js';
import { verifyToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') return res.status(405).end();
  await initDB();
  const payload = verifyToken(req);
  if (!payload) return res.status(401).json({ error: 'Non authentifié' });

  const wsRow = await db.execute({
    sql: 'SELECT * FROM workspaces WHERE owner_id = ?',
    args: [payload.userId]
  });
  const workspace = wsRow.rows[0];
  if (!workspace) return res.status(403).json({ error: 'Aucun espace de travail trouvé' });

  const { api_key, pagespeed_key } = req.body;
  await db.execute({
    sql: 'UPDATE workspaces SET api_key = ?, pagespeed_key = ? WHERE id = ?',
    args: [api_key ?? workspace.api_key, pagespeed_key ?? workspace.pagespeed_key, workspace.id]
  });

  return res.status(200).json({ success: true });
}
