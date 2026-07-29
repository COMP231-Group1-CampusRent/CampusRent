import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import { Link } from 'react-router-dom';

import {
  api,
  type User,
  type Listing,
  type Review,
} from '../api/client';

import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ListingCard from '../components/ListingCard';

import {
  Star,
  MessageSquare,
} from 'lucide-react';

interface ProfileForm {
  first_name: string;
  last_name: string;
  phone: string;
  bio: string;
}

/**
 * Supports both MongoDB "_id" and legacy "id".
 */
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

/**
 * Converts an unknown error into a readable message.
 */
function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

/**
 * Formats dates safely for the profile review section.
 */
function formatDate(
  value?: string
): string {
  if (!value) {
    return 'Date unavailable';
  }

  const parsedDate =
    new Date(value);

  if (
    Number.isNaN(
      parsedDate.getTime()
    )
  ) {
    return 'Date unavailable';
  }

  return parsedDate.toLocaleDateString();
}

export default function ProfilePage() {
  const {
    user,
    refreshUser,
    isVerified,
  } = useAuth();

  const [form, setForm] =
    useState<ProfileForm>({
      first_name: '',
      last_name: '',
      phone: '',
      bio: '',
    });

  const [
    myListings,
    setMyListings,
  ] = useState<Listing[]>([]);

  const [
    reviews,
    setReviews,
  ] = useState<Review[]>([]);

  const [
    loadingListings,
    setLoadingListings,
  ] = useState<boolean>(false);

  const [
    loadingReviews,
    setLoadingReviews,
  ] = useState<boolean>(false);

  const [
    savingProfile,
    setSavingProfile,
  ] = useState<boolean>(false);

  const [
    processingListingId,
    setProcessingListingId,
  ] = useState<string | null>(
    null
  );

  const [message, setMessage] =
    useState<string>('');

  const [error, setError] =
    useState<string>('');

  const userId =
    getDocumentId(user);

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm({
      first_name:
        user.first_name ?? '',

      last_name:
        user.last_name ?? '',

      phone:
        user.phone ?? '',

      bio:
        user.bio ?? '',
    });
  }, [user]);

  /**
   * Loads the current user's listings.
   */
  const loadListings =
    useCallback(
      async (): Promise<void> => {
        if (!isVerified) {
          setMyListings([]);
          return;
        }

        setLoadingListings(true);

        try {
          const response =
            await api.get<
              Listing[]
            >('/listings/mine');

          setMyListings(
            Array.isArray(response)
              ? response
              : []
          );
        } catch (loadError) {
          console.error(
            'Unable to load listings:',
            loadError
          );

          setError(
            `Unable to load your listings: ${getErrorMessage(
              loadError
            )}`
          );
        } finally {
          setLoadingListings(false);
        }
      },
      [isVerified]
    );

  /**
   * Loads reviews received by the signed-in user.
   */
  const loadReviews =
    useCallback(
      async (): Promise<void> => {
        if (
          !isVerified ||
          !userId
        ) {
          setReviews([]);
          return;
        }

        setLoadingReviews(true);

        try {
          const response =
            await api.get<
              Review[]
            >(
              `/reviews/user/${userId}`
            );

          setReviews(
            Array.isArray(response)
              ? response
              : []
          );
        } catch (loadError) {
          console.error(
            'Unable to load reviews:',
            loadError
          );

          setError(
            `Unable to load reviews: ${getErrorMessage(
              loadError
            )}`
          );
        } finally {
          setLoadingReviews(false);
        }
      },
      [
        isVerified,
        userId,
      ]
    );

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const averageRating =
    useMemo(() => {
      if (
        reviews.length === 0
      ) {
        return 0;
      }

      const total =
        reviews.reduce(
          (
            sum,
            review
          ) =>
            sum +
            Number(
              review.rating
            ),
          0
        );

      return (
        total /
        reviews.length
      );
    }, [reviews]);

  const handleSave = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    setSavingProfile(true);
    setError('');
    setMessage('');

    try {
      await api.put<User>(
        '/users/profile',
        {
          first_name:
            form.first_name.trim(),

          last_name:
            form.last_name.trim(),

          phone:
            form.phone.trim(),

          bio:
            form.bio.trim(),
        }
      );

      await refreshUser();

      setMessage(
        'Profile updated successfully.'
      );
    } catch (saveError) {
      console.error(
        'Unable to update profile:',
        saveError
      );

      setError(
        getErrorMessage(
          saveError
        )
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const toggleAvailability =
    async (
      listing: Listing
    ): Promise<void> => {
      const listingId =
        getDocumentId(listing);

      if (!listingId) {
        setError(
          'Listing ID is missing.'
        );
        return;
      }

      const nextAvailability =
        listing.availability ===
        'available'
          ? 'unavailable'
          : 'available';

      setProcessingListingId(
        listingId
      );

      setError('');
      setMessage('');

      try {
        await api.patch(
          `/listings/${listingId}/availability`,
          {
            availability:
              nextAvailability,
          }
        );

        setMyListings(
          (
            previousListings
          ) =>
            previousListings.map(
              (
                currentListing
              ) => {
                const currentId =
                  getDocumentId(
                    currentListing
                  );

                if (
                  currentId !==
                  listingId
                ) {
                  return currentListing;
                }

                return {
                  ...currentListing,
                  availability:
                    nextAvailability,
                };
              }
            )
        );

        setMessage(
          'Listing availability updated.'
        );
      } catch (
        availabilityError
      ) {
        console.error(
          'Unable to update listing availability:',
          availabilityError
        );

        setError(
          getErrorMessage(
            availabilityError
          )
        );
      } finally {
        setProcessingListingId(
          null
        );
      }
    };

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">
        My Profile
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

      <div className="card mt-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              {user.email}
            </p>

            <h2 className="text-xl font-semibold text-slate-900">
              {user.first_name}{' '}
              {user.last_name}
            </h2>
          </div>

          <StatusBadge
            status={
              user.verification_status
            }
          />
        </div>

        {user.verification_status ===
          'pending' && (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your account is pending administrator verification. You will gain full access once approved.
          </div>
        )}

        {isVerified && (
          <form
            onSubmit={handleSave}
            className="mt-6 space-y-4 border-t border-slate-100 pt-6"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="profile-first-name"
                  className="mb-1 block text-sm font-medium"
                >
                  First Name
                </label>

                <input
                  id="profile-first-name"
                  className="input-field"
                  value={
                    form.first_name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      first_name:
                        event.target
                          .value,
                    })
                  }
                  required
                  maxLength={100}
                />
              </div>

              <div>
                <label
                  htmlFor="profile-last-name"
                  className="mb-1 block text-sm font-medium"
                >
                  Last Name
                </label>

                <input
                  id="profile-last-name"
                  className="input-field"
                  value={
                    form.last_name
                  }
                  onChange={(
                    event
                  ) =>
                    setForm({
                      ...form,
                      last_name:
                        event.target
                          .value,
                    })
                  }
                  required
                  maxLength={100}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="profile-phone"
                className="mb-1 block text-sm font-medium"
              >
                Phone
              </label>

              <input
                id="profile-phone"
                className="input-field"
                value={form.phone}
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,
                    phone:
                      event.target
                        .value,
                  })
                }
                maxLength={30}
              />
            </div>

            <div>
              <label
                htmlFor="profile-bio"
                className="mb-1 block text-sm font-medium"
              >
                Bio
              </label>

              <textarea
                id="profile-bio"
                className="input-field min-h-[100px]"
                value={form.bio}
                onChange={(
                  event
                ) =>
                  setForm({
                    ...form,
                    bio:
                      event.target
                        .value,
                  })
                }
                maxLength={1000}
              />
            </div>

            <button
              type="submit"
              disabled={
                savingProfile
              }
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {savingProfile
                ? 'Saving...'
                : 'Save Changes'}
            </button>
          </form>
        )}
      </div>

      {isVerified && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Ratings and Reviews
              </h2>

              {reviews.length > 0 && (
                <p className="mt-1 text-sm text-slate-500">
                  {averageRating.toFixed(
                    1
                  )}{' '}
                  out of 5 from{' '}
                  {reviews.length}{' '}
                  {reviews.length === 1
                    ? 'review'
                    : 'reviews'}
                </p>
              )}
            </div>

            {reviews.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-amber-700">
                <Star className="h-5 w-5 fill-current" />

                <span className="font-semibold">
                  {averageRating.toFixed(
                    1
                  )}
                </span>
              </div>
            )}
          </div>

          {loadingReviews ? (
            <div className="card py-8 text-center text-slate-500">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="card py-8 text-center text-slate-500">
              You have not received any reviews yet.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map(
                (
                  review
                ) => {
                  const reviewId =
                    getDocumentId(
                      review
                    );

                  return (
                    <article
                      key={
                        reviewId ??
                        `${review.reviewer_id}-${review.created_at}`
                      }
                      className="card"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {review.reviewer
                              ? `${review.reviewer.first_name} ${review.reviewer.last_name}`
                              : review.first_name ||
                                review.last_name
                              ? `${review.first_name ?? ''} ${review.last_name ?? ''}`.trim()
                              : 'CampusRent user'}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            {formatDate(
                              review.created_at
                            )}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 text-amber-500">
                          {[
                            1,
                            2,
                            3,
                            4,
                            5,
                          ].map(
                            (
                              star
                            ) => (
                              <Star
                                key={
                                  star
                                }
                                className={`h-4 w-4 ${
                                  star <=
                                  review.rating
                                    ? 'fill-current'
                                    : ''
                                }`}
                              />
                            )
                          )}
                        </div>
                      </div>

                      {review.comment ? (
                        <p className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                          <span>
                            {
                              review.comment
                            }
                          </span>
                        </p>
                      ) : (
                        <p className="mt-4 text-sm italic text-slate-400">
                          No written comment was provided.
                        </p>
                      )}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>
      )}

      {isVerified && (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl font-bold text-slate-900">
              My Listings
            </h2>

            <Link
              to="/listings/new"
              className="btn-primary !py-2"
            >
              + New Listing
            </Link>
          </div>

          {loadingListings ? (
            <div className="card py-8 text-center text-slate-500">
              Loading listings...
            </div>
          ) : myListings.length ===
            0 ? (
            <div className="card py-8 text-center text-slate-500">
              You have not listed any items yet.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {myListings.map(
                (
                  listing
                ) => {
                  const listingId =
                    getDocumentId(
                      listing
                    );

                  if (!listingId) {
                    return null;
                  }

                  const isProcessing =
                    processingListingId ===
                    listingId;

                  return (
                    <div
                      key={
                        listingId
                      }
                      className="relative"
                    >
                      <ListingCard
                        listing={
                          listing
                        }
                      />

                      <div className="mt-2 flex gap-2">
                        <Link
                          to={`/listings/${listingId}/edit`}
                          className="btn-secondary flex-1 !py-2 text-center"
                        >
                          Edit
                        </Link>

                        <button
                          type="button"
                          disabled={
                            isProcessing
                          }
                          onClick={() =>
                            void toggleAvailability(
                              listing
                            )
                          }
                          className="btn-secondary flex-1 !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing
                            ? 'Updating...'
                            : 'Toggle Availability'}
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}