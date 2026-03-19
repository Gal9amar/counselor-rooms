import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, User, Settings, Download } from 'lucide-react';

const navItems = [
  { to: '/', label: 'לוח חדרים', icon: LayoutDashboard },
  { to: '/schedule', label: 'לוח שיבוצים', icon: CalendarDays },
  { to: '/my-schedule', label: 'השיבוצים שלי', icon: User },
  { to: '/admin', label: 'מנהל', icon: Settings },
];

export default function Layout() {
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const check = () => { if (window.__installPrompt) setInstallPrompt(window.__installPrompt); };
    check();
    window.addEventListener('beforeinstallprompt', check);
    return () => window.removeEventListener('beforeinstallprompt', check);
  }, []);

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
        <div className="max-w-6xl mx-auto px-4">
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
                </NavLink>
              ))}
            </div>

            {/* Logo left — אופק + install button */}
            <div className="flex items-center gap-3">
              {installPrompt && (
                <button onClick={handleInstall} className="flex items-center gap-1.5 text-xs text-green-600 border border-green-200 rounded-lg px-3 py-1.5 hover:bg-green-50 transition-colors">
                  <Download size={14} /> התקן אפליקציה
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
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-green-100' : ''}`}>
                    <Icon size={20} />
                  </div>
                  <span className="leading-tight text-center text-xs">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        {/* Copyright strip */}
        <div className="border-t border-gray-100 py-1 text-center text-xs text-gray-300">
          © 2026 כל הזכויות שמורות לגל עמר
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <footer className="hidden sm:block border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © 2026 כל הזכויות שמורות לגל עמר
      </footer>
    </div>
  );
}
