import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, User, Settings, Download, LogOut } from 'lucide-react';
import { getPendingCountSilent } from '../services/api';
import useAdmin from '../hooks/useAdmin';
import { logoutAdmin } from '../services/adminAuth';
import AdminLoginModal from './AdminLoginModal';

const navItems = [
  { to: '/', label: 'לוח חדרים', icon: LayoutDashboard },
  { to: '/schedule', label: 'לוח שיבוצים', icon: CalendarDays },
  { to: '/my-schedule', label: 'השיבוצים שלי', icon: User },
];
const adminNavItem = { to: '/admin', label: 'הגדרות מנהל', icon: Settings };

export default function Layout() {
  const navigate = useNavigate();
  const { isAdmin, checking } = useAdmin();
  const [loginOpen, setLoginOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const check = () => { if (window.__installPrompt) setInstallPrompt(window.__installPrompt); };
    check();
    window.addEventListener('beforeinstallprompt', check);
    return () => window.removeEventListener('beforeinstallprompt', check);
  }, []);

  useEffect(() => {
    if (!isAdmin) { setPendingCount(0); return; }
    const fetchPending = async () => {
      try {
        setPendingCount(await getPendingCountSilent());
      } catch { setPendingCount(0); }
    };
    fetchPending();
    const interval = setInterval(fetchPending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    window.__installPrompt = null;
    setInstallPrompt(null);
  };

  return (
    <div className="min-h-screen pb-20 sm:pb-0" dir="rtl">

      {/* Desktop top nav */}
      <nav className="hidden sm:block bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo right — חוף אשקלון */}
            <img src="/logo-left.png" alt="חוף אשקלון" className="h-10 w-auto object-contain cursor-pointer" onClick={() => navigate('/')} />

            {/* Nav links centered */}
            <div className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `nav-item flex items-center gap-2 text-sm font-medium ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={16} />
                  {label}
                  {to === '/admin' && pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </NavLink>
              ))}
              {/* Admin controls: hidden while verifying (fail closed, no flicker) */}
              {!checking && (isAdmin ? (
                <>
                  <NavLink to={adminNavItem.to}
                    className={({ isActive }) => `nav-item flex items-center gap-2 text-sm font-medium ${isActive ? 'active' : ''}`}>
                    <Settings size={16} />
                    {adminNavItem.label}
                    {pendingCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-xs font-bold leading-none">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </NavLink>
                  <button type="button" onClick={() => { logoutAdmin(); navigate('/'); }} className="nav-item flex items-center gap-2 text-sm font-medium">
                    <LogOut size={16} /> יציאה
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setLoginOpen(true)} className="nav-item flex items-center gap-2 text-sm font-medium">
                  <Settings size={16} /> מנהל
                </button>
              ))}
            </div>

            {/* Logo left — אופק + install button */}
            <div className="flex items-center gap-3">
              {installPrompt && (
                <button onClick={handleInstall} className="flex items-center gap-1.5 text-xs text-green-600 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors">
                  <Download size={14} />
                  <span className="hidden sm:inline">התקנה במחשב</span>
                  <span className="sm:hidden">התקנה בנייד</span>
                </button>
              )}
              <img src="/logo-right.png" alt="אופק" className="h-10 w-auto object-contain" />
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile top bar with logos */}
      <header className="sm:hidden bg-white border-b border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <img src="/logo-left.png" alt="חוף אשקלון" className="h-9 w-auto object-contain cursor-pointer" onClick={() => navigate('/')} />
          <img src="/logo-right.png" alt="אופק" className="h-9 w-auto object-contain cursor-pointer" onClick={() => navigate('/')} />
        </div>
      </header>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex justify-around items-stretch">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs font-medium transition-colors ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-green-100' : ''}`}>
                      <Icon size={20} />
                    </div>
                    {to === '/admin' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                        {pendingCount > 99 ? '99+' : pendingCount}
                      </span>
                    )}
                  </div>
                  <span className="leading-tight text-center text-xs">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          {!checking && (isAdmin ? (
            <>
              <NavLink to={adminNavItem.to}
                className={({ isActive }) => `flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs font-medium transition-colors ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-green-100' : ''}`}><Settings size={20} /></div>
                      {pendingCount > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[16px] h-[16px] px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                          {pendingCount > 99 ? '99+' : pendingCount}
                        </span>
                      )}
                    </div>
                    <span className="leading-tight text-center text-xs">{adminNavItem.label}</span>
                  </>
                )}
              </NavLink>
              <button type="button" onClick={() => { logoutAdmin(); navigate('/'); }}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs font-medium text-gray-400">
                <div className="p-1.5 rounded-xl"><LogOut size={20} /></div>
                <span className="leading-tight text-center text-xs">יציאה</span>
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setLoginOpen(true)}
              className="flex flex-col items-center justify-center flex-1 gap-0.5 py-2 text-xs font-medium text-gray-400">
              <div className="p-1.5 rounded-xl"><Settings size={20} /></div>
              <span className="leading-tight text-center text-xs">מנהל</span>
            </button>
          ))}
        </div>
        {/* Copyright strip */}
        <div className="border-t border-gray-100 py-1 text-center text-xs text-gray-300">
          © 2026 כל הזכויות שמורות לגל עמר
        </div>
      </nav>

      {loginOpen && <AdminLoginModal onClose={() => setLoginOpen(false)} />}

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="hidden sm:block border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © 2026 כל הזכויות שמורות לגל עמר
      </footer>
    </div>
  );
}
