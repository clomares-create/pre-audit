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
    await db.execute({
      sql: 'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      args: [id, email.toLowerCase(), hash, name || '']
    });
    const token = signToken(id);
    return res.status(201).json({ token, user: { id, email, name } });
  } catch (e) {
    if (e.message?.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
    return res.status(500).json({ error: e.message });
  }
}
