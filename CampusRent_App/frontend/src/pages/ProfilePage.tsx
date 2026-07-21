import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, User, Listing } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ListingCard from '../components/ListingCard';

export default function ProfilePage() {
  const { user, refreshUser, isVerified } = useAuth();
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', bio: '' });
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name,
        last_name: user.last_name,
        phone: user.phone || '',
        bio: user.bio || '',
      });
    }
  }, [user]);

  useEffect(() => {
    if (isVerified) {
      api.get<Listing[]>('/listings/mine').then(setMyListings).catch(() => {});
    }
  }, [isVerified]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.put<User>('/users/profile', form);
      await refreshUser();
      setMessage('Profile updated successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">My Profile</h1>

      <div className="mt-6 card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">{user.email}</p>
            <h2 className="text-xl font-semibold">
              {user.first_name} {user.last_name}
            </h2>
          </div>
          <StatusBadge status={user.verification_status} />
        </div>

        {user.verification_status === 'pending' && (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your account is pending admin verification. You'll gain full access once approved.
          </div>
        )}

        {isVerified && (
          <form onSubmit={handleSave} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">First Name</label>
                <input
                  className="input-field"
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last Name</label>
                <input
                  className="input-field"
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                className="input-field"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Bio</label>
              <textarea
                className="input-field min-h-[80px]"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
              />
            </div>
            {message && <p className="text-sm text-mint-600">{message}</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        )}
      </div>

      {isVerified && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">My Listings</h2>
            <Link to="/listings/new" className="btn-primary !py-2">+ New Listing</Link>
          </div>
          {myListings.length === 0 ? (
            <div className="card py-8 text-center text-slate-500">
              You haven't listed any items yet.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {myListings.map((l) => (
                <div key={l.id} className="relative">
                  <ListingCard listing={l} />
                  <div className="mt-2 flex gap-2">
                    <Link to={`/listings/${l.id}/edit`} className="btn-secondary flex-1 !py-2 text-center">
                      Edit
                    </Link>
                    <button
                      onClick={async () => {
                        const next = l.availability === 'available' ? 'unavailable' : 'available';
                        await api.patch(`/listings/${l.id}/availability`, { availability: next });
                        setMyListings((prev) =>
                          prev.map((x) => (x.id === l.id ? { ...x, availability: next } : x))
                        );
                      }}
                      className="btn-secondary flex-1 !py-2"
                    >
                      Toggle Availability
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
