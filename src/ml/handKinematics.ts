import type { Landmark3D } from './landmarkFeatures';
import type { DynamicLabel, StaticLabel } from '../data/aslSigns';

export interface FingerPose {
  /** MCP flexion in radians: 0 = straight up, PI/2 = bent 90 deg forward */
  mcpFlex: number;
  /** PIP flexion in radians: 0 = straight, ~1.7 = curled */
  pipFlex: number;
  /** DIP flexion in radians */
  dipFlex: number;
  /** Lateral splay in radians (+ spreads toward pinky, - spreads toward thumb) */
  splay: number;
  /** Extra lateral cross offset at tip (used for R) */
  crossOffset?: number;
}

export interface ThumbPose {
  /** Abduction away from palm plane / sideways (radians) */
  abduction: number;
  /** Opposition / flexion across palm (0 = out to side, 1.4 = tucked across palm) */
  opposition: number;
  /** IP joint bend (radians) */
  ipFlex: number;
  /** Elevation angle upward (radians) */
  elevation: number;
}

export interface HandPoseParams {
  thumb: ThumbPose;
  index: FingerPose;
  middle: FingerPose;
  ring: FingerPose;
  pinky: FingerPose;
  /** Global hand rotation in radians */
  pitch?: number; // tilt forward/back (+ tilts fingers toward camera / down)
  yaw?: number;   // turn palm sideways
  roll?: number;  // rotate in image plane (+ tilts clockwise)
  /** Wrist position in normalized [0..1] image coords */
  wrist?: { x: number; y: number; z: number };
  scale?: number;
}

function rotatePoint(p: Landmark3D, pitch: number, yaw: number, roll: number): Landmark3D {
  let { x, y, z } = p;

  // Pitch around X axis (tilts +Y/-Y into Z)
  if (pitch !== 0) {
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const ny = y * cp - z * sp;
    const nz = y * sp + z * cp;
    y = ny;
    z = nz;
  }

  // Yaw around Y axis (turns palm sideways)
  if (yaw !== 0) {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const nx = x * cy + z * sy;
    const nz = -x * sy + z * cy;
    x = nx;
    z = nz;
  }

  // Roll around Z axis (tilts in image plane)
  if (roll !== 0) {
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const nx = x * cr - y * sr;
    const ny = x * sr + y * cr;
    x = nx;
    y = ny;
  }

  return { x, y, z };
}

function buildFingerChain(
  mcpPos: Landmark3D,
  lengths: [number, number, number],
  pose: FingerPose
): [Landmark3D, Landmark3D, Landmark3D, Landmark3D] {
  const [l1, l2, l3] = lengths;
  const pts: Landmark3D[] = [mcpPos];

  // Segment angles accumulate flexion toward +Z (anterior palm side) while default direction is -Y (upward)
  const angles = [pose.mcpFlex, pose.mcpFlex + pose.pipFlex, pose.mcpFlex + pose.pipFlex + pose.dipFlex];
  const segLens = [l1, l2, l3];
  let curr = { ...mcpPos };

  for (let i = 0; i < 3; i++) {
    const theta = angles[i];
    const len = segLens[i];
    // Direction: -Y * cos(theta) + Z * sin(theta) (flexes forward/down into palm)
    const dirY = -Math.cos(theta);
    const dirZ = -Math.sin(theta); // negative Z is toward camera/palm-front
    const dirX = Math.sin(pose.splay) * (i === 0 ? 1 : 0.65);

    const norm = Math.hypot(dirX, dirY, dirZ) || 1;
    curr = {
      x: curr.x + (dirX / norm) * len + (i === 2 && pose.crossOffset ? pose.crossOffset : 0),
      y: curr.y + (dirY / norm) * len,
      z: curr.z + (dirZ / norm) * len,
    };
    pts.push(curr);
  }

  return [pts[0], pts[1], pts[2], pts[3]];
}

function buildThumbChain(pose: ThumbPose): [Landmark3D, Landmark3D, Landmark3D, Landmark3D] {
  const cmc: Landmark3D = { x: -0.24, y: -0.22, z: -0.04 };
  const l1 = 0.27;
  const l2 = 0.25;
  const l3 = 0.22;

  // Base direction: outward (-X) and upward (-Y), rotated inward (+X, -Z) by opposition
  const opp = pose.opposition;
  const elev = pose.elevation;
  const abd = pose.abduction;

  const dir1 = {
    x: -Math.cos(opp) * 0.85 + Math.sin(opp) * 0.55,
    y: -Math.sin(elev) * 0.85 - 0.35,
    z: -Math.sin(opp) * 0.55 - Math.sin(abd) * 0.45,
  };
  const m1 = Math.hypot(dir1.x, dir1.y, dir1.z) || 1;
  const mcp: Landmark3D = {
    x: cmc.x + (dir1.x / m1) * l1,
    y: cmc.y + (dir1.y / m1) * l1,
    z: cmc.z + (dir1.z / m1) * l1,
  };

  const opp2 = opp + pose.ipFlex * 0.45;
  const dir2 = {
    x: -Math.cos(opp2) * 0.75 + Math.sin(opp2) * 0.75,
    y: -Math.sin(elev) * 0.95 - 0.15,
    z: -Math.sin(opp2) * 0.55 - Math.sin(abd) * 0.3,
  };
  const m2 = Math.hypot(dir2.x, dir2.y, dir2.z) || 1;
  const ip: Landmark3D = {
    x: mcp.x + (dir2.x / m2) * l2,
    y: mcp.y + (dir2.y / m2) * l2,
    z: mcp.z + (dir2.z / m2) * l2,
  };

  const opp3 = opp + pose.ipFlex;
  const dir3 = {
    x: -Math.cos(opp3) * 0.65 + Math.sin(opp3) * 0.85,
    y: -Math.sin(elev - pose.ipFlex * 0.4) * 0.9 - 0.05,
    z: -Math.sin(opp3) * 0.55 - Math.sin(abd) * 0.2,
  };
  const m3 = Math.hypot(dir3.x, dir3.y, dir3.z) || 1;
  const tip: Landmark3D = {
    x: ip.x + (dir3.x / m3) * l3,
    y: ip.y + (dir3.y / m3) * l3,
    z: ip.z + (dir3.z / m3) * l3,
  };

  return [cmc, mcp, ip, tip];
}

export function generateHandLandmarks(params: HandPoseParams): Landmark3D[] {
  const wristLocal: Landmark3D = { x: 0, y: 0, z: 0 };
  const thumb = buildThumbChain(params.thumb);

  const index = buildFingerChain({ x: -0.26, y: -0.95, z: 0 }, [0.36, 0.24, 0.18], params.index);
  const middle = buildFingerChain({ x: -0.06, y: -1.0, z: 0 }, [0.40, 0.27, 0.20], params.middle);
  const ring = buildFingerChain({ x: 0.14, y: -0.95, z: 0 }, [0.37, 0.25, 0.19], params.ring);
  const pinky = buildFingerChain({ x: 0.32, y: -0.84, z: 0 }, [0.29, 0.20, 0.16], params.pinky);

  const localLandmarks: Landmark3D[] = [
    wristLocal,
    ...thumb,
    ...index,
    ...middle,
    ...ring,
    ...pinky,
  ];

  const pitch = params.pitch ?? 0;
  const yaw = params.yaw ?? 0;
  const roll = params.roll ?? 0;
  const scale = params.scale ?? 0.17;
  const wrist = params.wrist ?? { x: 0.5, y: 0.72, z: 0 };

  return localLandmarks.map((pt) => {
    const r = rotatePoint(pt, pitch, yaw, roll);
    return {
      x: wrist.x + r.x * scale,
      y: wrist.y + r.y * scale,
      z: wrist.z + r.z * scale,
    };
  });
}

const STRAIGHT = (splay = 0): FingerPose => ({
  mcpFlex: 0.04,
  pipFlex: 0.05,
  dipFlex: 0.04,
  splay,
});

const CURLED = (splay = 0): FingerPose => ({
  mcpFlex: 1.55,
  pipFlex: 1.75,
  dipFlex: 1.1,
  splay,
});

const HALF_CURVED = (splay = 0): FingerPose => ({
  mcpFlex: 0.65,
  pipFlex: 0.95,
  dipFlex: 0.65,
  splay,
});

const TUCKED_OVER_THUMB = (splay = 0): FingerPose => ({
  mcpFlex: 1.45,
  pipFlex: 1.25,
  dipFlex: 0.85,
  splay,
});

export function getStaticPoseParams(label: StaticLabel): HandPoseParams {
  switch (label) {
    case 'A':
      return {
        thumb: { abduction: 0.15, opposition: 0.18, ipFlex: 0.08, elevation: 1.25 },
        index: CURLED(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'B':
      return {
        thumb: { abduction: 0.25, opposition: 1.38, ipFlex: 0.45, elevation: 0.25 },
        index: STRAIGHT(0.02),
        middle: STRAIGHT(0.0),
        ring: STRAIGHT(-0.02),
        pinky: STRAIGHT(-0.04),
      };
    case 'C':
      return {
        thumb: { abduction: 0.65, opposition: 0.45, ipFlex: 0.55, elevation: 0.2 },
        index: HALF_CURVED(0.02),
        middle: HALF_CURVED(0.0),
        ring: HALF_CURVED(-0.02),
        pinky: HALF_CURVED(-0.03),
        yaw: 0.85,
      };
    case 'D':
      return {
        thumb: { abduction: 0.45, opposition: 1.05, ipFlex: 0.35, elevation: 0.65 },
        index: STRAIGHT(),
        middle: { mcpFlex: 1.15, pipFlex: 1.15, dipFlex: 0.6, splay: -0.05 },
        ring: { mcpFlex: 1.25, pipFlex: 1.25, dipFlex: 0.7, splay: -0.06 },
        pinky: { mcpFlex: 1.35, pipFlex: 1.35, dipFlex: 0.75, splay: -0.08 },
      };
    case 'E':
      return {
        thumb: { abduction: 0.2, opposition: 1.45, ipFlex: 0.65, elevation: 0.1 },
        index: { mcpFlex: 1.2, pipFlex: 1.85, dipFlex: 1.3, splay: 0 },
        middle: { mcpFlex: 1.2, pipFlex: 1.85, dipFlex: 1.3, splay: 0 },
        ring: { mcpFlex: 1.2, pipFlex: 1.85, dipFlex: 1.3, splay: 0 },
        pinky: { mcpFlex: 1.2, pipFlex: 1.85, dipFlex: 1.3, splay: 0 },
      };
    case 'F':
      return {
        thumb: { abduction: 0.5, opposition: 0.82, ipFlex: 0.65, elevation: 0.75 },
        index: { mcpFlex: 1.12, pipFlex: 1.15, dipFlex: 0.75, splay: -0.05 },
        middle: STRAIGHT(0.04),
        ring: STRAIGHT(0.08),
        pinky: STRAIGHT(0.14),
      };
    case 'G':
      return {
        thumb: { abduction: 0.2, opposition: 0.35, ipFlex: 0.15, elevation: 0.7 },
        index: STRAIGHT(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: CURLED(),
        yaw: 0.75,
        roll: 1.42,
      };
    case 'H':
      return {
        thumb: { abduction: 0.25, opposition: 1.25, ipFlex: 0.45, elevation: 0.35 },
        index: STRAIGHT(0.02),
        middle: STRAIGHT(-0.02),
        ring: CURLED(),
        pinky: CURLED(),
        yaw: 0.65,
        roll: 1.45,
      };
    case 'I':
      return {
        thumb: { abduction: 0.25, opposition: 1.32, ipFlex: 0.55, elevation: 0.4 },
        index: CURLED(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: STRAIGHT(0.05),
      };
    case 'K':
      return {
        thumb: { abduction: 0.45, opposition: 0.92, ipFlex: 0.15, elevation: 1.0 },
        index: STRAIGHT(-0.1),
        middle: { mcpFlex: 0.42, pipFlex: 0.08, dipFlex: 0.05, splay: 0.12 },
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'L':
      return {
        thumb: { abduction: 0.1, opposition: -0.25, ipFlex: 0.05, elevation: 0.05 },
        index: STRAIGHT(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'M':
      return {
        thumb: { abduction: 0.15, opposition: 1.65, ipFlex: 0.45, elevation: 0.15 },
        index: TUCKED_OVER_THUMB(),
        middle: TUCKED_OVER_THUMB(),
        ring: TUCKED_OVER_THUMB(),
        pinky: CURLED(),
      };
    case 'N':
      return {
        thumb: { abduction: 0.15, opposition: 1.35, ipFlex: 0.4, elevation: 0.22 },
        index: TUCKED_OVER_THUMB(),
        middle: TUCKED_OVER_THUMB(),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'O':
      return {
        thumb: { abduction: 0.55, opposition: 0.85, ipFlex: 0.72, elevation: 0.42 },
        index: { mcpFlex: 0.92, pipFlex: 1.15, dipFlex: 0.85, splay: 0 },
        middle: { mcpFlex: 0.95, pipFlex: 1.18, dipFlex: 0.88, splay: 0 },
        ring: { mcpFlex: 0.98, pipFlex: 1.2, dipFlex: 0.9, splay: 0 },
        pinky: { mcpFlex: 1.0, pipFlex: 1.22, dipFlex: 0.9, splay: 0 },
        yaw: 0.7,
      };
    case 'P':
      return {
        thumb: { abduction: 0.45, opposition: 0.92, ipFlex: 0.15, elevation: 1.0 },
        index: STRAIGHT(-0.1),
        middle: { mcpFlex: 0.42, pipFlex: 0.08, dipFlex: 0.05, splay: 0.12 },
        ring: CURLED(),
        pinky: CURLED(),
        pitch: 1.55,
      };
    case 'Q':
      return {
        thumb: { abduction: 0.25, opposition: 0.25, ipFlex: 0.1, elevation: 0.7 },
        index: STRAIGHT(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: CURLED(),
        roll: 2.95,
      };
    case 'R':
      return {
        thumb: { abduction: 0.25, opposition: 1.28, ipFlex: 0.5, elevation: 0.4 },
        index: { mcpFlex: 0.05, pipFlex: 0.08, dipFlex: 0.05, splay: 0.08, crossOffset: 0.16 },
        middle: { mcpFlex: 0.12, pipFlex: 0.1, dipFlex: 0.08, splay: -0.08, crossOffset: -0.14 },
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'S':
      return {
        thumb: { abduction: 0.45, opposition: 1.25, ipFlex: 0.65, elevation: 0.55 },
        index: { mcpFlex: 1.65, pipFlex: 1.85, dipFlex: 1.2, splay: 0 },
        middle: { mcpFlex: 1.65, pipFlex: 1.85, dipFlex: 1.2, splay: 0 },
        ring: { mcpFlex: 1.65, pipFlex: 1.85, dipFlex: 1.2, splay: 0 },
        pinky: { mcpFlex: 1.65, pipFlex: 1.85, dipFlex: 1.2, splay: 0 },
      };
    case 'T':
      return {
        thumb: { abduction: 0.35, opposition: 0.85, ipFlex: 0.15, elevation: 0.95 },
        index: { mcpFlex: 1.55, pipFlex: 1.65, dipFlex: 1.05, splay: -0.06 },
        middle: CURLED(0.05),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'U':
      return {
        thumb: { abduction: 0.28, opposition: 1.3, ipFlex: 0.5, elevation: 0.42 },
        index: STRAIGHT(0.02),
        middle: STRAIGHT(-0.02),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'V':
      return {
        thumb: { abduction: 0.28, opposition: 1.3, ipFlex: 0.5, elevation: 0.42 },
        index: STRAIGHT(-0.22),
        middle: STRAIGHT(0.22),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'W':
      return {
        thumb: { abduction: 0.35, opposition: 1.48, ipFlex: 0.6, elevation: 0.35 },
        index: STRAIGHT(-0.22),
        middle: STRAIGHT(0.0),
        ring: STRAIGHT(0.22),
        pinky: CURLED(),
      };
    case 'X':
      return {
        thumb: { abduction: 0.25, opposition: 1.25, ipFlex: 0.55, elevation: 0.4 },
        index: { mcpFlex: 0.35, pipFlex: 1.45, dipFlex: 1.35, splay: 0 },
        middle: CURLED(),
        ring: CURLED(),
        pinky: CURLED(),
      };
    case 'Y':
      return {
        thumb: { abduction: 0.12, opposition: -0.22, ipFlex: 0.08, elevation: 0.3 },
        index: CURLED(),
        middle: CURLED(),
        ring: CURLED(),
        pinky: STRAIGHT(0.22),
      };
    case 'I LOVE YOU':
      return {
        thumb: { abduction: 0.12, opposition: -0.22, ipFlex: 0.06, elevation: 0.35 },
        index: STRAIGHT(-0.05),
        middle: CURLED(),
        ring: CURLED(),
        pinky: STRAIGHT(0.18),
      };
  }
}

export function generateDynamicSequence(
  label: DynamicLabel,
  numFrames = 24,
  phaseOffset = 0,
  speedScale = 1,
  amplitudeScale = 1
): Landmark3D[][] {
  const frames: Landmark3D[][] = [];

  for (let i = 0; i < numFrames; i++) {
    const u = i / Math.max(1, numFrames - 1);
    const t = Math.min(1, Math.max(0, u * speedScale + phaseOffset));

    let pose: HandPoseParams;

    switch (label) {
      case 'J': {
        const base = getStaticPoseParams('I');
        // Downward sweep then hook left and slightly up
        const x = 0.56 - (t < 0.6 ? 0.02 * t : 0.012 + 0.16 * ((t - 0.6) / 0.4));
        const y = 0.52 + 0.24 * Math.sin(t * Math.PI * 0.72);
        pose = { ...base, wrist: { x, y, z: 0 }, roll: -0.25 * t * amplitudeScale };
        break;
      }
      case 'Z': {
        const base = getStaticPoseParams('D');
        // Z path: right (0..0.33), diag down-left (0.33..0.67), right (0.67..1)
        let x = 0.42;
        let y = 0.48;
        if (t < 0.33) {
          const s = t / 0.33;
          x = 0.42 + 0.18 * s * amplitudeScale;
          y = 0.48;
        } else if (t < 0.67) {
          const s = (t - 0.33) / 0.34;
          x = 0.42 + 0.18 * (1 - s) * amplitudeScale;
          y = 0.48 + 0.22 * s * amplitudeScale;
        } else {
          const s = (t - 0.67) / 0.33;
          x = 0.42 + 0.18 * s * amplitudeScale;
          y = 0.48 + 0.22 * amplitudeScale;
        }
        pose = { ...base, wrist: { x, y, z: -0.02 }, pitch: 0.25 };
        break;
      }
      case 'HELLO': {
        const base = getStaticPoseParams('B');
        pose = {
          ...base,
          thumb: { abduction: 0.35, opposition: 0.35, ipFlex: 0.1, elevation: 0.8 },
          wrist: {
            x: 0.42 + 0.22 * t * amplitudeScale,
            y: 0.48 + 0.08 * Math.sin(t * Math.PI) * amplitudeScale,
            z: -0.06 * t,
          },
          roll: -0.15 + 0.45 * t * amplitudeScale,
          yaw: 0.15 - 0.2 * t,
        };
        break;
      }
      case 'THANK YOU': {
        const base = getStaticPoseParams('B');
        pose = {
          ...base,
          pitch: 0.2 + 0.75 * t * amplitudeScale,
          wrist: {
            x: 0.5,
            y: 0.48 + 0.22 * t * amplitudeScale,
            z: -0.14 * t * amplitudeScale,
          },
          scale: 0.17 + 0.03 * t,
        };
        break;
      }
      case 'PLEASE': {
        const base = getStaticPoseParams('B');
        const angle = t * Math.PI * 2;
        pose = {
          ...base,
          yaw: 1.25,
          pitch: 0.2,
          wrist: {
            x: 0.5 + 0.09 * Math.cos(angle) * amplitudeScale,
            y: 0.66 + 0.09 * Math.sin(angle) * amplitudeScale,
            z: 0,
          },
        };
        break;
      }
      case 'SORRY': {
        const base = getStaticPoseParams('S');
        const angle = t * Math.PI * 2;
        pose = {
          ...base,
          yaw: 0.9,
          wrist: {
            x: 0.5 + 0.09 * Math.cos(angle) * amplitudeScale,
            y: 0.66 + 0.09 * Math.sin(angle) * amplitudeScale,
            z: 0,
          },
        };
        break;
      }
      case 'YES': {
        const base = getStaticPoseParams('S');
        const nod = Math.sin(t * Math.PI * 4);
        pose = {
          ...base,
          pitch: 0.35 + 0.45 * nod * amplitudeScale,
          wrist: {
            x: 0.5,
            y: 0.65 + 0.05 * nod * amplitudeScale,
            z: 0,
          },
        };
        break;
      }
      case 'NO': {
        // Index + middle snapping onto thumb twice
        const snap = 0.5 - 0.5 * Math.cos(t * Math.PI * 4);
        pose = {
          thumb: { abduction: 0.45, opposition: 0.85, ipFlex: 0.25, elevation: 0.55 },
          index: {
            mcpFlex: 0.35 + 0.65 * snap * amplitudeScale,
            pipFlex: 0.35 + 0.55 * snap * amplitudeScale,
            dipFlex: 0.2,
            splay: 0,
          },
          middle: {
            mcpFlex: 0.38 + 0.65 * snap * amplitudeScale,
            pipFlex: 0.35 + 0.55 * snap * amplitudeScale,
            dipFlex: 0.2,
            splay: 0,
          },
          ring: CURLED(),
          pinky: CURLED(),
          yaw: 0.55,
          wrist: { x: 0.5, y: 0.66, z: 0 },
        };
        break;
      }
      case 'HELP': {
        const base = getStaticPoseParams('A');
        pose = {
          ...base,
          thumb: { abduction: 0.15, opposition: 0.0, ipFlex: 0.05, elevation: 1.45 },
          yaw: 0.75,
          wrist: {
            x: 0.5,
            y: 0.78 - 0.26 * t * amplitudeScale,
            z: -0.02,
          },
        };
        break;
      }
      case 'IDLE':
      default: {
        // Stationary / resting open or slight random drift
        const base = getStaticPoseParams('B');
        pose = {
          ...base,
          index: HALF_CURVED(),
          middle: HALF_CURVED(),
          ring: HALF_CURVED(),
          pinky: HALF_CURVED(),
          wrist: {
            x: 0.5 + 0.006 * Math.sin(t * Math.PI * 2),
            y: 0.7 + 0.006 * Math.cos(t * Math.PI * 2),
            z: 0,
          },
        };
        break;
      }
    }

    frames.push(generateHandLandmarks(pose));
  }

  return frames;
}
