import React from 'react';
import { Link } from 'react-router-dom';
import {
  Accessibility,
  ArrowRight,
  Eye,
  HandHeart,
  Lock,
  MessageSquareHeart,
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(230,0,114,0.22)] dark:border-[rgba(255,45,141,0.3)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
          <HandHeart className="h-3.5 w-3.5 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
          Our Accessibility Mission
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111111] dark:text-white">
          About SignVision
        </h1>
        <p className="text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
          Over 70 million deaf and hard-of-hearing people worldwide rely on sign language as their
          primary means of expression, yet everyday interactions—at clinics, classrooms, workplaces,
          and retail counters—still face unnecessary communication barriers. SignVision was created
          to help close that gap using accessible, privacy-first AI right in the web browser.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="sv-card rounded-2xl p-6 space-y-3">
          <Accessibility className="h-7 w-7 text-[#E60072] dark:text-[#FF2D8D]" />
          <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white">
            Designed Around Inclusive UX
          </h2>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Every control in SignVision features large touch targets, high-contrast light and
            ultra-dark themes, keyboard navigation, ARIA live announcements for screen readers,
            and mirrored/unmirrored camera views plus simultaneous left- and right-hand tracking.
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <Lock className="h-7 w-7 text-[#E60072] dark:text-[#FF69B4]" />
          <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white">
            Zero-Server Video Privacy
          </h2>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Your camera feed is never uploaded, recorded, or transmitted to external servers.
            MediaPipe dual-hand landmark tracking and TensorFlow.js inference execute entirely on
            your own device GPU/CPU.
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <MessageSquareHeart className="h-7 w-7 text-[#E60072] dark:text-[#FF2D8D]" />
          <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white">
            Bridging Written &amp; Spoken Output
          </h2>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Recognized signs are immediately assembled into readable sentences and can be spoken
            aloud via the browser&apos;s Web Speech synthesis engine—giving non-signing listeners
            both visual and audio clarity.
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <Eye className="h-7 w-7 text-[#E60072] dark:text-[#FF69B4]" />
          <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white">
            Honest Engineering Over Hype
          </h2>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            SignVision treats American Sign Language with linguistic respect. While it reliably
            supports fingerspelling (A–Z) and common ASL words across one or both hands, we openly
            state its current boundaries and encourage learning ASL directly from the Deaf community.
          </p>
        </div>
      </div>

      <div className="sv-elevated sv-neon-highlight rounded-3xl p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl font-extrabold text-[#111111] dark:text-white">
            Try SignVision Live Today
          </h2>
          <p className="text-[#52525B] dark:text-[#A1A1AA] text-sm sm:text-base">
            Launch the Translator with your webcam or explore all 34 supported ASL signs.
          </p>
        </div>
        <Link
          to="/translator"
          className="sv-btn-neon inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold shrink-0"
        >
          Launch Translator
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
