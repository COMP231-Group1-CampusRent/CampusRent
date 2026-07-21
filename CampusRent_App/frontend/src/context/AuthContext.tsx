import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setToken, User } from '../api/client';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isVerified: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const me = await api.get<User>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
      setToken(null);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('campusrent_token');
    if (token) refreshUser().finally(() => setLoading(false));
    else setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password,
    });
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (data: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => {
    await api.post('/auth/register', data);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isVerified: user?.verification_status === 'verified' || user?.role === 'admin',
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
