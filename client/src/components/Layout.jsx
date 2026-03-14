import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Settings, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/schedule', label: 'לוח שיבוצים', icon: CalendarDays },
  { to: '/admin', label: 'מנהל', icon: Settings },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" dir="rtl">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-md shadow-green-200">
                <span className="text-white font-bold text-sm">ח</span>
              </div>
              <div>
                <span className="font-bold text-gray-800 text-base">ניהול חדרי טיפול</span>
              </div>
            </div>

            {/* Desktop nav */}
            <div className="hidden sm:flex gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={16}/>{label}
                </NavLink>
              ))}
            </div>

            {/* Mobile */}
            <button
              className="sm:hidden p-2 rounded-xl text-gray-500 hover:bg-green-50 hover:text-green-700 transition-colors"
              onClick={() => setMenuOpen(v => !v)}>
              {menuOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 pb-3 pt-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-item w-full ${isActive ? 'active' : ''}`}>
                <Icon size={17}/>{label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet/>
      </main>

      <footer className="border-t border-gray-100 py-5 text-center text-xs text-gray-400">
        © 2026 כל הזכויות שמורות לגל עמר
      </footer>
    </div>
  );
}
