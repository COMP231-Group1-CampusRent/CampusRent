import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  api,
  type Listing,
} from '../api/client';

import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

import {
  Package,
  Calendar,
  User,
  MessageSquare,
  Flag,
  ArrowLeft,
  Pencil,
} from 'lucide-react';

/**
 * Returns either the MongoDB _id or the legacy id.
 */
function getDocumentId(document?: {
  _id?: string;
  id?: string | number;
} | null): string | undefined {
  const value = document?._id ?? document?.id;

  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

/**
 * Returns today's date using the YYYY-MM-DD format required
 * by HTML date inputs.
 */
function getToday(): string {
  const now = new Date();
  const timezoneOffset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffset)
    .toISOString()
    .split('T')[0];
}

/**
 * Converts an uploaded image path into the full backend URL.
 */
function getImageUrl(imagePath?: string): string {
  if (!imagePath) {
    return '';
  }

  if (imagePath.startsWith('http')) {
    return imagePath;
  }

  const apiUrl = new URL(import.meta.env.VITE_API_BASE_URL);
  const backendOrigin = apiUrl.origin;

  return `${backendOrigin}${imagePath}`;
}

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isVerified } = useAuth();
  const navigate = useNavigate();

  const [listing, setListing] =
    useState<Listing | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [submittingRequest, setSubmittingRequest] =
    useState<boolean>(false);

  const [submittingReport, setSubmittingReport] =
    useState<boolean>(false);

  const [startingConversation, setStartingConversation] =
    useState<boolean>(false);

  const [startDate, setStartDate] =
    useState<string>('');

  const [endDate, setEndDate] =
    useState<string>('');

  const [message, setMessage] =
    useState<string>('');

  const [error, setError] =
    useState<string>('');

  const [showReport, setShowReport] =
    useState<boolean>(false);

  const [reportReason, setReportReason] =
    useState<string>('');

  const [reportDetails, setReportDetails] =
    useState<string>('');

  const today = getToday();

  useEffect(() => {
    if (!id) {
      navigate('/browse');
      return;
    }

    setLoading(true);
    setError('');

    api
      .get<Listing>(`/listings/${id}`)
      .then((response) => {
        setListing(response);
      })
      .catch((requestError: unknown) => {
        console.error(
          'Unable to load listing:',
          requestError
        );

        navigate('/browse');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, navigate]);

  const handleRequest = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setError('');
    setMessage('');

    const listingId =
      getDocumentId(listing) ?? id;

    if (!listingId) {
      setError(
        'The listing ID is missing. Please refresh the page.'
      );
      return;
    }

    if (!startDate || !endDate) {
      setError(
        'Please select both a start date and an end date.'
      );
      return;
    }

    if (endDate < startDate) {
      setError(
        'The end date must be on or after the start date.'
      );
      return;
    }

    setSubmittingRequest(true);

    try {
      await api.post('/requests', {
        listing_id: listingId,
        start_date: startDate,
        end_date: endDate,
      });

      navigate('/requests');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Failed to submit the rental request.'
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleContact = async (): Promise<void> => {
    setError('');
    setMessage('');

    const ownerId =
      getDocumentId(listing?.owner);

    const listingId =
      getDocumentId(listing) ?? id;

    if (!ownerId) {
      setError(
        'The listing owner ID is missing.'
      );
      return;
    }

    if (!listingId) {
      setError(
        'The listing ID is missing.'
      );
      return;
    }

    setStartingConversation(true);

    try {
      const conversation =
        await api.post<{
          _id?: string;
          id?: string | number;
        }>('/conversations', {
          recipient_id: ownerId,
          listing_id: listingId,
          initial_message:
            `Hi! I'm interested in renting "${listing?.title}".`,
        });

      const conversationId =
        getDocumentId(conversation);

      if (!conversationId) {
        throw new Error(
          'The conversation was created, but its ID was not returned.'
        );
      }

      navigate(`/messages/${conversationId}`);
    } catch (contactError) {
      setError(
        contactError instanceof Error
          ? contactError.message
          : 'Failed to start the conversation.'
      );
    } finally {
      setStartingConversation(false);
    }
  };

  const handleReport = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setError('');
    setMessage('');

    const listingId =
      getDocumentId(listing) ?? id;

    if (!listingId) {
      setError(
        'The listing ID is missing.'
      );
      return;
    }

    setSubmittingReport(true);

    try {
      await api.post('/reports', {
        reported_listing_id: listingId,
        reason: reportReason.trim(),
        details: reportDetails.trim(),
      });

      setShowReport(false);
      setReportReason('');
      setReportDetails('');

      setMessage(
        'Report submitted. Our admin team will review it.'
      );
    } catch (reportError) {
      setError(
        reportError instanceof Error
          ? reportError.message
          : 'Failed to submit the report.'
      );
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    );
  }

  if (!listing) {
    return null;
  }

  const currentUserId =
    getDocumentId(user);

  const ownerId =
    getDocumentId(listing.owner);

  const listingId =
    getDocumentId(listing);

  const isOwner =
    Boolean(
      currentUserId &&
      ownerId &&
      currentUserId === ownerId
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/browse"
        className="mb-6 inline-flex items-center gap-1 text-sm text-campus-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to browse
      </Link>

      {message && (
        <div className="mb-4 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-600">
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          {listing.images?.length ? (
            <div className="grid gap-2">
              <img
                src={getImageUrl(listing.images[0].url)}
                alt={listing.title}
                className="aspect-[4/3] w-full rounded-2xl object-cover"
              />

              {listing.images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                  {listing.images
                    .slice(1)
                    .map((image, index) => (
                      <img
                        key={`${image.url}-${index}`}
                        src={getImageUrl(image.url)}
                        alt=""
                        className="aspect-square rounded-lg object-cover"
                      />
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
              <span className="badge bg-campus-50 text-campus-700">
                {listing.category}
              </span>

              <h1 className="mt-2 font-display text-3xl font-bold text-slate-900">
                {listing.title}
              </h1>
            </div>

            <StatusBadge status={listing.availability} />
          </div>

          {isOwner && listingId && (
            <div className="mt-4">
              <Link
                to={`/listings/${listingId}/edit`}
                className="btn-secondary inline-flex items-center gap-2"
              >
                <Pencil className="h-4 w-4" />
                Edit Listing
              </Link>
            </div>
          )}

          <p className="mt-4 leading-relaxed text-slate-600">
            {listing.description}
          </p>

          {listing.rental_terms && (
            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                Rental Terms
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                {listing.rental_terms}
              </p>
            </div>
          )}

          {listing.owner && (
            <div className="card mt-6 !p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <User className="h-4 w-4" />
                Owner
              </h3>

              <p className="mt-1 font-medium">
                {listing.owner.first_name}{' '}
                {listing.owner.last_name}
              </p>

              {!listing.contact_hidden &&
                listing.owner.email && (
                  <p className="mt-1 text-sm text-slate-500">
                    {listing.owner.email}
                  </p>
                )}

              {listing.contact_hidden && (
                <p className="mt-1 text-sm text-amber-600">
                  Register and verify your account to see contact information.
                </p>
              )}
            </div>
          )}

          {isVerified &&
            !isOwner &&
            listing.availability === 'available' && (
              <div className="mt-6 space-y-4">
                <form
                  onSubmit={handleRequest}
                  className="card space-y-4"
                >
                  <h3 className="flex items-center gap-2 font-semibold">
                    <Calendar className="h-4 w-4" />
                    Request Rental
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="rental-start-date"
                        className="mb-1 block text-sm font-medium"
                      >
                        Start Date
                      </label>

                      <input
                        id="rental-start-date"
                        type="date"
                        className="input-field"
                        value={startDate}
                        min={today}
                        onChange={(event) => {
                          const newStartDate =
                            event.target.value;

                          setStartDate(newStartDate);

                          if (
                            endDate &&
                            endDate < newStartDate
                          ) {
                            setEndDate('');
                          }
                        }}
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="rental-end-date"
                        className="mb-1 block text-sm font-medium"
                      >
                        End Date
                      </label>

                      <input
                        id="rental-end-date"
                        type="date"
                        className="input-field"
                        value={endDate}
                        min={startDate || today}
                        onChange={(event) =>
                          setEndDate(event.target.value)
                        }
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submittingRequest
                      ? 'Submitting...'
                      : 'Submit Rental Request'}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={() => void handleContact()}
                  disabled={startingConversation}
                  className="btn-secondary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageSquare className="h-4 w-4" />

                  {startingConversation
                    ? 'Starting conversation...'
                    : 'Contact Owner'}
                </button>
              </div>
            )}

          {!user && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <Link
                to="/register"
                className="font-semibold underline"
              >
                Register
              </Link>{' '}
              with your institutional email to request rentals and message owners.
            </div>
          )}

          {user && !isVerified && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account is pending verification. You will be able to request rentals once approved.
            </div>
          )}

          {isVerified && !isOwner && (
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="mt-4 flex items-center gap-1 text-sm text-slate-400 hover:text-red-600"
            >
              <Flag className="h-3 w-3" />
              Report this listing
            </button>
          )}
        </div>
      </div>

      {showReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleReport}
            className="card w-full max-w-md space-y-4"
          >
            <h3 className="font-display text-lg font-bold">
              Report Listing
            </h3>

            <input
              className="input-field"
              placeholder="Reason"
              value={reportReason}
              onChange={(event) =>
                setReportReason(event.target.value)
              }
              required
            />

            <textarea
              className="input-field min-h-[100px]"
              placeholder="Details..."
              value={reportDetails}
              onChange={(event) =>
                setReportDetails(event.target.value)
              }
              required
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReport(false)}
                disabled={submittingReport}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submittingReport}
                className="btn-danger flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReport
                  ? 'Submitting...'
                  : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}