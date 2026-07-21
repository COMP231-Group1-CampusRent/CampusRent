import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  Search,
  PlusCircle,
  MessageSquare,
  ClipboardList,
  User,
  Shield,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isVerified, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-campus-50 text-campus-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-campus-600 to-campus-800 text-white shadow-sm">
              <Home className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold tracking-tight text-campus-900">
              CampusRent
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/browse" className={navLinkClass}>
              <Search className="h-4 w-4" /> Browse
            </NavLink>
            {user && isVerified && (
              <>
                <NavLink to="/listings/new" className={navLinkClass}>
                  <PlusCircle className="h-4 w-4" /> List Item
                </NavLink>
                <NavLink to="/requests" className={navLinkClass}>
                  <ClipboardList className="h-4 w-4" /> Requests
                </NavLink>
                <NavLink to="/messages" className={navLinkClass}>
                  <MessageSquare className="h-4 w-4" /> Messages
                </NavLink>
              </>
            )}
            {isAdmin && (
              <NavLink to="/admin" className={navLinkClass}>
                <Shield className="h-4 w-4" /> Admin
              </NavLink>
            )}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            {user ? (
              <>
                <NavLink to="/profile" className={navLinkClass}>
                  <User className="h-4 w-4" />
                  {user.first_name}
                </NavLink>
                <button onClick={logout} className="btn-secondary !py-2 !px-3">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-secondary">
                  Sign In
                </Link>
                <Link to="/register" className="btn-primary">
                  Register
                </Link>
              </>
            )}
          </div>

          <button
            className="rounded-lg p-2 text-slate-600 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              <NavLink to="/browse" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                Browse
              </NavLink>
              {user && isVerified && (
                <>
                  <NavLink to="/listings/new" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    List Item
                  </NavLink>
                  <NavLink to="/requests" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    Requests
                  </NavLink>
                  <NavLink to="/messages" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    Messages
                  </NavLink>
                </>
              )}
              {isAdmin && (
                <NavLink to="/admin" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                  Admin
                </NavLink>
              )}
              {user ? (
                <>
                  <NavLink to="/profile" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    Profile
                  </NavLink>
                  <button onClick={() => { logout(); setMobileOpen(false); }} className={navLinkClass({ isActive: false })}>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    Sign In
                  </NavLink>
                  <NavLink to="/register" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    Register
                  </NavLink>
                </>
              )}
            </nav>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-campus-600 text-white">
                <Home className="h-4 w-4" />
              </div>
              <span className="font-display font-bold text-campus-900">CampusRent</span>
            </div>
            <p className="text-sm text-slate-500">
              Student item rental platform — Share resources, save money, build community.
            </p>
            <p className="text-xs text-slate-400">COMP 231 — Team 1 · Centennial College</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
