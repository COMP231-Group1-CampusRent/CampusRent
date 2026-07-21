import { Router } from 'express';
import db from '../db';
import { authenticate, requireVerifiedStudent } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, requireVerifiedStudent, (req, res) => {
  const { reported_user_id, reported_listing_id, reason, details } = req.body;

  if (!reason?.trim() || !details?.trim()) {
    return res.status(400).json({ error: 'Reason and details are required' });
  }
  if (!reported_user_id && !reported_listing_id) {
    return res.status(400).json({ error: 'Must report a user or listing' });
  }

  const result = db
    .prepare(
      `INSERT INTO reports (reporter_id, reported_user_id, reported_listing_id, reason, details)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      reported_user_id || null,
      reported_listing_id || null,
      reason.trim(),
      details.trim()
    );

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(report);
});

export default router;
