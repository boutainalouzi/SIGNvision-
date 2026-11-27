import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Sparkles,
  Video,
  Waves,
  X,
} from 'lucide-react';
import { ASL_SIGNS, type AslSignInfo } from '../data/aslSigns';
import { HandSignIllustration } from '../components/HandSignIllustration';

type FilterTab = 'all' | 'alphabet' | 'phrase' | 'static' | 'dynamic';

export const DictionaryPage: React.FC = () => {
  const [filter, setFilter] = useState<FilterTab>('all');
  const [query, setQuery] = useState('');
  const [selectedSign, setSelectedSign] = useState<AslSignInfo | null>(null);

  const filteredSigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ASL_SIGNS.filter((sign) => {
      if (filter === 'alphabet' && sign.category !== 'alphabet') return false;
      if (filter === 'phrase' && sign.category !== 'phrase') return false;
      if (filter === 'static' && sign.type !== 'static') return false;
      if (filter === 'dynamic' && sign.type !== 'dynamic') return false;

      if (!q) return true;
      return (
        sign.label.toLowerCase().includes(q) ||
        sign.shortDescription.toLowerCase().includes(q) ||
        sign.type.includes(q)
      );
    });
  }, [filter, query]);

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Supported', count: ASL_SIGNS.length },
    {
      id: 'alphabet',
      label: 'Alphabet (A–Z)',
      count: ASL_SIGNS.filter((s) => s.category === 'alphabet').length,
    },
    {
      id: 'phrase',
      label: 'Words & Phrases',
      count: ASL_SIGNS.filter((s) => s.category === 'phrase').length,
    },
    {
      id: 'static',
      label: 'Static Handshape',
      count: ASL_SIGNS.filter((s) => s.type === 'static').length,
    },
    {
      id: 'dynamic',
      label: 'Dynamic Motion',
      count: ASL_SIGNS.filter((s) => s.type === 'dynamic').length,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(230,0,114,0.22)] dark:border-[rgba(255,45,141,0.3)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
            <BookOpen className="h-3.5 w-3.5 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
            Supported Vocabulary Reference
          </span>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111111] dark:text-white">
            ASL Sign Dictionary
          </h1>
          <p className="text-[#52525B] dark:text-[#A1A1AA]">
            Browse every sign currently supported by SignVision&apos;s Static MLP and Dynamic
            Temporal Sequence models. Click any card for detailed handshape instructions.
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#E60072] dark:text-[#FF69B4]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search letter or word (e.g. HELLO, R)..."
            aria-label="Search supported ASL signs"
            className="w-full rounded-xl border border-[rgba(230,0,114,0.2)] dark:border-[rgba(255,45,141,0.2)] bg-white dark:bg-[#0D0D12] pl-10 pr-4 py-2.5 text-sm text-[#111111] dark:text-white placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#FF2D8D]"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter ASL signs">
        {tabs.map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D] ${
                active
                  ? 'sv-btn-neon'
                  : 'sv-card text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#FFF0F6] dark:hover:bg-[#14141B] hover:text-[#111111] dark:hover:text-white'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-xs ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sign Cards Grid */}
      {filteredSigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgba(230,0,114,0.25)] dark:border-[rgba(255,45,141,0.25)] p-12 text-center text-[#52525B] dark:text-[#A1A1AA]">
          No signs matched &ldquo;{query}&rdquo;. Try clearing your search filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredSigns.map((sign) => (
            <button
              key={sign.id}
              type="button"
              onClick={() => setSelectedSign(sign)}
              className="sv-card group text-left rounded-2xl p-4 hover:border-[rgba(230,0,114,0.45)] dark:hover:border-[rgba(255,45,141,0.5)] hover:shadow-[0_0_22px_rgba(255,45,141,0.16)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="font-display text-2xl font-extrabold text-[#111111] dark:text-white group-hover:text-[#E60072] dark:group-hover:text-[#FF69B4] transition-colors">
                    {sign.display}
                  </span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                        sign.type === 'dynamic'
                          ? 'bg-[#FFF0F6] text-[#E60072] dark:bg-[#14141B] dark:text-[#FF69B4] border border-[rgba(255,45,141,0.25)]'
                          : 'bg-[#FFF0F6] text-[#E60072] dark:bg-[#14141B] dark:text-[#FF2D8D] border border-[rgba(255,45,141,0.2)]'
                      }`}
                    >
                      {sign.type === 'dynamic' ? (
                        <Waves className="h-3 w-3" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {sign.type}
                    </span>
                    <span className="text-[11px] font-medium text-[#52525B] dark:text-[#A1A1AA] capitalize">
                      {sign.category}
                    </span>
                  </div>
                </div>
              </div>

              <HandSignIllustration sign={sign} className="h-36 w-full mb-3" />

              <p className="text-xs sm:text-sm text-[#52525B] dark:text-[#A1A1AA] line-clamp-2 leading-relaxed">
                {sign.shortDescription}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sign-modal-title"
          onClick={() => setSelectedSign(null)}
        >
          <div
            className="sv-card sv-neon-highlight w-full max-w-lg rounded-3xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2
                    id="sign-modal-title"
                    className="font-display text-3xl font-extrabold text-[#111111] dark:text-white"
                  >
                    {selectedSign.display}
                  </h2>
                  <span className="rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.3)] px-2.5 py-0.5 text-xs font-bold uppercase text-[#E60072] dark:text-[#FF69B4]">
                    {selectedSign.type} sign
                  </span>
                </div>
                <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] mt-1">
                  {selectedSign.shortDescription}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSign(null)}
                aria-label="Close sign details"
                className="rounded-xl p-2 text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#FFF0F6] dark:hover:bg-[#14141B]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <HandSignIllustration sign={selectedSign} className="h-48 w-full" />

            <div className="space-y-3 text-sm">
              <div>
                <h3 className="font-bold text-[#111111] dark:text-white mb-1.5">
                  How to Perform
                </h3>
                <ul className="list-disc pl-5 space-y-1 text-[#52525B] dark:text-[#A1A1AA]">
                  {selectedSign.howToPerform.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ul>
              </div>

              <div className="sv-elevated rounded-xl p-3.5 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
                  Key MediaPipe Landmarks
                </div>
                <p className="text-xs text-[#111111] dark:text-[#A1A1AA]">
                  {selectedSign.keyLandmarks}
                </p>
                {selectedSign.motionCue && (
                  <p className="text-xs font-semibold text-[#E60072] dark:text-[#FF2D8D] pt-1">
                    Motion Cue: {selectedSign.motionCue}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSign(null)}
                className="rounded-xl border border-[rgba(230,0,114,0.2)] dark:border-[rgba(255,45,141,0.2)] px-4 py-2.5 text-sm font-semibold text-[#111111] dark:text-white"
              >
                Close
              </button>
              <Link
                to={`/translator?practice=${encodeURIComponent(selectedSign.label)}`}
                className="sv-btn-neon inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                <Video className="h-4 w-4" />
                Practice in Translator
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
