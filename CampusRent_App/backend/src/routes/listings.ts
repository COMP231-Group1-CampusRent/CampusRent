import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../db';
import {
  authenticate,
  optionalAuth,
  requireVerifiedStudent,
} from '../middleware/auth';
import { isValidCategory, LISTING_CATEGORIES } from '../utils/validation';

const router = Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only JPG, PNG, and WEBP images are allowed'));
  },
});

function getListingImages(listingId: number) {
  return db
    .prepare('SELECT id, filename FROM listing_images WHERE listing_id = ? ORDER BY id')
    .all(listingId);
}

function formatListing(
  listing: Record<string, unknown>,
  isGuest: boolean,
  isVerified: boolean
) {
  const images = getListingImages(listing.id as number);
  const owner = db
    .prepare('SELECT id, first_name, last_name, email, phone FROM users WHERE id = ?')
    .get(listing.owner_id as number) as
    | { id: number; first_name: string; last_name: string; email: string; phone: string }
    | undefined;

  const base = {
    ...listing,
    images: images.map((img: { filename: string }) => ({
      url: `/uploads/${img.filename}`,
    })),
  };

  if (isGuest || !isVerified) {
    const { owner_id: _oid, ...rest } = base;
    return {
      ...rest,
      owner: owner
        ? { id: owner.id, first_name: owner.first_name, last_name: owner.last_name.charAt(0) + '.' }
        : null,
      contact_hidden: true,
    };
  }

  return {
    ...base,
    owner: owner
      ? {
          id: owner.id,
          first_name: owner.first_name,
          last_name: owner.last_name,
          email: owner.email,
          phone: owner.phone,
        }
      : null,
    contact_hidden: false,
  };
}

router.get('/categories', (_req, res) => {
  res.json(LISTING_CATEGORIES);
});

router.get('/', optionalAuth, (req, res) => {
  const { q, category, availability, page = '1', limit = '12' } = req.query;
  const isGuest = !req.user;
  const isVerified =
    req.user?.role === 'admin' || req.user?.verification_status === 'verified';

  let sql = `SELECT l.* FROM listings l WHERE 1=1`;
  const params: unknown[] = [];

  if (isGuest || !isVerified) {
    sql += ` AND l.availability = 'available'`;
  }

  if (q && typeof q === 'string' && q.trim()) {
    sql += ` AND (l.title LIKE ? OR l.description LIKE ?)`;
    const term = `%${q.trim()}%`;
    params.push(term, term);
  }
  if (category && typeof category === 'string') {
    sql += ` AND l.category = ?`;
    params.push(category);
  }
  if (availability && typeof availability === 'string' && isVerified) {
    sql += ` AND l.availability = ?`;
    params.push(availability);
  }

  const countSql = sql.replace('SELECT l.*', 'SELECT COUNT(*) as total');
  const total = (db.prepare(countSql).get(...params) as { total: number }).total;

  sql += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
  params.push(limitNum, (pageNum - 1) * limitNum);

  const listings = db.prepare(sql).all(...params);
  res.json({
    listings: listings.map((l) =>
      formatListing(l as Record<string, unknown>, isGuest, isVerified)
    ),
    pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    guest_preview: isGuest || !isVerified,
  });
});

router.get('/mine', authenticate, requireVerifiedStudent, (req, res) => {
  const listings = db
    .prepare('SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC')
    .all(req.user!.id);

  res.json(
    listings.map((l) => formatListing(l as Record<string, unknown>, false, true))
  );
});

router.get('/:id', optionalAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const isGuest = !req.user;
  const isVerified =
    req.user?.role === 'admin' || req.user?.verification_status === 'verified';

  res.json(formatListing(listing as Record<string, unknown>, isGuest, isVerified));
});

router.post('/', authenticate, requireVerifiedStudent, upload.array('images', 5), (req, res) => {
  const { title, category, description, rental_terms, availability } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!category || !isValidCategory(category)) {
    return res.status(400).json({ error: 'Valid category is required' });
  }
  if (!description?.trim()) {
    return res.status(400).json({ error: 'Description is required' });
  }

  const avail = availability === 'unavailable' ? 'unavailable' : 'available';
  const result = db
    .prepare(
      `INSERT INTO listings (owner_id, title, category, description, rental_terms, availability)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.user!.id,
      title.trim(),
      category,
      description.trim(),
      (rental_terms || '').trim(),
      avail
    );

  const listingId = result.lastInsertRowid as number;
  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) {
    const insertImg = db.prepare(
      'INSERT INTO listing_images (listing_id, filename) VALUES (?, ?)'
    );
    for (const file of files) {
      insertImg.run(listingId, file.filename);
    }
  }

  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(listingId);
  res.status(201).json(formatListing(listing as Record<string, unknown>, false, true));
});

router.put('/:id', authenticate, requireVerifiedStudent, upload.array('images', 5), (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as
    | { id: number; owner_id: number }
    | undefined;

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only listing owners may edit listings' });
  }

  const { title, category, description, rental_terms } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  if (!category || !isValidCategory(category)) {
    return res.status(400).json({ error: 'Valid category is required' });
  }

  db.prepare(
    `UPDATE listings SET title = ?, category = ?, description = ?,
     rental_terms = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title.trim(), category, (description || '').trim(), (rental_terms || '').trim(), listing.id);

  const files = req.files as Express.Multer.File[] | undefined;
  if (files?.length) {
    const currentCount = (
      db.prepare('SELECT COUNT(*) as c FROM listing_images WHERE listing_id = ?').get(listing.id) as {
        c: number;
      }
    ).c;
    const remaining = 5 - currentCount;
    const insertImg = db.prepare(
      'INSERT INTO listing_images (listing_id, filename) VALUES (?, ?)'
    );
    for (const file of files.slice(0, remaining)) {
      insertImg.run(listing.id, file.filename);
    }
  }

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id);
  res.json(formatListing(updated as Record<string, unknown>, false, true));
});

router.patch('/:id/availability', authenticate, requireVerifiedStudent, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as
    | { id: number; owner_id: number }
    | undefined;

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only listing owners may update availability' });
  }

  const { availability } = req.body;
  if (!['available', 'unavailable'].includes(availability)) {
    return res.status(400).json({ error: 'Availability must be available or unavailable' });
  }

  db.prepare(
    `UPDATE listings SET availability = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(availability, listing.id);

  const updated = db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id);
  res.json(formatListing(updated as Record<string, unknown>, false, true));
});

router.delete('/:id', authenticate, requireVerifiedStudent, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id) as
    | { id: number; owner_id: number }
    | undefined;

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user!.id) {
    return res.status(403).json({ error: 'Only listing owners may remove listings' });
  }

  const images = db
    .prepare('SELECT filename FROM listing_images WHERE listing_id = ?')
    .all(listing.id) as { filename: string }[];
  for (const img of images) {
    const filePath = path.join(uploadsDir, img.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM listings WHERE id = ?').run(listing.id);
  res.json({ message: 'Listing removed successfully' });
});

export default router;
