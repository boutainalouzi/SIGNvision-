import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Camera,
  Cpu,
  Layers,
  Sparkles,
  Volume2,
} from 'lucide-react';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="space-y-4 max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(230,0,114,0.22)] dark:border-[rgba(255,45,141,0.3)] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#E60072] dark:text-[#FF69B4]">
          <Cpu className="h-3.5 w-3.5 text-[#E60072] dark:text-[#FF2D8D]" aria-hidden="true" />
          Architecture &amp; ML Pipeline
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111111] dark:text-white">
          How SignVision Recognizes Sign Language
        </h1>
        <p className="text-lg text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
          SignVision combines{' '}
          <strong className="text-[#111111] dark:text-white">
            Dual-Hand MediaPipe 3D Landmarks
          </strong>{' '}
          with a{' '}
          <strong className="text-[#111111] dark:text-white">
            dual-branch TensorFlow.js neural architecture
          </strong>
          —separating static handshapes from motion-dependent dynamic signs across both hands.
        </p>
      </div>

      {/* 4-Stage Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="sv-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E60072] dark:bg-[#FF2D8D] text-white font-mono font-bold shadow-[0_0_14px_rgba(255,45,141,0.3)]">
              01
            </span>
            <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2">
              <Camera className="h-5 w-5 text-[#E60072] dark:text-[#FF2D8D]" />
              42-Point Dual-Hand Extraction
            </h2>
          </div>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Every webcam frame is processed locally in your browser by MediaPipe{' '}
            <code className="font-mono text-xs bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4] px-1.5 py-0.5 rounded">
              HandLandmarker (numHands: 2)
            </code>
            . Instead of feeding raw pixels to a classifier, we extract 21 anatomical 3D coordinates
            independently for both the Left Hand and Right Hand (42 landmarks total).
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E60072] dark:bg-[#FF2D8D] text-white font-mono font-bold shadow-[0_0_14px_rgba(255,45,141,0.3)]">
              02
            </span>
            <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-[#E60072] dark:text-[#FF69B4]" />
              Bilateral &amp; Inter-Hand Geometry
            </h2>
          </div>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Each hand&apos;s landmarks are normalized relative to wrist and palm scale, while
            dual-hand frames compute inter-wrist distance, fingertip proximity, mirror symmetry,
            and relative vertical lift across both hands.
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E60072] dark:bg-[#FF2D8D] text-white font-mono font-bold shadow-[0_0_14px_rgba(255,45,141,0.3)]">
              03
            </span>
            <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-[#E60072] dark:text-[#FF2D8D]" />
              Dual-Branch Static + Dynamic ML
            </h2>
          </div>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            <strong className="text-[#111111] dark:text-white">Static Branch (MLP):</strong>{' '}
            Classifies 25 held handshapes (<span className="font-mono text-xs">A–I, K–Y, I LOVE YOU</span>)
            for both left and right hands with EMA smoothing.
            <br />
            <strong className="text-[#111111] dark:text-white">Dynamic Branch (Temporal Net):</strong>{' '}
            Evaluates rolling 24-frame trajectories across single and dual-hand buffers to recognize
            motion signs (<span className="font-mono text-xs">J, Z, HELLO, THANK YOU, PLEASE, SORRY, YES, NO, HELP</span>).
          </p>
        </div>

        <div className="sv-card rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E60072] dark:bg-[#FF2D8D] text-white font-mono font-bold shadow-[0_0_14px_rgba(255,45,141,0.3)]">
              04
            </span>
            <h2 className="font-display text-xl font-bold text-[#111111] dark:text-white flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-[#E60072] dark:text-[#FF69B4]" />
              Sentence Assembly &amp; Speech Synthesis
            </h2>
          </div>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA] leading-relaxed">
            Confirmed letters automatically join into words while word signs insert spaces cleanly.
            The Web Speech API speaks translated sentences aloud in real time with replay, speed, and
            mute controls.
          </p>
        </div>
      </div>

      {/* Why Simple Image Classification Is Not Enough */}
      <section className="sv-elevated rounded-3xl p-8 space-y-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 text-[#E60072] dark:text-[#FF2D8D] shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="font-display text-2xl font-bold text-[#111111] dark:text-white">
              Why Simple Image Classification Cannot Solve ASL
            </h2>
            <p className="text-[#52525B] dark:text-[#A1A1AA] text-sm sm:text-base leading-relaxed">
              Many naive sign language demos train a 2D image CNN directly on webcam photos. That
              approach breaks down quickly in real life for four fundamental reasons:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#52525B] dark:text-[#A1A1AA]">
          <div className="sv-card rounded-xl p-4">
            <strong className="block text-[#111111] dark:text-white mb-1">
              1. Motion Is Essential for ASL
            </strong>
            Signs like <strong>J</strong>, <strong>Z</strong>, <strong>HELLO</strong>,{' '}
            <strong>THANK YOU</strong>, <strong>YES</strong>, and <strong>NO</strong> are defined by
            trajectory over time, not a single still frame.
          </div>
          <div className="sv-card rounded-xl p-4">
            <strong className="block text-[#111111] dark:text-white mb-1">
              2. Lighting, Skin Tone &amp; Background Bias
            </strong>
            Pixel classifiers memorize room backgrounds and lighting instead of finger geometry.
            Landmark coordinates make the model invariant to clothing, skin tone, and backdrop.
          </div>
          <div className="sv-card rounded-xl p-4">
            <strong className="block text-[#111111] dark:text-white mb-1">
              3. Dual-Hand Coordination
            </strong>
            Signs such as two-handed <strong>HELP</strong> rely on the relative position,
            handshape contrast, and coordinated upward motion between both hands simultaneously.
          </div>
          <div className="sv-card rounded-xl p-4">
            <strong className="block text-[#111111] dark:text-white mb-1">
              4. Training Data Transparency
            </strong>
            SignVision&apos;s TensorFlow.js models are trained on anatomically parameterized 3D
            landmark manifolds and temporal sequences. Hold static letters steady for ~0.8 seconds
            for crisp sentence commits.
          </div>
        </div>
      </section>

      <div className="sv-card rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-[#E60072] dark:text-[#FF2D8D]" />
          <div>
            <h3 className="font-display font-bold text-[#111111] dark:text-white">
              Ready to test the live dual-hand pipeline?
            </h3>
            <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
              Try your webcam with both hands or use the built-in 3D Kinematic Hand Simulator.
            </p>
          </div>
        </div>
        <Link
          to="/translator"
          className="sv-btn-neon inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
        >
          Open Translator
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
};
