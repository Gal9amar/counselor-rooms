import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Settings, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/', label: 'דשבורד', icon: LayoutDashboard },
  { to: '/schedule', label: 'לוח שבועי', icon: CalendarDays },
  { to: '/admin', label: 'מנהל', icon: Settings },
];

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen relative z-10" dir="rtl">
      {/* Navbar */}
      <nav className="glass-dark sticky top-0 z-50 border-b border-green-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg shadow-green-900/50">
                <span className="text-white font-bold text-sm">ח</span>
              </div>
              <span className="text-white font-semibold text-base tracking-wide">ניהול חדרי טיפול</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden sm:flex gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to} end={to === '/'}
                  className={({ isActive }) => `nav-link flex items-center gap-2 text-sm font-medium ${isActive ? 'active' : ''}`}
                >
                  <Icon size={16}/>{label}
                </NavLink>
              ))}
            </div>

            {/* Mobile hamburger */}
            <button className="sm:hidden p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X size={22}/> : <Menu size={22}/>}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/10 px-4 pb-3 pt-2 space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `nav-link flex items-center gap-3 text-sm font-medium w-full ${isActive ? 'active' : ''}`}
              >
                <Icon size={18}/>{label}
              </NavLink>
            ))}
          </div>
        )}
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <Outlet/>
      </main>

      <footer className="border-t border-white/10 mt-8 py-4 text-center text-xs text-white/30">
        © 2026 כל הזכויות שמורות לגל עמר
      </footer>
    </div>
  );
}
