import bcrypt from 'bcryptjs';
import { db, initDB } from '../_db.js';
import { signToken } from '../_auth.js';
import { randomUUID } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  await initDB();
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  try {
    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);
    // Check for a pending email invite
    const inviteRow = await db.execute({
      sql: 'SELECT * FROM workspace_invites WHERE invited_email = ? AND used = 0 LIMIT 1',
      args: [email.toLowerCase()]
    });
    const invite = inviteRow.rows[0];
    const workspaceId = invite?.workspace_id || null;

    await db.execute({
      sql: 'INSERT INTO users (id, email, password_hash, name, workspace_id) VALUES (?, ?, ?, ?, ?)',
      args: [id, email.toLowerCase(), hash, name || '', workspaceId]
    });

    if (invite) {
      await db.execute({
        sql: 'UPDATE workspace_invites SET used = 1 WHERE token = ?',
        args: [invite.token]
      });
    }

    const token = signToken(id);
    return res.status(201).json({ token, user: { id, email, name } });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
    return res.status(500).json({ error: e.message });
  }
}
