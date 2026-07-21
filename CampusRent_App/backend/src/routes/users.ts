import { Router } from 'express';
import db from '../db';
import { authenticate, requireVerifiedStudent } from '../middleware/auth';

const router = Router();

router.get('/profile', authenticate, (req, res) => {
  const user = db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, bio, role,
              verification_status, status, created_at
       FROM users WHERE id = ?`
    )
    .get(req.user!.id);
  res.json(user);
});

router.put('/profile', authenticate, requireVerifiedStudent, (req, res) => {
  const { first_name, last_name, phone, bio } = req.body;

  if (!first_name?.trim() || !last_name?.trim()) {
    return res.status(400).json({ error: 'First and last name are required' });
  }

  db.prepare(
    `UPDATE users SET first_name = ?, last_name = ?, phone = ?, bio = ?
     WHERE id = ?`
  ).run(
    first_name.trim(),
    last_name.trim(),
    (phone || '').trim(),
    (bio || '').trim(),
    req.user!.id
  );

  const user = db
    .prepare(
      `SELECT id, email, first_name, last_name, phone, bio, role,
              verification_status, status, created_at
       FROM users WHERE id = ?`
    )
    .get(req.user!.id);

  res.json(user);
});

router.get('/:id/public', (req, res) => {
  const user = db
    .prepare(
      `SELECT id, first_name, last_name, bio, verification_status,
              (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE reviewee_id = users.id) as avg_rating,
              (SELECT COUNT(*) FROM reviews WHERE reviewee_id = users.id) as review_count
       FROM users WHERE id = ? AND role = 'student' AND status = 'active'`
    )
    .get(req.params.id);

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

export default router;
