import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Camera,
  Cpu,
  ShieldCheck,
  Sparkles,
  Volume2,
  Waves,
} from 'lucide-react';
import { ASL_SIGNS } from '../data/aslSigns';
import { HandSignIllustration } from '../components/HandSignIllustration';

export const HomePage: React.FC = () => {
  const helloSign = ASL_SIGNS.find((s) => s.label === 'HELLO')!;
  const ilySign = ASL_SIGNS.find((s) => s.label === 'I LOVE YOU')!;
  const thankYouSign = ASL_SIGNS.find((s) => s.label === 'THANK YOU')!;

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[rgba(230,0,114,0.14)] dark:border-[rgba(255,45,141,0.15)] bg-gradient-to-b from-[#FFF0F6]/70 via-[#FFFFFF] to-[#FFFFFF] dark:from-[#0D0D12] dark:via-[#030304] dark:to-[#030304]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-[#FF2D8D]/10 blur-3xl dark:bg-[#FF2D8D]/15"
        />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14 lg:py-20 relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(230,0,114,0.28)] dark:border-[rgba(255,45,141,0.35)] bg-[#FFF0F6] dark:bg-[#14141B] px-4 py-1.5 text-sm font-semibold text-[#E60072] dark:text-[#FF69B4] shadow-[0_0_16px_rgba(255,45,141,0.15)]">
                <Sparkles className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
                Dual-Hand Computer Vision + Temporal ML
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#111111] dark:text-white leading-[1.08]">
                Real-Time{' '}
                <span className="bg-gradient-to-r from-[#E60072] to-[#FF69B4] dark:from-[#FF2D8D] dark:to-[#FF69B4] bg-clip-text text-transparent">
                  Sign Language
                </span>{' '}
                Translation in Your Browser
              </h1>

              <p className="text-lg sm:text-xl text-[#52525B] dark:text-[#A1A1AA] leading-relaxed max-w-2xl">
                SignVision empowers deaf and hard-of-hearing individuals to communicate seamlessly
                with non-signers. Using your webcam, it tracks both hands (42 3D landmarks) and
                translates American Sign Language (ASL) letters, words, and sentences into written
                and spoken English.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/translator"
                  className="sv-btn-neon inline-flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 text-base sm:text-lg font-bold transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
                >
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  Start Translating
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>

                <Link
                  to="/dictionary"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(230,0,114,0.22)] dark:border-[rgba(255,45,141,0.2)] bg-white dark:bg-[#0D0D12] hover:bg-[#FFF0F6] dark:hover:bg-[#14141B] px-6 py-4 text-base font-semibold text-[#111111] dark:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
                >
                  <BookOpen className="h-5 w-5 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
                  Explore ASL Dictionary
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4 max-w-lg">
                <div className="sv-card rounded-xl p-3">
                  <div className="font-mono text-2xl font-bold text-[#E60072] dark:text-[#FF2D8D]">
                    42
                  </div>
                  <div className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
                    Dual-Hand Keypoints
                  </div>
                </div>
                <div className="sv-card rounded-xl p-3">
                  <div className="font-mono text-2xl font-bold text-[#E60072] dark:text-[#FF69B4]">
                    34
                  </div>
                  <div className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
                    Letters &amp; Phrases
                  </div>
                </div>
                <div className="sv-card rounded-xl p-3">
                  <div className="font-mono text-2xl font-bold text-[#111111] dark:text-white">
                    100%
                  </div>
                  <div className="text-xs font-medium text-[#52525B] dark:text-[#A1A1AA]">
                    Private On-Device
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Visual Preview Card */}
            <div className="lg:col-span-5">
              <div className="sv-card sv-neon-highlight rounded-3xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#E60072] dark:bg-[#FF2D8D] animate-pulse shadow-[0_0_8px_#FF2D8D]" />
                    Live Landmark Pipeline
                  </span>
                  <span className="rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(230,0,114,0.2)] dark:border-[rgba(255,45,141,0.25)] px-2.5 py-1 font-mono text-xs font-semibold text-[#E60072] dark:text-[#FF69B4]">
                    Dual-Hand ML
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5 text-center">
                    <HandSignIllustration sign={helloSign} className="h-28 w-full" />
                    <span className="block text-xs font-bold text-[#111111] dark:text-white">
                      HELLO
                    </span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <HandSignIllustration sign={thankYouSign} className="h-28 w-full" />
                    <span className="block text-xs font-bold text-[#111111] dark:text-white">
                      THANK YOU
                    </span>
                  </div>
                  <div className="space-y-1.5 text-center">
                    <HandSignIllustration sign={ilySign} className="h-28 w-full" />
                    <span className="block text-xs font-bold text-[#111111] dark:text-white">
                      I LOVE YOU
                    </span>
                  </div>
                </div>

                <div className="sv-elevated rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    <span>TRANSLATED SENTENCE</span>
                    <span className="font-mono text-[#E60072] dark:text-[#FF69B4] font-semibold">
                      96.4% confidence
                    </span>
                  </div>
                  <p className="font-display text-2xl font-bold text-[#111111] dark:text-white tracking-tight">
                    HELLO THANK YOU
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    <Volume2 className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" />
                    <span>Ready for instant spoken English playback</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Pillars */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="max-w-2xl space-y-2">
          <h2 className="font-display text-3xl font-extrabold text-[#111111] dark:text-white">
            Engineered for Real-World Clarity &amp; Accessibility
          </h2>
          <p className="text-[#52525B] dark:text-[#A1A1AA]">
            Built with dual-branch machine learning so static handshapes and moving ASL gestures are
            each handled by the right model architecture across one or both hands.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="sv-card rounded-2xl p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.2)] text-[#E60072] dark:text-[#FF2D8D]">
              <Camera className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white">
              42-Point Dual-Hand Tracking
            </h3>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              MediaPipe HandLandmarker tracks both left and right hands simultaneously in real time
              with distinct skeletal overlays and bilateral spatial normalization.
            </p>
          </div>

          <div className="sv-card rounded-2xl p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.2)] text-[#E60072] dark:text-[#FF69B4]">
              <Waves className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white">
              Static + Temporal Models
            </h3>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              Static signs (A–I, K–Y, I LOVE YOU) use a TensorFlow.js Landmark MLP, while dynamic
              signs (J, Z, HELLO, THANK YOU, YES, NO, PLEASE, SORRY, HELP) use a 24-frame temporal
              sequence classifier.
            </p>
          </div>

          <div className="sv-card rounded-2xl p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.2)] text-[#E60072] dark:text-[#FF2D8D]">
              <Volume2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white">
              Instant Text-to-Speech
            </h3>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              Convert translated words and complete sentences into spoken English with one-click
              playback, replay, adjustable speed, and mute controls.
            </p>
          </div>

          <div className="sv-card rounded-2xl p-6 space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.2)] text-[#E60072] dark:text-[#FF69B4]">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <h3 className="font-display text-lg font-bold text-[#111111] dark:text-white">
              Honest Scope &amp; Privacy
            </h3>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
              All video and ML inference stays strictly in your browser. We clearly document supported
              vocabulary and how single- and dual-hand geometry is processed.
            </p>
          </div>
        </div>
      </section>

      {/* Honest Scope Callout */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="sv-elevated sv-neon-highlight rounded-3xl p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#E60072] dark:text-[#FF69B4]">
              <Cpu className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
              Scientific Transparency: What SignVision Recognizes
            </div>
            <p className="text-sm sm:text-base text-[#111111] dark:text-[#A1A1AA] leading-relaxed">
              Full ASL is a rich visual language involving facial grammar, torso posture, and two-handed
              spatial syntax. SignVision tracks both hands simultaneously (42 3D landmarks) and uses
              geometric and temporal motion sequences to support{' '}
              <strong className="text-[#111111] dark:text-white">all 26 ASL letters (A–Z)</strong>{' '}
              plus{' '}
              <strong className="text-[#111111] dark:text-white">8 everyday phrases</strong>{' '}
              (HELLO, THANK YOU, PLEASE, SORRY, YES, NO, HELP, I LOVE YOU).
            </p>
          </div>
          <Link
            to="/how-it-works"
            className="sv-btn-neon shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
          >
            Read How It Works
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
};
