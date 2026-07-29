import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  api,
  type RentalRequest,
} from '../api/client';

import StatusBadge from '../components/StatusBadge';
import { Star } from 'lucide-react';

interface ReviewFormState {
  requestId: string;
  rating: number;
  comment: string;
}

function getDocumentId(
  document:
    | {
        _id?: string;
        id?: string | number;
      }
    | null
    | undefined
): string | undefined {
  const value =
    document?._id ?? document?.id;

  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  return String(value);
}

function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

function formatDate(
  value?: string
): string {
  if (!value) {
    return 'Date unavailable';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

export default function RequestsPage() {
  const [tab, setTab] =
    useState<
      'outgoing' | 'incoming'
    >('outgoing');

  const [outgoing, setOutgoing] =
    useState<RentalRequest[]>([]);

  const [incoming, setIncoming] =
    useState<RentalRequest[]>([]);

  const [reviewForm, setReviewForm] =
    useState<ReviewFormState | null>(
      null
    );

  const [loading, setLoading] =
    useState<boolean>(true);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [submittingReview, setSubmittingReview] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string>('');

  const [message, setMessage] =
    useState<string>('');

  const load = useCallback(
    async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const [
          outgoingResponse,
          incomingResponse,
        ] = await Promise.all([
          api.get<RentalRequest[]>(
            '/requests/outgoing'
          ),

          api.get<RentalRequest[]>(
            '/requests/incoming'
          ),
        ]);

        setOutgoing(
          Array.isArray(outgoingResponse)
            ? outgoingResponse
            : []
        );

        setIncoming(
          Array.isArray(incomingResponse)
            ? incomingResponse
            : []
        );
      } catch (loadError) {
        console.error(
          'Unable to load rental requests:',
          loadError
        );

        setError(
          `Unable to load rental requests: ${getErrorMessage(
            loadError
          )}`
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  const requests =
    tab === 'outgoing'
      ? outgoing
      : incoming;

  const handleAction = async (
    requestId: string,
    action:
      | 'approve'
      | 'decline'
      | 'cancel'
      | 'complete'
  ): Promise<void> => {
    setProcessingId(requestId);
    setError('');
    setMessage('');

    try {
      await api.patch(
        `/requests/${requestId}/${action}`
      );

      const successMessages = {
        approve:
          'Rental request approved.',
        decline:
          'Rental request declined.',
        cancel:
          'Rental request cancelled.',
        complete:
          'Rental marked as completed.',
      };

      setMessage(
        successMessages[action]
      );

      await load();
    } catch (actionError) {
      console.error(
        `Unable to ${action} rental request:`,
        actionError
      );

      setError(
        getErrorMessage(actionError)
      );
    } finally {
      setProcessingId(null);
    }
  };

  const openReviewForm = (
    request: RentalRequest
  ): void => {
    const requestId =
      getDocumentId(request);

    if (!requestId) {
      setError(
        'Rental request ID is missing.'
      );
      return;
    }

    setError('');
    setMessage('');

    setReviewForm({
      requestId,
      rating: 5,
      comment: '',
    });
  };

  const submitReview = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (!reviewForm) {
      return;
    }

    if (
      reviewForm.rating < 1 ||
      reviewForm.rating > 5
    ) {
      setError(
        'Rating must be between 1 and 5.'
      );
      return;
    }

    setSubmittingReview(true);
    setError('');
    setMessage('');

    try {
      await api.post(
        '/reviews',
        {
          rental_request_id:
            reviewForm.requestId,

          rating:
            reviewForm.rating,

          comment:
            reviewForm.comment.trim(),
        }
      );

      setReviewForm(null);

      setMessage(
        'Review submitted successfully.'
      );

      await load();
    } catch (reviewError) {
      console.error(
        'Unable to submit review:',
        reviewError
      );

      setError(
        getErrorMessage(reviewError)
      );
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Rental Requests
      </h1>

      {message && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {(
          [
            'outgoing',
            'incoming',
          ] as const
        ).map((currentTab) => (
          <button
            key={currentTab}
            type="button"
            onClick={() =>
              setTab(currentTab)
            }
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === currentTab
                ? 'bg-campus-600 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentTab === 'outgoing'
              ? 'My Requests'
              : 'Incoming'}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="card py-12 text-center text-slate-500">
            Loading requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="card py-12 text-center text-slate-500">
            No requests yet
          </div>
        ) : (
          requests.map(
            (request) => {
              const requestId =
                getDocumentId(request);

              if (!requestId) {
                return null;
              }

              const isProcessing =
                processingId ===
                requestId;

              return (
                <div
                  key={requestId}
                  className="card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {request.listing
                          ?.title ??
                          'Listing unavailable'}
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(
                          request.start_date
                        )}{' '}
                        →{' '}
                        {formatDate(
                          request.end_date
                        )}
                      </p>

                      {tab ===
                        'incoming' &&
                        request.renter && (
                          <p className="mt-1 text-sm">
                            Renter:{' '}
                            {
                              request
                                .renter
                                .first_name
                            }{' '}
                            {
                              request
                                .renter
                                .last_name
                            }
                          </p>
                        )}

                      {tab ===
                        'outgoing' &&
                        request.owner && (
                          <p className="mt-1 text-sm">
                            Owner:{' '}
                            {
                              request
                                .owner
                                .first_name
                            }{' '}
                            {
                              request
                                .owner
                                .last_name
                            }
                          </p>
                        )}
                    </div>

                    <StatusBadge
                      status={
                        request.status
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {tab ===
                      'incoming' &&
                      request.status ===
                        'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={
                              isProcessing
                            }
                            onClick={() =>
                              void handleAction(
                                requestId,
                                'approve'
                              )
                            }
                            className="btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isProcessing
                              ? 'Processing...'
                              : 'Approve'}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isProcessing
                            }
                            onClick={() =>
                              void handleAction(
                                requestId,
                                'decline'
                              )
                            }
                            className="btn-secondary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </>
                      )}

                    {tab ===
                      'outgoing' &&
                      request.status ===
                        'pending' && (
                        <button
                          type="button"
                          disabled={
                            isProcessing
                          }
                          onClick={() =>
                            void handleAction(
                              requestId,
                              'cancel'
                            )
                          }
                          className="btn-secondary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing
                            ? 'Processing...'
                            : 'Cancel'}
                        </button>
                      )}

                    {request.status ===
                      'approved' && (
                      <button
                        type="button"
                        disabled={
                          isProcessing
                        }
                        onClick={() =>
                          void handleAction(
                            requestId,
                            'complete'
                          )
                        }
                        className="btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing
                          ? 'Processing...'
                          : 'Mark Completed'}
                      </button>
                    )}

                    {request.status ===
                      'completed' && (
                      <button
                        type="button"
                        onClick={() =>
                          openReviewForm(
                            request
                          )
                        }
                        className="btn-secondary !py-2"
                      >
                        <Star className="h-4 w-4" />
                        Leave Review
                      </button>
                    )}
                  </div>
                </div>
              );
            }
          )
        )}
      </div>

      {reviewForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitReview}
            className="card w-full max-w-md space-y-4"
          >
            <h3 className="font-display text-lg font-bold">
              Leave a Review
            </h3>

            <div>
              <label
                htmlFor="review-rating"
                className="mb-1 block text-sm font-medium"
              >
                Rating
              </label>

              <select
                id="review-rating"
                className="input-field"
                value={
                  reviewForm.rating
                }
                onChange={(event) =>
                  setReviewForm({
                    ...reviewForm,
                    rating: Number(
                      event.target.value
                    ),
                  })
                }
              >
                {[1, 2, 3, 4, 5].map(
                  (rating) => (
                    <option
                      key={rating}
                      value={rating}
                    >
                      {rating}{' '}
                      {rating === 1
                        ? 'star'
                        : 'stars'}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="review-comment"
                className="mb-1 block text-sm font-medium"
              >
                Comment
              </label>

              <textarea
                id="review-comment"
                className="input-field min-h-[100px]"
                placeholder="Describe your rental experience..."
                value={
                  reviewForm.comment
                }
                onChange={(event) =>
                  setReviewForm({
                    ...reviewForm,
                    comment:
                      event.target
                        .value,
                  })
                }
                maxLength={1000}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={
                  submittingReview
                }
                onClick={() =>
                  setReviewForm(null)
                }
                className="btn-secondary flex-1"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  submittingReview
                }
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReview
                  ? 'Submitting...'
                  : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}