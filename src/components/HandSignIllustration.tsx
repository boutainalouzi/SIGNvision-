import React, { useMemo } from 'react';
import { type AslSignInfo, type StaticLabel } from '../data/aslSigns';
import {
  generateDynamicSequence,
  generateHandLandmarks,
  getStaticPoseParams,
} from '../ml/handKinematics';
import { HAND_CONNECTIONS, type Landmark3D } from '../ml/landmarkFeatures';

interface HandSignIllustrationProps {
  sign: AslSignInfo;
  className?: string;
}

const MOTION_ARROWS: Record<string, { d: string; label: string }> = {
  J: { d: 'M 72 44 L 72 78 Q 72 95 54 90', label: 'Draw J curve' },
  Z: { d: 'M 36 34 L 74 34 L 38 74 L 76 74', label: 'Trace Z path' },
  HELLO: { d: 'M 38 40 Q 62 28 84 44', label: 'Wave outward' },
  'THANK YOU': { d: 'M 55 34 Q 58 64 62 90', label: 'Move forward & down' },
  PLEASE: { d: 'M 55 46 A 16 16 0 1 1 54.9 46', label: 'Circular chest motion' },
  SORRY: { d: 'M 55 46 A 16 16 0 1 1 54.9 46', label: 'Circular chest motion' },
  YES: { d: 'M 78 44 L 78 76 M 73 49 L 78 43 L 83 49 M 73 71 L 78 77 L 83 71', label: 'Nod up & down' },
  NO: { d: 'M 72 38 Q 62 50 56 58', label: 'Snap fingers to thumb' },
  HELP: { d: 'M 78 78 L 78 36 M 72 44 L 78 35 L 84 44', label: 'Lift upward' },
};

function projectToSvg(landmarks: Landmark3D[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(0.08, maxX - minX);
  const height = Math.max(0.08, maxY - minY);
  const scale = 72 / Math.max(width, height);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return landmarks.map((p) => ({
    x: 60 + (p.x - cx) * scale,
    y: 62 + (p.y - cy) * scale,
    z: p.z,
  }));
}

export const HandSignIllustration: React.FC<HandSignIllustrationProps> = ({
  sign,
  className = '',
}) => {
  const projected = useMemo(() => {
    if (sign.type === 'static') {
      const pose = getStaticPoseParams(sign.label as StaticLabel);
      return projectToSvg(generateHandLandmarks(pose));
    }
    const seq = generateDynamicSequence(
      sign.label as Parameters<typeof generateDynamicSequence>[0],
      16
    );
    return projectToSvg(seq[Math.floor(seq.length * 0.35)]);
  }, [sign.label, sign.type]);

  const motionArrow = MOTION_ARROWS[sign.label];
  const isDynamic = sign.type === 'dynamic';

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-[#FFF0F6]/70 dark:bg-[#14141B] border border-[rgba(230,0,114,0.18)] dark:border-[rgba(255,45,141,0.2)] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full p-2">
        <defs>
          <linearGradient id={`palm-${sign.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={isDynamic ? '#FF69B4' : '#FF2D8D'} stopOpacity="0.24" />
            <stop offset="100%" stopColor={isDynamic ? '#E60072' : '#9D174D'} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Subtle grid */}
        <circle
          cx="60"
          cy="60"
          r="46"
          fill={`url(#palm-${sign.id})`}
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="1"
        />

        {/* Palm polygon */}
        <polygon
          points={`${projected[0].x},${projected[0].y} ${projected[1].x},${projected[1].y} ${projected[5].x},${projected[5].y} ${projected[9].x},${projected[9].y} ${projected[13].x},${projected[13].y} ${projected[17].x},${projected[17].y}`}
          fill={isDynamic ? 'rgba(255, 105, 180, 0.22)' : 'rgba(255, 45, 141, 0.22)'}
        />

        {/* Bone capsules */}
        {HAND_CONNECTIONS.map(([a, b], i) => (
          <line
            key={i}
            x1={projected[a].x}
            y1={projected[a].y}
            x2={projected[b].x}
            y2={projected[b].y}
            stroke={isDynamic ? '#FF69B4' : '#E60072'}
            strokeWidth="4.5"
            strokeLinecap="round"
            className="dark:opacity-95"
          />
        ))}

        {/* Highlight inner skeleton */}
        {HAND_CONNECTIONS.map(([a, b], i) => (
          <line
            key={`inner-${i}`}
            x1={projected[a].x}
            y1={projected[a].y}
            x2={projected[b].x}
            y2={projected[b].y}
            stroke={isDynamic ? '#FFE4F1' : '#FFC2DF'}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Joints & Fingertips */}
        {projected.map((pt, idx) => {
          const isTip = idx === 4 || idx === 8 || idx === 12 || idx === 16 || idx === 20;
          const isWrist = idx === 0;
          return (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={isTip ? 3.2 : isWrist ? 3.6 : 2.1}
              fill={isTip ? (isDynamic ? '#FF69B4' : '#FF2D8D') : '#FFFFFF'}
              stroke={isDynamic ? '#9D174D' : '#831843'}
              strokeWidth="1.2"
            />
          );
        })}

        {/* Dynamic motion trajectory overlay */}
        {motionArrow && (
          <path
            d={motionArrow.d}
            fill="none"
            stroke="#FF69B4"
            strokeWidth="2.4"
            strokeDasharray="4 3"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
};
