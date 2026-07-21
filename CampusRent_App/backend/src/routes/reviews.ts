import { Router } from 'express';
import db from '../db';
import { authenticate, requireVerifiedStudent } from '../middleware/auth';

const router = Router();

router.post('/', authenticate, requireVerifiedStudent, (req, res) => {
  const { rental_request_id, rating, comment } = req.body;

  if (!rental_request_id || !rating) {
    return res.status(400).json({ error: 'Rental request and rating are required' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const request = db.prepare('SELECT * FROM rental_requests WHERE id = ?').get(rental_request_id) as
    | { id: number; listing_id: number; renter_id: number; status: string }
    | undefined;

  if (!request) return res.status(404).json({ error: 'Rental request not found' });
  if (request.status !== 'completed') {
    return res.status(400).json({ error: 'Reviews can only be submitted after completed rentals' });
  }

  const listing = db.prepare('SELECT owner_id FROM listings WHERE id = ?').get(request.listing_id) as
    | { owner_id: number }
    | undefined;
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const isRenter = request.renter_id === req.user!.id;
  const isOwner = listing.owner_id === req.user!.id;
  if (!isRenter && !isOwner) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const reviewee_id = isRenter ? listing.owner_id : request.renter_id;

  const existing = db
    .prepare('SELECT id FROM reviews WHERE rental_request_id = ? AND reviewer_id = ?')
    .get(rental_request_id, req.user!.id);
  if (existing) {
    return res.status(409).json({ error: 'You have already reviewed this rental' });
  }

  const result = db
    .prepare(
      `INSERT INTO reviews (rental_request_id, reviewer_id, reviewee_id, rating, comment)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(rental_request_id, req.user!.id, reviewee_id, rating, (comment || '').trim());

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(review);
});

router.get('/user/:userId', (req, res) => {
  const reviews = db
    .prepare(
      `SELECT r.*, u.first_name, u.last_name FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.reviewee_id = ? ORDER BY r.created_at DESC`
    )
    .all(req.params.userId);
  res.json(reviews);
});

export default router;
