import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, Listing } from '../api/client';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { Package, Calendar, User, MessageSquare, Flag, ArrowLeft } from 'lucide-react';

export default function ListingDetailPage() {
  const { id } = useParams();
  const { user, isVerified } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  useEffect(() => {
    api
      .get<Listing>(`/listings/${id}`)
      .then(setListing)
      .catch(() => navigate('/browse'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/requests', {
        listing_id: Number(id),
        start_date: startDate,
        end_date: endDate,
      });
      navigate('/requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const handleContact = async () => {
    if (!listing?.owner?.id) return;
    try {
      const conv = await api.post<{ id: number }>('/conversations', {
        recipient_id: listing.owner.id,
        listing_id: listing.id,
        initial_message: `Hi! I'm interested in renting "${listing.title}".`,
      });
      navigate(`/messages/${conv.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conversation');
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/reports', {
        reported_listing_id: listing?.id,
        reason: reportReason,
        details: reportDetails,
      });
      setShowReport(false);
      setMessage('Report submitted. Our admin team will review it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!listing) return null;

  const isOwner = user?.id === listing.owner?.id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link to="/browse" className="mb-6 inline-flex items-center gap-1 text-sm text-campus-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </Link>

      {message && (
        <div className="mb-4 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-600">{message}</div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          {listing.images?.length ? (
            <div className="grid gap-2">
              <img
                src={listing.images[0].url}
                alt={listing.title}
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />
              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {listing.images.slice(1).map((img, i) => (
                    <img key={i} src={img.url} alt="" className="aspect-square rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-2xl bg-campus-50">
              <Package className="h-20 w-20 text-campus-300" />
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="badge bg-campus-50 text-campus-700">{listing.category}</span>
              <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">{listing.title}</h1>
            </div>
            <StatusBadge status={listing.availability} />
          </div>

          <p className="mt-4 text-slate-600 leading-relaxed">{listing.description}</p>

          {listing.rental_terms && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Rental Terms</h3>
              <p className="mt-1 text-sm text-slate-600">{listing.rental_terms}</p>
            </div>
          )}

          {listing.owner && (
            <div className="mt-6 card !p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <User className="h-4 w-4" /> Owner
              </h3>
              <p className="mt-1 font-medium">
                {listing.owner.first_name} {listing.owner.last_name}
              </p>
              {!listing.contact_hidden && listing.owner.email && (
                <p className="mt-1 text-sm text-slate-500">{listing.owner.email}</p>
              )}
              {listing.contact_hidden && (
                <p className="mt-1 text-sm text-amber-600">Register & verify to see contact info</p>
              )}
            </div>
          )}

          {isVerified && !isOwner && listing.availability === 'available' && (
            <div className="mt-6 space-y-4">
              <form onSubmit={handleRequest} className="card space-y-4">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Calendar className="h-4 w-4" /> Request Rental
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Start Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">End Date</label>
                    <input
                      type="date"
                      className="input-field"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button type="submit" className="btn-primary w-full">Submit Rental Request</button>
              </form>

              <button onClick={handleContact} className="btn-secondary w-full">
                <MessageSquare className="h-4 w-4" /> Contact Owner
              </button>
            </div>
          )}

          {!user && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Link to="/register" className="font-semibold underline">Register</Link> with your
              institutional email to request rentals and message owners.
            </div>
          )}

          {user && !isVerified && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account is pending verification. You'll be able to request rentals once approved.
            </div>
          )}

          {isVerified && !isOwner && (
            <button
              onClick={() => setShowReport(true)}
              className="mt-4 flex items-center gap-1 text-sm text-slate-400 hover:text-red-600"
            >
              <Flag className="h-3 w-3" /> Report this listing
            </button>
          )}
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleReport} className="card w-full max-w-md space-y-4">
            <h3 className="font-display text-lg font-bold">Report Listing</h3>
            <input
              className="input-field"
              placeholder="Reason"
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              required
            />
            <textarea
              className="input-field min-h-[100px]"
              placeholder="Details..."
              value={reportDetails}
              onChange={(e) => setReportDetails(e.target.value)}
              required
            />
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowReport(false)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-danger flex-1">Submit Report</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
