import { useEffect, useState } from 'react';
import { api, User, Report } from '../api/client';
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

export default function AdminPage() {
  const [tab, setTab] = useState<'dashboard' | 'verifications' | 'reports'>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentActivity, setRecentActivity] = useState<{ type: string; detail: string; created_at: string }[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const load = () => {
    api
      .get<{ stats: Stats; recent_activity: typeof recentActivity }>('/admin/stats')
      .then((res) => {
        setStats(res.stats);
        setRecentActivity(res.recent_activity);
      })
      .catch(() => {});
    api.get<User[]>('/admin/verifications').then(setPendingUsers).catch(() => {});
    api.get<Report[]>('/admin/reports').then(setReports).catch(() => {});
  };

  useEffect(() => {
    load();
  }, []);

  const verifyUser = async (userId: number, action: 'approve' | 'reject') => {
    await api.patch(`/admin/verifications/${userId}`, { action });
    load();
  };

  const resolveReport = async (reportId: number, action: string) => {
    await api.patch(`/admin/reports/${reportId}`, { action, admin_action: action });
    load();
  };

  const statCards = stats
    ? [
        { label: 'Total Students', value: stats.total_users, icon: Users, color: 'text-campus-600 bg-campus-50' },
        { label: 'Pending Verifications', value: stats.pending_verifications, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
        { label: 'Active Listings', value: stats.active_listings, icon: Package, color: 'text-mint-600 bg-mint-50' },
        { label: 'Pending Requests', value: stats.pending_requests, icon: ClipboardList, color: 'text-purple-600 bg-purple-50' },
        { label: 'Completed Rentals', value: stats.completed_rentals, icon: CheckCircle, color: 'text-mint-600 bg-mint-50' },
        { label: 'Pending Reports', value: stats.pending_reports, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
        { label: 'Messages', value: stats.total_messages, icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
        { label: 'Reviews', value: stats.total_reviews, icon: Star, color: 'text-yellow-600 bg-yellow-50' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl font-bold text-slate-900">Admin Dashboard</h1>
      <p className="mt-1 text-slate-500">Platform management and moderation</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['dashboard', 'verifications', 'reports'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-campus-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t}
            {t === 'verifications' && pendingUsers.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-500 px-1.5 py-0.5 text-xs text-white">
                {pendingUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{value}</p>
                  <p className="text-xs text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card mt-6">
            <h2 className="font-semibold text-slate-900">Recent Activity</h2>
            <div className="mt-4 space-y-2">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-slate-400">No recent activity</p>
              ) : (
                recentActivity.map((a, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <span className="capitalize text-slate-600">{a.type}: {a.detail}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'verifications' && (
        <div className="mt-6 space-y-4">
          {pendingUsers.length === 0 ? (
            <div className="card py-12 text-center text-slate-500">No pending verifications</div>
          ) : (
            pendingUsers.map((u) => (
              <div key={u.id} className="card flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{u.first_name} {u.last_name}</p>
                  <p className="text-sm text-slate-500">{u.email}</p>
                  <p className="text-xs text-slate-400">
                    Registered {new Date(u.created_at!).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => verifyUser(u.id, 'approve')} className="btn-primary !py-2">
                    <CheckCircle className="h-4 w-4" /> Approve
                  </button>
                  <button onClick={() => verifyUser(u.id, 'reject')} className="btn-danger !py-2">
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reports' && (
        <div className="mt-6 space-y-4">
          {reports.length === 0 ? (
            <div className="card py-12 text-center text-slate-500">No reports</div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{r.reason}</p>
                    <p className="mt-1 text-sm text-slate-600">{r.details}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      By {r.reporter_name}
                      {r.reported_listing_title && ` · Listing: ${r.reported_listing_title}`}
                      {r.reported_user_name && ` · User: ${r.reported_user_name}`}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                {r.status === 'pending' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => resolveReport(r.id, 'warning')} className="btn-secondary !py-2">
                      Warning
                    </button>
                    <button onClick={() => resolveReport(r.id, 'remove_listing')} className="btn-danger !py-2">
                      Remove Listing
                    </button>
                    <button onClick={() => resolveReport(r.id, 'suspend_user')} className="btn-danger !py-2">
                      Suspend User
                    </button>
                    <button onClick={() => resolveReport(r.id, 'dismissed')} className="btn-primary !py-2">
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
