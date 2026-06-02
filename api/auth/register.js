import bcrypt from 'bcryptjs';
import { db, initDB } from '../_db.js';
import { signToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  });
  if (existing.rows.length > 0) return res.status(409).json({ error: 'Email déjà utilisé' });

  const id = crypto.randomUUID();
  const password_hash = await bcrypt.hash(password, 10);

  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
    args: [id, email.toLowerCase(), password_hash, name || null],
  });

  const token = signToken(id);
  return res.status(201).json({ token, user: { id, email: email.toLowerCase(), name: name || null } });
}
