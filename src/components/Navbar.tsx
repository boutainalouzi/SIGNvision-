import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Hand,
  Menu,
  Moon,
  Sun,
  X,
  Video,
  BookOpen,
  Cpu,
  Info,
  Home,
} from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';

interface NavbarProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/translator', label: 'Translator', icon: Video },
  { to: '/how-it-works', label: 'How It Works', icon: Cpu },
  { to: '/dictionary', label: 'ASL Dictionary', icon: BookOpen },
  { to: '/about', label: 'About', icon: Info },
];

export const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-sky-600 text-white shadow-sm">
              <Hand className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                SignVision
              </span>
              <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                ASL Real-Time Translator
              </span>
            </div>
          </Link>

          <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    isActive
                      ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="h-5 w-5 text-slate-700" aria-hidden="true" />
              )}
            </button>

            <Link
              to="/translator"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-400 px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-950 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Start Translating
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation menu"
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile navigation"
          className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-3 space-y-1"
        >
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 dark:bg-teal-950/70 dark:text-teal-300'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                }`
              }
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};
