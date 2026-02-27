import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Shield, FileText, AlertTriangle, Settings, Users, LogOut, Home, Cpu, Radar, Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';

// Pages
import Dashboard from './pages/Dashboard';
import CaseDetails from './pages/CaseDetails';
import EvidenceUpload from './pages/EvidenceUpload';
import AuthorityDashboard from './pages/AuthorityDashboard';
import AIAnalysisPage from './pages/AIAnalysisPage';
import SettingsPage from './pages/SettingsPage';
import Login from './pages/Login';
import HomePage from './pages/HomePage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import SocialMonitoringPage from './pages/SocialMonitoringPage';
import { getUnreadAlertCount } from './lib/socialMonitorStore';

// ─── Protected Route ──────────────────────────────────────────────────────────
function ProtectedRoute({ user, children }: { user: any; children: React.ReactNode }) {
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

// ─── Auth Route (redirect to dashboard if already logged in) ─────────────────
function AuthRoute({ user, children }: { user: any; children: React.ReactNode }) {
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ─── Layout Component (sidebar + main) ───────────────────────────────────────
function Layout({ children, user, onLogout }: { children: React.ReactNode; user: any; onLogout: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-semibold text-zinc-100 tracking-tight">Evidence Vault</h1>
            <p className="text-xs text-zinc-500 font-mono">SECURE PRESERVATION</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100 font-medium text-sm transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/dashboard') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
          >
            <FileText className="w-4 h-4 text-zinc-400" />
            My Cases
          </button>
          <button
            onClick={() => navigate('/upload')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/upload') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
          >
            <AlertTriangle className="w-4 h-4" />
            New Case
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => navigate('/authority')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/authority') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
            >
              <Users className="w-4 h-4" />
              Authority Dashboard
            </button>
          )}
          <button
            onClick={() => navigate('/ai-analysis')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/ai-analysis') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
          >
            <Cpu className="w-4 h-4" />
            AI Analysis
          </button>
          <button
            onClick={() => navigate('/social-monitor')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/social-monitor') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
          >
            <div className="relative">
              <Radar className="w-4 h-4" />
              {getUnreadAlertCount() > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold">
                  {getUnreadAlertCount() > 9 ? '9+' : getUnreadAlertCount()}
                </span>
              )}
            </div>
            Social Monitor
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-sm transition-colors ${isActive('/settings') ? 'bg-zinc-800/50 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'}`}
          >
            <Settings className="w-4 h-4" />
            Safety Settings
          </button>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-zinc-200">{user?.email}</span>
              <span className="text-xs text-zinc-500 capitalize">{user?.role}</span>
            </div>
            <button onClick={onLogout} className="text-zinc-500 hover:text-zinc-300">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for demo mode user
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('user');
      }
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        const userData = {
          uid: currentUser.uid,
          email: currentUser.email,
          role: currentUser.email?.includes('authority') ? 'admin' : 'user'
        };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Only clear if there's no demo user in localStorage
        const stored = localStorage.getItem('user');
        if (!stored) {
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <p className="text-zinc-500 text-sm font-mono">Initializing Secure Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* ── Public Routes ─────────────────────────── */}
        <Route path="/" element={<HomePage user={user} />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route
          path="/login"
          element={
            <AuthRoute user={user}>
              <Login onLogin={handleLogin} />
            </AuthRoute>
          }
        />

        <Route
          path="/register"
          element={
            <AuthRoute user={user}>
              <Login onLogin={handleLogin} startInSignUpMode />
            </AuthRoute>
          }
        />

        {/* ── Protected Routes ──────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/cases/:id"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <CaseDetails />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <EvidenceUpload />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <SettingsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-analysis"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <AIAnalysisPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/authority"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                {user?.role === 'admin' ? <AuthorityDashboard /> : <Navigate to="/dashboard" replace />}
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/social-monitor"
          element={
            <ProtectedRoute user={user}>
              <Layout user={user} onLogout={handleLogout}>
                <SocialMonitoringPage user={user} />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ── Catch-all ─────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
