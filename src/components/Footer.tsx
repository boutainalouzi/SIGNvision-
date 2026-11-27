import React from 'react';
import { Link } from 'react-router-dom';
import { Hand, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[rgba(230,0,114,0.15)] dark:border-[rgba(255,45,141,0.15)] bg-[#FAFAFA] dark:bg-[#08080B]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E60072] dark:bg-[#FF2D8D] text-white shadow-[0_0_12px_rgba(255,45,141,0.3)]">
                <Hand className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="font-display text-base font-bold text-[#111111] dark:text-white">
                SignVision
              </span>
            </div>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] max-w-md">
              Accessible real-time American Sign Language (ASL) recognition powered by
              dual-hand MediaPipe 3D Landmarks and TensorFlow.js.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-[#52525B] dark:text-[#A1A1AA]">
            <Link to="/" className="hover:text-[#E60072] dark:hover:text-[#FF69B4] transition-colors">
              Home
            </Link>
            <Link to="/translator" className="hover:text-[#E60072] dark:hover:text-[#FF69B4] transition-colors">
              Translator
            </Link>
            <Link to="/how-it-works" className="hover:text-[#E60072] dark:hover:text-[#FF69B4] transition-colors">
              How It Works
            </Link>
            <Link to="/dictionary" className="hover:text-[#E60072] dark:hover:text-[#FF69B4] transition-colors">
              ASL Dictionary
            </Link>
            <Link to="/about" className="hover:text-[#E60072] dark:hover:text-[#FF69B4] transition-colors">
              About
            </Link>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-[rgba(230,0,114,0.12)] dark:border-[rgba(255,45,141,0.12)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#52525B] dark:text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
            100% client-side computer vision — camera frames never leave your browser.
          </span>
          <span>Dual-hand 42-landmark tracking · ASL A–Z and 8 common ASL expressions.</span>
        </div>
      </div>
    </footer>
  );
};
