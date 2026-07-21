import { Router } from 'express';
import db from '../db';
import { authenticate, requireVerifiedStudent } from '../middleware/auth';

const router = Router();

function enrichRequest(row: Record<string, unknown>) {
  const listing = db
    .prepare('SELECT id, title, category, owner_id FROM listings WHERE id = ?')
    .get(row.listing_id);
  const renter = db
    .prepare('SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?')
    .get(row.renter_id);
  const owner = listing
    ? db
        .prepare('SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?')
        .get((listing as { owner_id: number }).owner_id)
    : null;

  return { ...row, listing, renter, owner };
}

router.get('/outgoing', authenticate, requireVerifiedStudent, (req, res) => {
  const requests = db
    .prepare(
      `SELECT * FROM rental_requests WHERE renter_id = ? ORDER BY created_at DESC`
    )
    .all(req.user!.id);
  res.json(requests.map((r) => enrichRequest(r as Record<string, unknown>)));
});

router.get('/incoming', authenticate, requireVerifiedStudent, (req, res) => {
  const requests = db
    .prepare(
      `SELECT rr.* FROM rental_requests rr
       JOIN listings l ON l.id = rr.listing_id
       WHERE l.owner_id = ? ORDER BY rr.created_at DESC`
    )
    .all(req.user!.id);
  res.json(requests.map((r) => enrichRequest(r as Record<string, unknown>)));
});

router.post('/', authenticate, requireVerifiedStudent, (req, res) => {
  const { listing_id, start_date, end_date } = req.body;

  if (!listing_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'Listing and rental dates are required' });
  }
  if (new Date(end_date) < new Date(start_date)) {
    return res.status(400).json({ error: 'End date must be after start date' });
  }

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing_id) as
    | { id: number; owner_id: number; availability: string }
    | undefined;

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.availability !== 'available') {
    return res.status(400).json({ error: 'This item is not available for rental' });
  }
  if (listing.owner_id === req.user!.id) {
    return res.status(400).json({ error: 'You cannot request your own listing' });
  }

  const result = db
    .prepare(
      `INSERT INTO rental_requests (listing_id, renter_id, start_date, end_date)
       VALUES (?, ?, ?, ?)`
    )
    .run(listing_id, req.user!.id, start_date, end_date);

  const request = db
    .prepare('SELECT * FROM rental_requests WHERE id = ?')
    .get(result.lastInsertRowid);
  res.status(201).json(enrichRequest(request as Record<string, unknown>));
});

router.patch('/:id/approve', authenticate, requireVerifiedStudent, (req, res) => {
  const request = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(req.params.id) as
    | { id: number; listing_id: number; status: string }
    | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending requests can be approved' });
  }

  const listing = db.prepare('SELECT owner_id FROM listings WHERE id = ?').get(request.listing_id) as
    | { owner_id: number }
    | undefined;
  if (!listing || listing.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only listing owners may approve requests' });
  }

  db.prepare(
    `UPDATE rental_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`
  ).run(request.id);

  const updated = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(request.id);
  res.json(enrichRequest(updated as Record<string, unknown>));
});

router.patch('/:id/decline', authenticate, requireVerifiedStudent, (req, res) => {
  const request = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(req.params.id) as
    | { id: number; listing_id: number; status: string }
    | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending requests can be declined' });
  }

  const listing = db.prepare('SELECT owner_id FROM listings WHERE id = ?').get(request.listing_id) as
    | { owner_id: number }
    | undefined;
  if (!listing || listing.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only listing owners may decline requests' });
  }

  db.prepare(
    `UPDATE rental_requests SET status = 'declined', updated_at = datetime('now') WHERE id = ?`
  ).run(request.id);

  const updated = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(request.id);
  res.json(enrichRequest(updated as Record<string, unknown>));
});

router.patch('/:id/cancel', authenticate, requireVerifiedStudent, (req, res) => {
  const request = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(req.params.id) as
    | { id: number; renter_id: number; status: string }
    | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.renter_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only the renter may cancel this request' });
  }
  if (request.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending requests can be cancelled' });
  }

  db.prepare(
    `UPDATE rental_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`
  ).run(request.id);

  const updated = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(request.id);
  res.json(enrichRequest(updated as Record<string, unknown>));
});

router.patch('/:id/complete', authenticate, requireVerifiedStudent, (req, res) => {
  const request = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(req.params.id) as
    | { id: number; listing_id: number; renter_id: number; status: string }
    | undefined;
  if (!request) return res.status(404).json({ error: 'Request not found' });
  if (request.status !== 'accepted') {
    return res.status(400).json({ error: 'Only accepted requests can be completed' });
  }

  const listing = db.prepare('SELECT owner_id FROM listings WHERE id = ?').get(request.listing_id) as
    | { owner_id: number }
    | undefined;
  const isOwner = listing?.owner_id === req.user!.id;
  const isRenter = request.renter_id === req.user!.id;
  if (!isOwner && !isRenter) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare(
    `UPDATE rental_requests SET status = 'completed', updated_at = datetime('now') WHERE id = ?`
  ).run(request.id);

  const updated = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(request.id);
  res.json(enrichRequest(updated as Record<string, unknown>));
});

export default router;
