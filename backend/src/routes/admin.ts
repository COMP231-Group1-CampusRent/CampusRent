import { Router } from 'express';
import db from '../db';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/stats', (_req, res) => {
  const stats = {
    total_users: (db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'student'").get() as { c: number }).c,
    verified_users: (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE verification_status = 'verified'").get() as {
        c: number;
      }
    ).c,
    pending_verifications: (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE verification_status = 'pending'").get() as {
        c: number;
      }
    ).c,
    total_listings: (db.prepare('SELECT COUNT(*) as c FROM listings').get() as { c: number }).c,
    active_listings: (
      db.prepare("SELECT COUNT(*) as c FROM listings WHERE availability = 'available'").get() as {
        c: number;
      }
    ).c,
    total_requests: (db.prepare('SELECT COUNT(*) as c FROM rental_requests').get() as { c: number }).c,
    pending_requests: (
      db.prepare("SELECT COUNT(*) as c FROM rental_requests WHERE status = 'pending'").get() as {
        c: number;
      }
    ).c,
    completed_rentals: (
      db.prepare("SELECT COUNT(*) as c FROM rental_requests WHERE status = 'completed'").get() as {
        c: number;
      }
    ).c,
    pending_reports: (
      db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'pending'").get() as { c: number }
    ).c,
    total_messages: (db.prepare('SELECT COUNT(*) as c FROM messages').get() as { c: number }).c,
    total_reviews: (db.prepare('SELECT COUNT(*) as c FROM reviews').get() as { c: number }).c,
  };

  const recentActivity = db
    .prepare(
      `SELECT 'registration' as type, email as detail, created_at FROM users WHERE role = 'student'
       UNION ALL
       SELECT 'listing', title, created_at FROM listings
       UNION ALL
       SELECT 'request', status, created_at FROM rental_requests
       ORDER BY created_at DESC LIMIT 20`
    )
    .all();

  res.json({ stats, recent_activity: recentActivity });
});

router.get('/verifications', (_req, res) => {
  const users = db
    .prepare(
      `SELECT id, email, first_name, last_name, verification_status, created_at
       FROM users WHERE role = 'student' AND verification_status = 'pending'
       ORDER BY created_at ASC`
    )
    .all();
  res.json(users);
});

router.patch('/verifications/:id', (req, res) => {
  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: 'Action must be approve or reject' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    | { id: number; role: string }
    | undefined;
  if (!user || user.role !== 'student') {
    return res.status(404).json({ error: 'Student not found' });
  }

  const status = action === 'approve' ? 'verified' : 'rejected';
  db.prepare('UPDATE users SET verification_status = ? WHERE id = ?').run(status, user.id);

  const updated = db
    .prepare(
      `SELECT id, email, first_name, last_name, verification_status, created_at FROM users WHERE id = ?`
    )
    .get(user.id);
  res.json(updated);
});

router.get('/reports', (_req, res) => {
  const reports = db
    .prepare(
      `SELECT r.*,
        reporter.first_name || ' ' || reporter.last_name as reporter_name,
        reported.first_name || ' ' || reported.last_name as reported_user_name,
        l.title as reported_listing_title
       FROM reports r
       JOIN users reporter ON reporter.id = r.reporter_id
       LEFT JOIN users reported ON reported.id = r.reported_user_id
       LEFT JOIN listings l ON l.id = r.reported_listing_id
       ORDER BY r.created_at DESC`
    )
    .all();
  res.json(reports);
});

router.patch('/reports/:id', (req, res) => {
  const { action, admin_action } = req.body;
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as
    | {
        id: number;
        reported_user_id: number | null;
        reported_listing_id: number | null;
        status: string;
      }
    | undefined;

  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status === 'resolved') {
    return res.status(400).json({ error: 'Report already resolved' });
  }

  if (action === 'remove_listing' && report.reported_listing_id) {
    db.prepare('DELETE FROM listings WHERE id = ?').run(report.reported_listing_id);
  }
  if (action === 'suspend_user' && report.reported_user_id) {
    db.prepare("UPDATE users SET status = 'suspended' WHERE id = ?").run(report.reported_user_id);
  }

  db.prepare(
    `UPDATE reports SET status = 'resolved', admin_action = ?, resolved_at = datetime('now')
     WHERE id = ?`
  ).run(admin_action || action, report.id);

  const updated = db.prepare('SELECT * FROM reports WHERE id = ?').get(report.id);
  res.json(updated);
});

router.get('/users', (_req, res) => {
  const users = db
    .prepare(
      `SELECT id, email, first_name, last_name, verification_status, status, created_at
       FROM users WHERE role = 'student' ORDER BY created_at DESC`
    )
    .all();
  res.json(users);
});

export default router;
