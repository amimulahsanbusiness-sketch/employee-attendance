import React from 'react';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { LogOut, Globe, User, LayoutDashboard } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" />;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const dashboardPath = user.role === 'admin' ? '/admin' : '/employee';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-semibold text-indigo-600 hidden sm:block">
              {user.role === 'admin' ? t('adminDashboard') : t('employeeDashboard')}
            </h1>
            <nav className="flex items-center gap-1">
              <Link
                to={dashboardPath}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === dashboardPath ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link
                to="/profile"
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  location.pathname === '/profile' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <User className="w-4 h-4" />
                Profile
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
              className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-1"
              title="Toggle Language"
            >
              <Globe className="w-5 h-5" />
              <span className="text-xs font-bold uppercase">{lang}</span>
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
              title={t('logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
