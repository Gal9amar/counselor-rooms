import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, User, Settings } from 'lucide-react';

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/schedule', label: 'שיבוצים', icon: CalendarDays },
  { to: '/my-schedule', label: 'שלי', icon: User },
  { to: '/admin', label: 'מנהל', icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen pb-20 sm:pb-0" dir="rtl">

      {/* Desktop top nav */}
      <nav className="hidden sm:block bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-center items-center h-14 gap-1">
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
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 shadow-[0_-2px_12px_rgba(0,0,0,0.06)]">
        <div className="flex justify-around items-stretch h-16">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center flex-1 gap-1 text-xs font-medium transition-colors ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-green-100' : ''}`}>
                    <Icon size={20} />
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
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
