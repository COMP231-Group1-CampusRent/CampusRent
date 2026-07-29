import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  api,
  type Report,
  type User,
} from '../api/client';

import StatusBadge from '../components/StatusBadge';

import {
  Users,
  Package,
  ClipboardList,
  AlertTriangle,
  MessageSquare,
  Star,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface Stats {
  total_users: number;
  verified_users: number;
  pending_verifications: number;
  total_listings: number;
  active_listings: number;
  total_requests: number;
  pending_requests: number;
  completed_rentals: number;
  pending_reports: number;
  total_messages: number;
  total_reviews: number;
}

interface RecentActivity {
  type: string;
  detail: string;
  created_at: string;
}

type AdminTab =
  | 'dashboard'
  | 'verifications'
  | 'reports';

type VerificationAction =
  | 'approve'
  | 'reject';

/**
 * Returns the MongoDB ObjectId or legacy numeric ID.
 */
function getDocumentId(
  document: {
    _id?: string;
    id?: string | number;
  }
): string | number | undefined {
  return document._id ?? document.id;
}

/**
 * Formats an API date safely.
 */
function formatDate(
  dateValue?: string
): string {
  if (!dateValue) {
    return 'Date unavailable';
  }

  const parsedDate = new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Date unavailable';
  }

  return parsedDate.toLocaleDateString();
}

/**
 * Returns a readable error message.
 */
function getErrorMessage(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred.';
}

export default function AdminPage() {
  const [tab, setTab] =
    useState<AdminTab>('dashboard');

  const [stats, setStats] =
    useState<Stats | null>(null);

  const [
    recentActivity,
    setRecentActivity,
  ] = useState<RecentActivity[]>([]);

  const [
    pendingUsers,
    setPendingUsers,
  ] = useState<User[]>([]);

  const [
    reports,
    setReports,
  ] = useState<Report[]>([]);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [
    processingUserId,
    setProcessingUserId,
  ] = useState<string | number | null>(null);

  const [
    processingReportId,
    setProcessingReportId,
  ] = useState<string | number | null>(null);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string>('');

  /**
   * Loads the admin dashboard information.
   *
   * Each request is handled independently so that one failed
   * section does not prevent the remaining sections from loading.
   */
  const load = useCallback(
    async (): Promise<void> => {
      setLoading(true);
      setErrorMessage('');

      const errors: string[] = [];

      try {
        const statsResponse =
          await api.get<{
            stats: Stats;
            recent_activity?: RecentActivity[];
          }>('/admin/stats');

        setStats(statsResponse.stats);

        setRecentActivity(
          Array.isArray(
            statsResponse.recent_activity
          )
            ? statsResponse.recent_activity
            : []
        );
      } catch (error) {
        console.error(
          'Unable to load admin statistics:',
          error
        );

        errors.push(
          `Statistics: ${getErrorMessage(error)}`
        );

        setStats(null);
        setRecentActivity([]);
      }

      try {
        const verificationResponse =
          await api.get<User[]>(
            '/admin/verifications'
          );

        setPendingUsers(
          Array.isArray(
            verificationResponse
          )
            ? verificationResponse
            : []
        );
      } catch (error) {
        console.error(
          'Unable to load pending verifications:',
          error
        );

        errors.push(
          `Verifications: ${getErrorMessage(error)}`
        );

        setPendingUsers([]);
      }

      try {
        const reportResponse =
          await api.get<Report[]>(
            '/admin/reports'
          );

        setReports(
          Array.isArray(reportResponse)
            ? reportResponse
            : []
        );
      } catch (error) {
        console.error(
          'Unable to load reports:',
          error
        );

        errors.push(
          `Reports: ${getErrorMessage(error)}`
        );

        setReports([]);
      }

      if (errors.length > 0) {
        setErrorMessage(
          errors.join(' | ')
        );
      }

      setLoading(false);
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Approves or rejects a pending student account.
   */
  const verifyUser = async (
    userId:
      | string
      | number
      | undefined,
    action: VerificationAction
  ): Promise<void> => {
    if (!userId) {
      setErrorMessage(
        'Cannot update this user because the user ID is missing.'
      );

      return;
    }

    setProcessingUserId(userId);
    setErrorMessage('');

    try {
      await api.patch(
        `/admin/verifications/${userId}`,
        {
          action,
        }
      );

      await load();
    } catch (error) {
      console.error(
        `Unable to ${action} user:`,
        error
      );

      setErrorMessage(
        `Unable to ${action} this account: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setProcessingUserId(null);
    }
  };

  /**
   * Resolves an administrator report.
   */
  const resolveReport = async (
    reportId:
      | string
      | number
      | undefined,
    action: string
  ): Promise<void> => {
    if (!reportId) {
      setErrorMessage(
        'Cannot update this report because the report ID is missing.'
      );

      return;
    }

    setProcessingReportId(reportId);
    setErrorMessage('');

    try {
      await api.patch(
        `/admin/reports/${reportId}`,
        {
          action,
          admin_action: action,
        }
      );

      await load();
    } catch (error) {
      console.error(
        'Unable to resolve report:',
        error
      );

      setErrorMessage(
        `Unable to resolve this report: ${getErrorMessage(
          error
        )}`
      );
    } finally {
      setProcessingReportId(null);
    }
  };

  const statCards = stats
    ? [
        {
          label: 'Total Students',
          value: stats.total_users,
          icon: Users,
          color:
            'text-campus-600 bg-campus-50',
        },
        {
          label: 'Pending Verifications',
          value:
            stats.pending_verifications,
          icon: AlertTriangle,
          color:
            'text-amber-600 bg-amber-50',
        },
        {
          label: 'Active Listings',
          value: stats.active_listings,
          icon: Package,
          color:
            'text-mint-600 bg-mint-50',
        },
        {
          label: 'Pending Requests',
          value: stats.pending_requests,
          icon: ClipboardList,
          color:
            'text-purple-600 bg-purple-50',
        },
        {
          label: 'Completed Rentals',
          value:
            stats.completed_rentals,
          icon: CheckCircle,
          color:
            'text-mint-600 bg-mint-50',
        },
        {
          label: 'Pending Reports',
          value: stats.pending_reports,
          icon: AlertTriangle,
          color:
            'text-red-600 bg-red-50',
        },
        {
          label: 'Messages',
          value: stats.total_messages,
          icon: MessageSquare,
          color:
            'text-blue-600 bg-blue-50',
        },
        {
          label: 'Reviews',
          value: stats.total_reviews,
          icon: Star,
          color:
            'text-yellow-600 bg-yellow-50',
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">
        Admin Dashboard
      </h1>

      <p className="mt-1 text-slate-500">
        Platform management and moderation
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {errorMessage}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            'dashboard',
            'verifications',
            'reports',
          ] as const
        ).map((currentTab) => (
          <button
            key={currentTab}
            type="button"
            onClick={() =>
              setTab(currentTab)
            }
            className={`rounded-xl border px-4 py-2 text-sm font-medium capitalize transition ${
              tab === currentTab
                ? 'border-campus-600 bg-campus-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {currentTab}

            {currentTab ===
              'verifications' &&
              pendingUsers.length > 0 && (
                <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                  {pendingUsers.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="card mt-6 py-12 text-center text-slate-500">
          Loading admin data...
        </div>
      )}

      {!loading &&
        tab === 'dashboard' && (
          <div className="mt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {statCards.map(
                ({
                  label,
                  value,
                  icon: Icon,
                  color,
                }) => (
                  <div
                    key={label}
                    className="card flex items-center gap-4"
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    <div>
                      <p className="text-2xl font-bold text-slate-900">
                        {value}
                      </p>

                      <p className="text-xs text-slate-500">
                        {label}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="card mt-6">
              <h2 className="font-semibold text-slate-900">
                Recent Activity
              </h2>

              <div className="mt-4 space-y-2">
                {recentActivity.length ===
                0 ? (
                  <p className="text-sm text-slate-400">
                    No recent activity
                  </p>
                ) : (
                  recentActivity.map(
                    (activity, index) => (
                      <div
                        key={`${activity.type}-${activity.created_at}-${index}`}
                        className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="capitalize text-slate-600">
                          {activity.type}:{' '}
                          {activity.detail}
                        </span>

                        <span className="text-xs text-slate-400">
                          {formatDate(
                            activity.created_at
                          )}
                        </span>
                      </div>
                    )
                  )
                )}
              </div>
            </div>
          </div>
        )}

      {!loading &&
        tab === 'verifications' && (
          <div className="mt-6 space-y-4">
            {pendingUsers.length === 0 ? (
              <div className="card py-12 text-center text-slate-500">
                No pending verifications
              </div>
            ) : (
              pendingUsers.map((user) => {
                const userId =
                  getDocumentId(user);

                const isProcessing =
                  processingUserId ===
                  userId;

                return (
                  <div
                    key={
                      userId
                        ? String(userId)
                        : user.email
                    }
                    className="card flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {user.first_name ||
                          'Unknown'}{' '}
                        {user.last_name ||
                          'User'}
                      </p>

                      <p className="text-sm text-slate-500">
                        {user.email ||
                          'Email unavailable'}
                      </p>

                      <p className="text-xs text-slate-400">
                        Registered{' '}
                        {formatDate(
                          user.created_at
                        )}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void verifyUser(
                            userId,
                            'approve'
                          )
                        }
                        disabled={
                          !userId ||
                          isProcessing
                        }
                        className="btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle className="h-4 w-4" />

                        {isProcessing
                          ? 'Processing...'
                          : 'Approve'}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void verifyUser(
                            userId,
                            'reject'
                          )
                        }
                        disabled={
                          !userId ||
                          isProcessing
                        }
                        className="btn-danger !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />

                        Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      {!loading &&
        tab === 'reports' && (
          <div className="mt-6 space-y-4">
            {reports.length === 0 ? (
              <div className="card py-12 text-center text-slate-500">
                No reports
              </div>
            ) : (
              reports.map((report) => {
                const reportId =
                  getDocumentId(report);

                const isProcessing =
                  processingReportId ===
                  reportId;

                return (
                  <div
                    key={
                      reportId
                        ? String(reportId)
                        : `${report.reason}-${report.created_at}`
                    }
                    className="card"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {report.reason}
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {report.details}
                        </p>

                        <p className="mt-2 text-xs text-slate-400">
                          By{' '}
                          {report.reporter_name ||
                            'Unknown user'}

                          {report.reported_listing_title &&
                            ` · Listing: ${report.reported_listing_title}`}

                          {report.reported_user_name &&
                            ` · User: ${report.reported_user_name}`}
                        </p>
                      </div>

                      <StatusBadge
                        status={report.status}
                      />
                    </div>

                    {report.status ===
                      'pending' && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void resolveReport(
                              reportId,
                              'warning'
                            )
                          }
                          disabled={
                            !reportId ||
                            isProcessing
                          }
                          className="btn-secondary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Warning
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void resolveReport(
                              reportId,
                              'remove_listing'
                            )
                          }
                          disabled={
                            !reportId ||
                            isProcessing
                          }
                          className="btn-danger !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove Listing
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void resolveReport(
                              reportId,
                              'suspend_user'
                            )
                          }
                          disabled={
                            !reportId ||
                            isProcessing
                          }
                          className="btn-danger !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Suspend User
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void resolveReport(
                              reportId,
                              'dismissed'
                            )
                          }
                          disabled={
                            !reportId ||
                            isProcessing
                          }
                          className="btn-primary !py-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isProcessing
                            ? 'Processing...'
                            : 'Resolve'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
    </div>
  );
}