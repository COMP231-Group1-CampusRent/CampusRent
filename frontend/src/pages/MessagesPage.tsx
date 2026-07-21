import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, Conversation, Message } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Send } from 'lucide-react';

export default function MessagesPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadConversations = () => {
    api.get<Conversation[]>('/conversations').then(setConversations).catch(() => {});
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (id) {
      api.get<Message[]>(`/conversations/${id}/messages`).then(setMessages).catch(() => {});
    }
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim()) return;
    const msg = await api.post<Message>(`/conversations/${id}/messages`, { content: newMessage });
    setMessages((prev) => [...prev, msg]);
    setNewMessage('');
    loadConversations();
  };

  const activeConv = conversations.find((c) => c.id === Number(id));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">Messages</h1>

      <div className="mt-6 grid gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:grid-cols-3 lg:h-[600px]">
        <div className="border-b border-slate-100 lg:border-b-0 lg:border-r overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No conversations yet</p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                to={`/messages/${c.id}`}
                className={`block border-b border-slate-50 p-4 transition hover:bg-campus-50 ${
                  Number(id) === c.id ? 'bg-campus-50' : ''
                }`}
              >
                <p className="font-medium text-slate-900">
                  {c.other_participant
                    ? `${c.other_participant.first_name} ${c.other_participant.last_name}`
                    : 'Conversation'}
                </p>
                {c.listing && (
                  <p className="text-xs text-campus-600">{c.listing.title}</p>
                )}
                {c.last_message && (
                  <p className="mt-1 truncate text-sm text-slate-400">{c.last_message.content}</p>
                )}
              </Link>
            ))
          )}
        </div>

        <div className="flex flex-col lg:col-span-2">
          {id && activeConv ? (
            <>
              <div className="border-b border-slate-100 p-4">
                <p className="font-semibold">
                  {activeConv.other_participant
                    ? `${activeConv.other_participant.first_name} ${activeConv.other_participant.last_name}`
                    : 'Chat'}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => {
                  const isMine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMine
                            ? 'bg-campus-600 text-white rounded-br-md'
                            : 'bg-slate-100 text-slate-800 rounded-bl-md'
                        }`}
                      >
                        {!isMine && (
                          <p className="mb-0.5 text-xs font-medium opacity-70">
                            {m.first_name}
                          </p>
                        )}
                        <p>{m.content}</p>
                        <p className={`mt-1 text-[10px] ${isMine ? 'text-campus-200' : 'text-slate-400'}`}>
                          {new Date(m.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-100 p-4">
                <input
                  className="input-field flex-1"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn-primary !px-4">
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-slate-400">
              Select a conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
