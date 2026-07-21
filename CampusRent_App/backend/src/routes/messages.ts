import { Router } from 'express';
import db from '../db';
import { authenticate, requireVerifiedStudent } from '../middleware/auth';

const router = Router();

function getConversationWithDetails(conversationId: number, userId: number) {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId);
  if (!conversation) return null;

  const participants = db
    .prepare(
      `SELECT u.id, u.first_name, u.last_name FROM conversation_participants cp
       JOIN users u ON u.id = cp.user_id WHERE cp.conversation_id = ?`
    )
    .all(conversationId);

  const lastMessage = db
    .prepare(
      `SELECT content, created_at, sender_id FROM messages
       WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`
    )
    .get(conversationId);

  const listing = (conversation as { listing_id: number | null }).listing_id
    ? db
        .prepare('SELECT id, title FROM listings WHERE id = ?')
        .get((conversation as { listing_id: number }).listing_id)
    : null;

  return {
    ...conversation,
    participants,
    last_message: lastMessage || null,
    listing,
    other_participant: (participants as { id: number; first_name: string; last_name: string }[]).find(
      (p) => p.id !== userId
    ),
  };
}

router.get('/', authenticate, requireVerifiedStudent, (req, res) => {
  const convIds = db
    .prepare(
      `SELECT conversation_id FROM conversation_participants WHERE user_id = ?`
    )
    .all(req.user!.id) as { conversation_id: number }[];

  const conversations = convIds
    .map((c) => getConversationWithDetails(c.conversation_id, req.user!.id))
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.last_message?.created_at || a?.created_at || '';
      const bTime = b?.last_message?.created_at || b?.created_at || '';
      return bTime.localeCompare(aTime);
    });

  res.json(conversations);
});

router.post('/', authenticate, requireVerifiedStudent, (req, res) => {
  const { recipient_id, listing_id, initial_message } = req.body;

  if (!recipient_id) {
    return res.status(400).json({ error: 'Recipient is required' });
  }
  if (recipient_id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot start conversation with yourself' });
  }
  if (!initial_message?.trim()) {
    return res.status(400).json({ error: 'Initial message is required' });
  }

  const recipient = db.prepare('SELECT id, verification_status FROM users WHERE id = ?').get(
    recipient_id
  ) as { id: number; verification_status: string } | undefined;
  if (!recipient || recipient.verification_status !== 'verified') {
    return res.status(400).json({ error: 'Recipient not found or not verified' });
  }

  const existing = db
    .prepare(
      `SELECT cp1.conversation_id FROM conversation_participants cp1
       JOIN conversation_participants cp2 ON cp1.conversation_id = cp2.conversation_id
       WHERE cp1.user_id = ? AND cp2.user_id = ?
       ${listing_id ? 'AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = cp1.conversation_id AND c.listing_id = ?)' : ''}
       LIMIT 1`
    )
    .get(
      ...(listing_id
        ? [req.user!.id, recipient_id, listing_id]
        : [req.user!.id, recipient_id])
    ) as { conversation_id: number } | undefined;

  if (existing) {
    db.prepare('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(
      existing.conversation_id,
      req.user!.id,
      initial_message.trim()
    );
    return res.json(getConversationWithDetails(existing.conversation_id, req.user!.id));
  }

  const result = db
    .prepare('INSERT INTO conversations (listing_id) VALUES (?)')
    .run(listing_id || null);
  const convId = result.lastInsertRowid as number;

  const addParticipant = db.prepare(
    'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)'
  );
  addParticipant.run(convId, req.user!.id);
  addParticipant.run(convId, recipient_id);

  db.prepare('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)').run(
    convId,
    req.user!.id,
    initial_message.trim()
  );

  res.status(201).json(getConversationWithDetails(convId, req.user!.id));
});

router.get('/:id/messages', authenticate, requireVerifiedStudent, (req, res) => {
  const participant = db
    .prepare(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    )
    .get(req.params.id, req.user!.id);

  if (!participant) return res.status(403).json({ error: 'Access denied' });

  const messages = db
    .prepare(
      `SELECT m.*, u.first_name, u.last_name FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = ? ORDER BY m.created_at ASC`
    )
    .all(req.params.id);

  res.json(messages);
});

router.post('/:id/messages', authenticate, requireVerifiedStudent, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Message content is required' });
  }

  const participant = db
    .prepare(
      'SELECT 1 FROM conversation_participants WHERE conversation_id = ? AND user_id = ?'
    )
    .get(req.params.id, req.user!.id);

  if (!participant) return res.status(403).json({ error: 'Access denied' });

  const result = db
    .prepare('INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)')
    .run(req.params.id, req.user!.id, content.trim());

  const message = db
    .prepare(
      `SELECT m.*, u.first_name, u.last_name FROM messages m
       JOIN users u ON u.id = m.sender_id WHERE m.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json(message);
});

export default router;
