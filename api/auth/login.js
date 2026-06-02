import bcrypt from 'bcryptjs';
import { db, initDB } from '../_db.js';
import { signToken } from '../_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });

  const result = await db.execute({
    sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
    args: [email.toLowerCase()],
  });

  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Identifiants invalides' });

  const token = signToken(user.id);
  return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } });
}
