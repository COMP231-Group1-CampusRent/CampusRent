import { useEffect, useState } from 'react';
import { api, RentalRequest } from '../api/client';
import StatusBadge from '../components/StatusBadge';
import { Star } from 'lucide-react';

export default function RequestsPage() {
  const [tab, setTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [outgoing, setOutgoing] = useState<RentalRequest[]>([]);
  const [incoming, setIncoming] = useState<RentalRequest[]>([]);
  const [reviewForm, setReviewForm] = useState<{ id: number; rating: number; comment: string } | null>(null);

  const load = () => {
    api.get<RentalRequest[]>('/requests/outgoing').then(setOutgoing).catch(() => {});
    api.get<RentalRequest[]>('/requests/incoming').then(setIncoming).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const requests = tab === 'outgoing' ? outgoing : incoming;

  const handleAction = async (id: number, action: string) => {
    await api.patch(`/requests/${id}/${action}`);
    load();
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewForm) return;
    await api.post('/reviews', {
      rental_request_id: reviewForm.id,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
    });
    setReviewForm(null);
    load();
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">Rental Requests</h1>

      <div className="mt-6 flex gap-2">
        {(['outgoing', 'incoming'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-campus-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t === 'outgoing' ? 'My Requests' : 'Incoming'}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {requests.length === 0 ? (
          <div className="card py-12 text-center text-slate-500">No requests yet</div>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{r.listing?.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {r.start_date} → {r.end_date}
                  </p>
                  {tab === 'incoming' && r.renter && (
                    <p className="mt-1 text-sm">
                      Renter: {r.renter.first_name} {r.renter.last_name}
                    </p>
                  )}
                  {tab === 'outgoing' && r.owner && (
                    <p className="mt-1 text-sm">
                      Owner: {r.owner.first_name} {r.owner.last_name}
                    </p>
                  )}
                </div>
                <StatusBadge status={r.status} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {tab === 'incoming' && r.status === 'pending' && (
                  <>
                    <button onClick={() => handleAction(r.id, 'approve')} className="btn-primary !py-2">
                      Approve
                    </button>
                    <button onClick={() => handleAction(r.id, 'decline')} className="btn-secondary !py-2">
                      Decline
                    </button>
                  </>
                )}
                {tab === 'outgoing' && r.status === 'pending' && (
                  <button onClick={() => handleAction(r.id, 'cancel')} className="btn-secondary !py-2">
                    Cancel
                  </button>
                )}
                {r.status === 'accepted' && (
                  <button onClick={() => handleAction(r.id, 'complete')} className="btn-primary !py-2">
                    Mark Completed
                  </button>
                )}
                {r.status === 'completed' && (
                  <button
                    onClick={() => setReviewForm({ id: r.id, rating: 5, comment: '' })}
                    className="btn-secondary !py-2"
                  >
                    <Star className="h-4 w-4" /> Leave Review
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {reviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitReview} className="card w-full max-w-md space-y-4">
            <h3 className="font-display text-lg font-bold">Leave a Review</h3>
            <div>
              <label className="mb-1 block text-sm font-medium">Rating (1-5)</label>
              <select
                className="input-field"
                value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
                ))}
              </select>
            </div>
            <textarea
              className="input-field min-h-[80px]"
              placeholder="Your review..."
              value={reviewForm.comment}
              onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setReviewForm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">Submit</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
