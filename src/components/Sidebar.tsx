import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import {
  BookOpen,
  Cpu,
  Home,
  Info,
  Menu,
  Moon,
  Sun,
  Video,
  X,
} from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';

interface SidebarProps {
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

export const Sidebar: React.FC<SidebarProps> = ({ theme, onToggleTheme }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const renderNavLinks = (onNavigate?: () => void) =>
    NAV_ITEMS.map(({ to, label, icon: Icon }) => (
      <NavLink
        key={to}
        to={to}
        end={to === '/'}
        onClick={onNavigate}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D] ${
            isActive
              ? 'sv-nav-active'
              : 'border border-transparent text-[#52525B] hover:bg-[#FFF0F6] hover:text-[#111111] dark:text-[#A1A1AA] dark:hover:bg-[#14141B] dark:hover:text-white'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              className={`h-4 w-4 transition-colors ${
                isActive
                  ? 'text-[#E60072] dark:text-[#FF2D8D]'
                  : 'text-[#52525B] group-hover:text-[#E60072] dark:text-[#A1A1AA] dark:group-hover:text-[#FF69B4]'
              }`}
              aria-hidden="true"
            />
            <span>{label}</span>
          </>
        )}
      </NavLink>
    ));

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className="sv-sidebar hidden lg:flex lg:w-68 lg:shrink-0 lg:flex-col lg:border-r lg:sticky lg:top-0 lg:h-screen lg:justify-between p-4 gap-4"
      >
        <div className="space-y-4 overflow-y-auto pr-0.5">
          {/* Brand with Yuki Logo */}
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
          >
            <img
              src="/yuki-logo.png"
              alt="SignVision Yuki logo"
              className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover border border-[rgba(230,0,114,0.35)] dark:border-[rgba(255,45,141,0.45)] shadow-[0_0_16px_rgba(255,45,141,0.28)]"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight text-[#111111] dark:text-white">
                SignVision
              </span>
              <span className="text-[11px] font-semibold text-[#E60072] dark:text-[#FF69B4] mt-1">
                Neural ASL Studio
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav aria-label="Primary navigation" className="space-y-1.5">
            {renderNavLinks()}
          </nav>
        </div>

        {/* Bottom Controls */}
        <div className="space-y-2.5 pt-3 border-t border-[rgba(230,0,114,0.14)] dark:border-[rgba(255,45,141,0.15)]">
          <Link
            to="/translator"
            className="sv-btn-neon flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            Start Translating
          </Link>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex w-full items-center justify-between rounded-xl border border-[rgba(230,0,114,0.16)] dark:border-[rgba(255,45,141,0.15)] bg-white dark:bg-[#14141B] px-3.5 py-2.5 text-xs font-semibold text-[#111111] dark:text-white hover:bg-[#FFF0F6] dark:hover:border-[rgba(255,45,141,0.4)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#FF69B4]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[#E60072]" aria-hidden="true" />
              )}
              {theme === 'dark' ? 'Neon Dark Mode' : 'Clean Light Mode'}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
              Switch
            </span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 border-b border-[rgba(230,0,114,0.16)] dark:border-[rgba(255,45,141,0.15)] bg-[#FAFAFA]/95 dark:bg-[#08080B]/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/yuki-logo.png"
              alt="SignVision Yuki logo"
              className="h-10 w-10 shrink-0 rounded-xl object-cover border border-[rgba(230,0,114,0.35)] dark:border-[rgba(255,45,141,0.45)] shadow-[0_0_12px_rgba(255,45,141,0.28)]"
            />
            <div className="flex flex-col leading-none">
              <span className="font-display text-base font-extrabold text-[#111111] dark:text-white">
                SignVision
              </span>
              <span className="text-[10px] font-semibold text-[#E60072] dark:text-[#FF69B4] mt-0.5">
                Neural ASL Studio
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(230,0,114,0.18)] dark:border-[rgba(255,45,141,0.2)] bg-white dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4]"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-label="Toggle navigation menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(230,0,114,0.18)] dark:border-[rgba(255,45,141,0.2)] bg-white dark:bg-[#14141B] text-[#111111] dark:text-white"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-[rgba(230,0,114,0.14)] dark:border-[rgba(255,45,141,0.15)] bg-[#FAFAFA] dark:bg-[#08080B] px-4 py-3 space-y-3">
            <nav aria-label="Mobile navigation" className="space-y-1">
              {renderNavLinks(() => setMobileOpen(false))}
            </nav>
            <Link
              to="/translator"
              onClick={() => setMobileOpen(false)}
              className="sv-btn-neon flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
            >
              <Video className="h-4 w-4" aria-hidden="true" />
              Start Translating
            </Link>
          </div>
        )}
      </header>
    </>
  );
};
