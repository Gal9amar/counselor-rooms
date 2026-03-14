import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/schedule', label: 'לוח שיבוצים', icon: CalendarDays },
  { to: '/admin', label: 'מנהל', icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              {/* לוגו יוכנס כאן */}
              <span className="font-bold text-gray-800 text-lg tracking-tight">חדרי טיפולים</span>
            </div>

            {/* Nav links — always visible */}
            <div className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) =>
                    `nav-item flex items-center gap-2 text-sm font-medium ${isActive ? 'active' : ''}`
                  }
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden text-xs">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © 2026 כל הזכויות שמורות לגל עמר
      </footer>
    </div>
  );
}
