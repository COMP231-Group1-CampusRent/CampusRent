import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string;
  bio: string;
  role: 'student' | 'admin';
  verification_status: 'pending' | 'verified' | 'rejected';
  status: 'active' | 'suspended';
  created_at: string;
}

export interface ListingRow {
  id: number;
  owner_id: number;
  title: string;
  category: string;
  description: string;
  rental_terms: string;
  availability: 'available' | 'unavailable';
  created_at: string;
  updated_at: string;
}

export interface ListingImageRow {
  id: number;
  listing_id: number;
  filename: string;
  created_at: string;
}

export interface RentalRequestRow {
  id: number;
  listing_id: number;
  renter_id: number;
  start_date: string;
  end_date: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface ConversationRow {
  id: number;
  listing_id: number | null;
  created_at: string;
}

export interface ConversationParticipantRow {
  conversation_id: number;
  user_id: number;
}

export interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  created_at: string;
}

export interface ReviewRow {
  id: number;
  rental_request_id: number;
  reviewer_id: number;
  reviewee_id: number;
  rating: number;
  comment: string;
  created_at: string;
}

export interface ReportRow {
  id: number;
  reporter_id: number;
  reported_user_id: number | null;
  reported_listing_id: number | null;
  reason: string;
  details: string;
  status: 'pending' | 'resolved';
  admin_action: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface DatabaseSchema {
  users: UserRow[];
  listings: ListingRow[];
  listing_images: ListingImageRow[];
  rental_requests: RentalRequestRow[];
  conversations: ConversationRow[];
  conversation_participants: ConversationParticipantRow[];
  messages: MessageRow[];
  reviews: ReviewRow[];
  reports: ReportRow[];
  _counters: Record<string, number>;
}

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'store.json');

const emptyDb = (): DatabaseSchema => ({
  users: [],
  listings: [],
  listing_images: [],
  rental_requests: [],
  conversations: [],
  conversation_participants: [],
  messages: [],
  reviews: [],
  reports: [],
  _counters: {},
});

let data: DatabaseSchema = emptyDb();

function load() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(dbPath)) {
    data = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }
}

function save() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function nextId(table: string): number {
  const current = data._counters[table] || 0;
  const id = current + 1;
  data._counters[table] = id;
  return id;
}

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined in the .env file');
  }

  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.name}`);

  // Temporary compatibility while the existing routes still use store.json.
  // Remove this call after all routes are migrated to Mongoose models.
  initDatabase();
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('MongoDB disconnected');
}

export function initDatabase() {
  load();
}

export function getDb() {
  return data;
}

export function persist() {
  save();
}

export { nextId };

// SQL-like helpers for route compatibility
type Row = Record<string, unknown>;

class Statement {
  constructor(private sql: string) {}

  get(...params: unknown[]): Row | undefined {
    const rows = this.all(...params);
    return rows[0];
  }

  all(...params: unknown[]): Row[] {
    return executeQuery(this.sql, params);
  }

  run(...params: unknown[]): { lastInsertRowid: number; changes: number } {
    return executeRun(this.sql, params);
  }
}

function executeRun(sql: string, params: unknown[]): { lastInsertRowid: number; changes: number } {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  let lastId = 0;

  if (normalized.startsWith('INSERT INTO users')) {
    const id = nextId('users');
    lastId = id;
    data.users.push({
      id,
      email: params[0] as string,
      password_hash: params[1] as string,
      first_name: (params[2] as string) || '',
      last_name: (params[3] as string) || '',
      phone: (params[4] as string) || '',
      bio: (params[5] as string) || '',
      role: (params[6] as 'student' | 'admin') || 'student',
      verification_status: (params[7] as UserRow['verification_status']) || 'pending',
      status: 'active',
      created_at: new Date().toISOString(),
    });
  } else if (normalized.startsWith('INSERT INTO listings')) {
    const id = nextId('listings');
    lastId = id;
    const now = new Date().toISOString();
    data.listings.push({
      id,
      owner_id: params[0] as number,
      title: params[1] as string,
      category: params[2] as string,
      description: params[3] as string,
      rental_terms: params[4] as string,
      availability: (params[5] as ListingRow['availability']) || 'available',
      created_at: now,
      updated_at: now,
    });
  } else if (normalized.startsWith('INSERT INTO listing_images')) {
    const id = nextId('listing_images');
    lastId = id;
    data.listing_images.push({
      id,
      listing_id: params[0] as number,
      filename: params[1] as string,
      created_at: new Date().toISOString(),
    });
  } else if (normalized.startsWith('INSERT INTO rental_requests')) {
    const id = nextId('rental_requests');
    lastId = id;
    const now = new Date().toISOString();
    data.rental_requests.push({
      id,
      listing_id: params[0] as number,
      renter_id: params[1] as number,
      start_date: params[2] as string,
      end_date: params[3] as string,
      status: 'pending',
      created_at: now,
      updated_at: now,
    });
  } else if (normalized.startsWith('INSERT INTO conversations')) {
    const id = nextId('conversations');
    lastId = id;
    data.conversations.push({
      id,
      listing_id: (params[0] as number) || null,
      created_at: new Date().toISOString(),
    });
  } else if (normalized.startsWith('INSERT INTO conversation_participants')) {
    data.conversation_participants.push({
      conversation_id: params[0] as number,
      user_id: params[1] as number,
    });
    lastId = params[0] as number;
  } else if (normalized.startsWith('INSERT INTO messages')) {
    const id = nextId('messages');
    lastId = id;
    data.messages.push({
      id,
      conversation_id: params[0] as number,
      sender_id: params[1] as number,
      content: params[2] as string,
      created_at: new Date().toISOString(),
    });
  } else if (normalized.startsWith('INSERT INTO reviews')) {
    const id = nextId('reviews');
    lastId = id;
    data.reviews.push({
      id,
      rental_request_id: params[0] as number,
      reviewer_id: params[1] as number,
      reviewee_id: params[2] as number,
      rating: params[3] as number,
      comment: (params[4] as string) || '',
      created_at: new Date().toISOString(),
    });
  } else if (normalized.startsWith('INSERT INTO reports')) {
    const id = nextId('reports');
    lastId = id;
    data.reports.push({
      id,
      reporter_id: params[0] as number,
      reported_user_id: (params[1] as number) || null,
      reported_listing_id: (params[2] as number) || null,
      reason: params[3] as string,
      details: params[4] as string,
      status: 'pending',
      admin_action: null,
      created_at: new Date().toISOString(),
      resolved_at: null,
    });
  } else if (normalized.includes('UPDATE users SET verification_status')) {
    const user = data.users.find((u) => u.id === params[1]);
    if (user) user.verification_status = params[0] as UserRow['verification_status'];
  } else if (normalized.includes('UPDATE users SET status')) {
    const user = data.users.find((u) => u.id === params[1]);
    if (user) user.status = params[0] as UserRow['status'];
  } else if (normalized.includes('UPDATE users SET first_name')) {
    const user = data.users.find((u) => u.id === params[4]);
    if (user) {
      user.first_name = params[0] as string;
      user.last_name = params[1] as string;
      user.phone = params[2] as string;
      user.bio = params[3] as string;
    }
  } else if (normalized.includes('UPDATE listings SET availability')) {
    const listing = data.listings.find((l) => l.id === params[1]);
    if (listing) {
      listing.availability = params[0] as ListingRow['availability'];
      listing.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes('UPDATE listings SET title')) {
    const listing = data.listings.find((l) => l.id === params[4]);
    if (listing) {
      listing.title = params[0] as string;
      listing.category = params[1] as string;
      listing.description = params[2] as string;
      listing.rental_terms = params[3] as string;
      listing.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes("UPDATE rental_requests SET status = 'accepted'")) {
    const req = data.rental_requests.find((r) => r.id === params[0]);
    if (req) {
      req.status = 'accepted';
      req.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes("UPDATE rental_requests SET status = 'declined'")) {
    const req = data.rental_requests.find((r) => r.id === params[0]);
    if (req) {
      req.status = 'declined';
      req.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes("UPDATE rental_requests SET status = 'cancelled'")) {
    const req = data.rental_requests.find((r) => r.id === params[0]);
    if (req) {
      req.status = 'cancelled';
      req.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes("UPDATE rental_requests SET status = 'completed'")) {
    const req = data.rental_requests.find((r) => r.id === params[0]);
    if (req) {
      req.status = 'completed';
      req.updated_at = new Date().toISOString();
    }
  } else if (normalized.includes('UPDATE reports SET status')) {
    const report = data.reports.find((r) => r.id === params[1]);
    if (report) {
      report.status = 'resolved';
      report.admin_action = params[0] as string;
      report.resolved_at = new Date().toISOString();
    }
  } else if (normalized.startsWith('DELETE FROM listings WHERE id')) {
    const id = params[0] as number;
    data.listings = data.listings.filter((l) => l.id !== id);
    data.listing_images = data.listing_images.filter((i) => i.listing_id !== id);
  }

  save();
  return { lastInsertRowid: lastId, changes: 1 };
}

function executeQuery(sql: string, params: unknown[]): Row[] {
  const normalized = sql.replace(/\s+/g, ' ').trim();

  if (normalized.includes('SELECT id, email, role, verification_status, status, first_name, last_name FROM users WHERE id')) {
    const u = data.users.find((x) => x.id === params[0]);
    return u ? [u as unknown as Row] : [];
  }

  if (normalized.includes('SELECT id, email, first_name, last_name, phone, bio, role')) {
    const u = data.users.find((x) => x.id === params[0]);
    return u ? [u as unknown as Row] : [];
  }

  if (normalized === 'SELECT id FROM users WHERE email = ?') {
    const u = data.users.find((x) => x.email === params[0]);
    return u ? [{ id: u.id }] : [];
  }

  if (normalized === 'SELECT * FROM users WHERE email = ?') {
    const u = data.users.find((x) => x.email === params[0]);
    return u ? [u as unknown as Row] : [];
  }

  if (normalized === 'SELECT * FROM users WHERE id = ?') {
    const u = data.users.find((x) => x.id === params[0]);
    return u ? [u as unknown as Row] : [];
  }

  if (normalized.includes('SELECT id, first_name, last_name, bio, verification_status')) {
    const u = data.users.find((x) => x.id === Number(params[0]) && x.role === 'student' && x.status === 'active');
    if (!u) return [];
    const reviews = data.reviews.filter((r) => r.reviewee_id === u.id);
    const avg = reviews.length
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null;
    return [{ ...u, avg_rating: avg, review_count: reviews.length } as unknown as Row];
  }

  if (normalized.includes('SELECT id, filename FROM listing_images WHERE listing_id')) {
    return data.listing_images
      .filter((i) => i.listing_id === params[0])
      .sort((a, b) => a.id - b.id) as unknown as Row[];
  }

  if (normalized.includes('SELECT COUNT(*) as c FROM listing_images WHERE listing_id')) {
    const c = data.listing_images.filter((i) => i.listing_id === params[0]).length;
    return [{ c }];
  }

  if (normalized === 'SELECT * FROM listings WHERE id = ?') {
    const l = data.listings.find((x) => x.id === Number(params[0]));
    return l ? [l as unknown as Row] : [];
  }

  if (normalized === 'SELECT * FROM listings WHERE owner_id = ? ORDER BY created_at DESC') {
    return data.listings
      .filter((l) => l.owner_id === params[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at)) as unknown as Row[];
  }

  if (normalized.includes('SELECT id, first_name, last_name, email, phone FROM users WHERE id')) {
    const u = data.users.find((x) => x.id === params[0]);
    return u ? [{ id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, phone: u.phone }] : [];
  }

  if (normalized.includes('SELECT id, title, category, owner_id FROM listings WHERE id')) {
    const l = data.listings.find((x) => x.id === params[0]);
    return l ? [{ id: l.id, title: l.title, category: l.category, owner_id: l.owner_id }] : [];
  }

  if (normalized.includes('SELECT owner_id FROM listings WHERE id')) {
    const l = data.listings.find((x) => x.id === params[0]);
    return l ? [{ owner_id: l.owner_id }] : [];
  }

  if (normalized === 'SELECT * FROM rental_requests WHERE id = ?') {
    const r = data.rental_requests.find((x) => x.id === Number(params[0]));
    return r ? [r as unknown as Row] : [];
  }

  if (normalized.includes('SELECT * FROM rental_requests WHERE renter_id')) {
    return data.rental_requests
      .filter((r) => r.renter_id === params[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at)) as unknown as Row[];
  }

  if (normalized.includes('JOIN listings l ON l.id = rr.listing_id')) {
    return data.rental_requests
      .filter((rr) => {
        const l = data.listings.find((x) => x.id === rr.listing_id);
        return l && l.owner_id === params[0];
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at)) as unknown as Row[];
  }

  if (normalized.includes('SELECT id, verification_status FROM users WHERE id')) {
    const u = data.users.find((x) => x.id === params[0]);
    return u ? [{ id: u.id, verification_status: u.verification_status }] : [];
  }

  if (normalized.includes('SELECT conversation_id FROM conversation_participants WHERE user_id')) {
    return data.conversation_participants
      .filter((p) => p.user_id === params[0])
      .map((p) => ({ conversation_id: p.conversation_id }));
  }

  if (normalized === 'SELECT * FROM conversations WHERE id = ?') {
    const c = data.conversations.find((x) => x.id === Number(params[0]));
    return c ? [c as unknown as Row] : [];
  }

  if (normalized.includes('JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id')) {
    return data.conversation_participants
      .filter((p) => p.conversation_id === params[0])
      .map((p) => {
        const u = data.users.find((x) => x.id === p.user_id)!;
        return { id: u.id, first_name: u.first_name, last_name: u.last_name };
      }) as unknown as Row[];
  }

  if (normalized.includes('SELECT content, created_at, sender_id FROM messages')) {
    const msgs = data.messages
      .filter((m) => m.conversation_id === params[0])
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return msgs.length ? [msgs[0] as unknown as Row] : [];
  }

  if (normalized.includes('SELECT id, title FROM listings WHERE id') && normalized.includes('conversation')) {
    const c = data.conversations.find((x) => x.id === params[0]);
    if (!c?.listing_id) return [];
    const l = data.listings.find((x) => x.id === c.listing_id);
    return l ? [{ id: l.id, title: l.title }] : [];
  }

  if (normalized.includes('SELECT 1 FROM conversation_participants WHERE conversation_id')) {
    const exists = data.conversation_participants.some(
      (p) => p.conversation_id === params[0] && p.user_id === params[1]
    );
    return exists ? [{ '1': 1 }] : [];
  }

  if (normalized.includes('JOIN users u ON u.id = m.sender_id')) {
    return data.messages
      .filter((m) => m.conversation_id === Number(params[0]))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => {
        const u = data.users.find((x) => x.id === m.sender_id)!;
        return { ...m, first_name: u.first_name, last_name: u.last_name };
      }) as unknown as Row[];
  }

  if (normalized.includes('SELECT m.*, u.first_name, u.last_name FROM messages m') && normalized.includes('WHERE m.id')) {
    const m = data.messages.find((x) => x.id === params[0]);
    if (!m) return [];
    const u = data.users.find((x) => x.id === m.sender_id)!;
    return [{ ...m, first_name: u.first_name, last_name: u.last_name } as unknown as Row];
  }

  if (normalized.includes('SELECT id FROM reviews WHERE rental_request_id')) {
    const r = data.reviews.find(
      (x) => x.rental_request_id === params[0] && x.reviewer_id === params[1]
    );
    return r ? [{ id: r.id }] : [];
  }

  if (normalized === 'SELECT * FROM reviews WHERE id = ?') {
    const r = data.reviews.find((x) => x.id === params[0]);
    return r ? [r as unknown as Row] : [];
  }

  if (normalized.includes('JOIN users u ON u.id = r.reviewer_id')) {
    return data.reviews
      .filter((r) => r.reviewee_id === Number(params[0]))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const u = data.users.find((x) => x.id === r.reviewer_id)!;
        return { ...r, first_name: u.first_name, last_name: u.last_name };
      }) as unknown as Row[];
  }

  if (normalized === 'SELECT * FROM reports WHERE id = ?') {
    const r = data.reports.find((x) => x.id === Number(params[0]));
    return r ? [r as unknown as Row] : [];
  }

  // Admin stats
  if (normalized.includes("SELECT COUNT(*) as c FROM users WHERE role = 'student'")) {
    return [{ c: data.users.filter((u) => u.role === 'student').length }];
  }
  if (normalized.includes("verification_status = 'verified'")) {
    return [{ c: data.users.filter((u) => u.verification_status === 'verified').length }];
  }
  if (normalized.includes("verification_status = 'pending'") && normalized.includes('users')) {
    return [{ c: data.users.filter((u) => u.verification_status === 'pending').length }];
  }
  if (normalized === 'SELECT COUNT(*) as c FROM listings') {
    return [{ c: data.listings.length }];
  }
  if (normalized.includes('SELECT COUNT(*)') && normalized.includes('listings') && normalized.includes("availability = 'available'")) {
    return [{ c: data.listings.filter((l) => l.availability === 'available').length }];
  }
  if (normalized === 'SELECT COUNT(*) as c FROM rental_requests') {
    return [{ c: data.rental_requests.length }];
  }
  if (normalized.includes("rental_requests WHERE status = 'pending'")) {
    return [{ c: data.rental_requests.filter((r) => r.status === 'pending').length }];
  }
  if (normalized.includes("rental_requests WHERE status = 'completed'")) {
    return [{ c: data.rental_requests.filter((r) => r.status === 'completed').length }];
  }
  if (normalized.includes("reports WHERE status = 'pending'")) {
    return [{ c: data.reports.filter((r) => r.status === 'pending').length }];
  }
  if (normalized === 'SELECT COUNT(*) as c FROM messages') {
    return [{ c: data.messages.length }];
  }
  if (normalized === 'SELECT COUNT(*) as c FROM reviews') {
    return [{ c: data.reviews.length }];
  }

  if (normalized.includes('verification_status = \'pending\'') && normalized.includes('ORDER BY created_at ASC')) {
    return data.users
      .filter((u) => u.role === 'student' && u.verification_status === 'pending')
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        verification_status: u.verification_status,
        created_at: u.created_at,
      })) as unknown as Row[];
  }

  if (normalized.includes("role = 'student' ORDER BY created_at DESC")) {
    return data.users
      .filter((u) => u.role === 'student')
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((u) => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        verification_status: u.verification_status,
        status: u.status,
        created_at: u.created_at,
      })) as unknown as Row[];
  }

  if (normalized.includes('FROM reports r') && normalized.includes('JOIN users reporter')) {
    return data.reports
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => {
        const reporter = data.users.find((u) => u.id === r.reporter_id)!;
        const reported = r.reported_user_id
          ? data.users.find((u) => u.id === r.reported_user_id)
          : null;
        const listing = r.reported_listing_id
          ? data.listings.find((l) => l.id === r.reported_listing_id)
          : null;
        return {
          ...r,
          reporter_name: `${reporter.first_name} ${reporter.last_name}`,
          reported_user_name: reported ? `${reported.first_name} ${reported.last_name}` : null,
          reported_listing_title: listing?.title || null,
        };
      }) as unknown as Row[];
  }

  // Listings browse query
  if (normalized.includes('SELECT l.* FROM listings l WHERE 1=1') || normalized.includes('SELECT COUNT(*) as total')) {
    let listings = [...data.listings];
    let paramIdx = 0;
    const isCount = normalized.includes('COUNT(*)');

    if (normalized.includes("l.availability = 'available'")) {
      listings = listings.filter((l) => l.availability === 'available');
    }

    const qIdx = normalized.indexOf('title LIKE');
    if (qIdx > -1 && params[paramIdx]) {
      const term = (params[paramIdx] as string).replace(/%/g, '').toLowerCase();
      paramIdx += 2;
      listings = listings.filter(
        (l) =>
          l.title.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term)
      );
    }

    if (normalized.includes('l.category = ?') && params[paramIdx]) {
      listings = listings.filter((l) => l.category === params[paramIdx]);
      paramIdx++;
    }

    if (normalized.includes('l.availability = ?') && params[paramIdx]) {
      listings = listings.filter((l) => l.availability === params[paramIdx]);
      paramIdx++;
    }

    if (isCount) {
      return [{ total: listings.length }];
    }

    listings.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const limit = params[paramIdx] as number;
    const offset = params[paramIdx + 1] as number;
    return listings.slice(offset, offset + limit) as unknown as Row[];
  }

  // Conversation duplicate check
  if (normalized.includes('cp1.conversation_id = cp2.conversation_id')) {
    const user1 = params[0] as number;
    const user2 = params[1] as number;
    const listingId = params[2] as number | undefined;

    for (const c of data.conversations) {
      if (listingId && c.listing_id !== listingId) continue;
      const participants = data.conversation_participants.filter((p) => p.conversation_id === c.id);
      const ids = participants.map((p) => p.user_id);
      if (ids.includes(user1) && ids.includes(user2)) {
        return [{ conversation_id: c.id }];
      }
    }
    return [];
  }

  // Recent activity union
  if (normalized.includes("'registration' as type")) {
    const activity: { type: string; detail: string; created_at: string }[] = [];
    data.users
      .filter((u) => u.role === 'student')
      .forEach((u) => activity.push({ type: 'registration', detail: u.email, created_at: u.created_at }));
    data.listings.forEach((l) =>
      activity.push({ type: 'listing', detail: l.title, created_at: l.created_at })
    );
    data.rental_requests.forEach((r) =>
      activity.push({ type: 'request', detail: r.status, created_at: r.created_at })
    );
    return activity
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20) as unknown as Row[];
  }

  return [];
}

const db = {
  prepare: (sql: string) => new Statement(sql),
  exec: (_sql: string) => {
    initDatabase();
  },
};

export default db;