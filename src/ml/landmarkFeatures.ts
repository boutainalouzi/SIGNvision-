export interface Landmark3D {
  x: number;
  y: number;
  z: number;
}

export const STATIC_FEATURE_DIM = 89;
export const DYNAMIC_FEATURE_DIM = 22;
export const DYNAMIC_SEQUENCE_LENGTH = 24;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // Thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palm bridge
  [5, 9], [9, 13], [13, 17],
];

const FINGER_JOINT_TRIPLETS: ReadonlyArray<readonly [number, number, number]> = [
  // Thumb (3)
  [0, 1, 2], [1, 2, 3], [2, 3, 4],
  // Index (3)
  [0, 5, 6], [5, 6, 7], [6, 7, 8],
  // Middle (3)
  [0, 9, 10], [9, 10, 11], [10, 11, 12],
  // Ring (3)
  [0, 13, 14], [13, 14, 15], [14, 15, 16],
  // Pinky (3)
  [0, 17, 18], [17, 18, 19], [18, 19, 20],
];

function dist3D(a: Landmark3D, b: Landmark3D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.hypot(dx, dy, dz);
}

function cosineAngle(a: Landmark3D, b: Landmark3D, c: Landmark3D): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v1z = a.z - b.z;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const v2z = c.z - b.z;
  const m1 = Math.hypot(v1x, v1y, v1z);
  const m2 = Math.hypot(v2x, v2y, v2z);
  if (m1 < 1e-6 || m2 < 1e-6) return 0;
  return Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y + v1z * v2z) / (m1 * m2)));
}

/**
 * Mirrors X coordinates around 0.5 when handedness is Left so left & right
 * hands map to a canonical right-handed coordinate space.
 */
export function canonicalizeHandedness(
  landmarks: readonly Landmark3D[],
  handedness?: string
): Landmark3D[] {
  const isLeft = handedness?.toLowerCase() === 'left';
  if (!isLeft) {
    return landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }));
  }
  return landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
}

export function computePalmScale(landmarks: readonly Landmark3D[]): number {
  const d = dist3D(landmarks[0], landmarks[9]);
  return Math.max(d, 0.02);
}

export function computePalmNormal(landmarks: readonly Landmark3D[]): [number, number, number] {
  const w = landmarks[0];
  const idx = landmarks[5];
  const pnk = landmarks[17];

  const ax = idx.x - w.x;
  const ay = idx.y - w.y;
  const az = idx.z - w.z;

  const bx = pnk.x - w.x;
  const by = pnk.y - w.y;
  const bz = pnk.z - w.z;

  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const norm = Math.hypot(nx, ny, nz) || 1;
  return [nx / norm, ny / norm, nz / norm];
}

/**
 * Extracts an 89-dimensional scale- & translation-invariant feature vector
 * representing 3D hand anatomy, finger flexion cosines, key fingertip contacts,
 * and palm orientation for static ASL classification.
 */
export function extractStaticFeatures(
  rawLandmarks: readonly Landmark3D[],
  handedness?: string
): Float32Array {
  const lm = canonicalizeHandedness(rawLandmarks, handedness);
  const wrist = lm[0];
  const scale = computePalmScale(lm);

  const norm: Landmark3D[] = lm.map((p) => ({
    x: (p.x - wrist.x) / scale,
    y: (p.y - wrist.y) / scale,
    z: (p.z - wrist.z) / scale,
  }));

  const features = new Float32Array(STATIC_FEATURE_DIM);
  let idx = 0;

  // 1. Normalized 3D coordinates of landmarks 1..20 (60)
  for (let i = 1; i <= 20; i++) {
    features[idx++] = norm[i].x;
    features[idx++] = norm[i].y;
    features[idx++] = norm[i].z;
  }

  // 2. Joint flexion cosines (15)
  for (const [a, b, c] of FINGER_JOINT_TRIPLETS) {
    features[idx++] = cosineAngle(norm[a], norm[b], norm[c]);
  }

  // 3. Fingertip-to-wrist distances (5)
  for (const tip of [4, 8, 12, 16, 20]) {
    features[idx++] = dist3D(norm[tip], norm[0]);
  }

  // 4. Thumb tip to other fingertips (4)
  for (const tip of [8, 12, 16, 20]) {
    features[idx++] = dist3D(norm[4], norm[tip]);
  }

  // 5. Adjacent fingertip spread distances (3)
  features[idx++] = dist3D(norm[8], norm[12]);
  features[idx++] = dist3D(norm[12], norm[16]);
  features[idx++] = dist3D(norm[16], norm[20]);

  // 6. Palm normal x & z (2)
  const [nx, , nz] = computePalmNormal(norm);
  features[idx++] = nx;
  features[idx++] = nz;

  return features;
}

export interface TemporalFrameInput {
  landmarks: readonly Landmark3D[];
  handedness?: string;
}

/**
 * Extracts a [24, 22] temporal trajectory & posture tensor from a sequence of
 * 24 hand-landmark frames for dynamic ASL gesture recognition.
 */
export function extractDynamicSequenceFeatures(
  frames: readonly TemporalFrameInput[]
): Float32Array {
  const seqLen = DYNAMIC_SEQUENCE_LENGTH;
  const output = new Float32Array(seqLen * DYNAMIC_FEATURE_DIM);
  if (frames.length === 0) return output;

  // Resample / pad to exact seqLen frames
  const canonicalFrames = [];
  for (let t = 0; t < seqLen; t++) {
    const srcIdx = Math.min(
      frames.length - 1,
      Math.floor((t / Math.max(1, seqLen - 1)) * (frames.length - 1))
    );
    const f = frames[srcIdx];
    canonicalFrames.push(canonicalizeHandedness(f.landmarks, f.handedness));
  }

  const palmScales = canonicalFrames.map((lm) => computePalmScale(lm));
  const meanScale =
    palmScales.reduce((acc, v) => acc + v, 0) / Math.max(1, palmScales.length);

  const wrist0 = canonicalFrames[0][0];
  const idx0 = canonicalFrames[0][8];
  const pnk0 = canonicalFrames[0][20];

  const fingerPairs: ReadonlyArray<readonly [number, number]> = [
    [2, 4],
    [5, 8],
    [9, 12],
    [13, 16],
    [17, 20],
  ];

  let prevAvgCurl = 0;

  for (let t = 0; t < seqLen; t++) {
    const lm = canonicalFrames[t];
    const prev = canonicalFrames[Math.max(0, t - 1)];
    const scale = palmScales[t];
    const base = t * DYNAMIC_FEATURE_DIM;
    let c = 0;

    // 1. 5 finger extension ratios (tip-to-wrist / mcp-to-wrist) (5)
    let avgExt = 0;
    for (const [mcp, tip] of fingerPairs) {
      const ratio = dist3D(lm[tip], lm[0]) / Math.max(0.15 * scale, dist3D(lm[mcp], lm[0]));
      output[base + c++] = ratio;
      avgExt += ratio;
    }
    avgExt /= 5;

    // 2. Thumb-index & thumb-middle normalized distances (2)
    output[base + c++] = dist3D(lm[4], lm[8]) / scale;
    output[base + c++] = dist3D(lm[4], lm[12]) / scale;

    // 3. Palm normal (3)
    const [nx, ny, nz] = computePalmNormal(lm);
    output[base + c++] = nx;
    output[base + c++] = ny;
    output[base + c++] = nz;

    // 4. Wrist displacement relative to start (3)
    output[base + c++] = (lm[0].x - wrist0.x) / meanScale;
    output[base + c++] = (lm[0].y - wrist0.y) / meanScale;
    output[base + c++] = (lm[0].z - wrist0.z) / meanScale;

    // 5. Wrist velocity (3)
    const vx = (lm[0].x - prev[0].x) / meanScale;
    const vy = (lm[0].y - prev[0].y) / meanScale;
    const vz = (lm[0].z - prev[0].z) / meanScale;
    output[base + c++] = vx;
    output[base + c++] = vy;
    output[base + c++] = vz;

    // 6. Index tip & pinky tip displacement relative to start (4)
    output[base + c++] = (lm[8].x - idx0.x) / meanScale;
    output[base + c++] = (lm[8].y - idx0.y) / meanScale;
    output[base + c++] = (lm[20].x - pnk0.x) / meanScale;
    output[base + c++] = (lm[20].y - pnk0.y) / meanScale;

    // 7. Wrist speed & finger extension change rate (2)
    output[base + c++] = Math.hypot(vx, vy, vz);
    output[base + c++] = t === 0 ? 0 : avgExt - prevAvgCurl;
    prevAvgCurl = avgExt;
  }

  return output;
}

export interface DualHandTemporalFrame {
  left: readonly Landmark3D[] | null;
  right: readonly Landmark3D[] | null;
}

export interface DualHandRelationship {
  wristDistance: number;
  fingertipProximity: number;
  horizontalSeparation: number;
  verticalOffset: number;
  symmetryScore: number;
  leftPalmOpenness: number;
  rightPalmOpenness: number;
}

export interface DualHandKinematics {
  combinedMotionEnergy: number;
  coordinatedLiftY: number;
  motionCorrelation: number;
  relativeApproachSpeed: number;
}

function computeHandOpenness(landmarks: readonly Landmark3D[]): number {
  const scale = computePalmScale(landmarks);
  const tips = [8, 12, 16, 20];
  let sum = 0;
  for (const tip of tips) {
    sum += dist3D(landmarks[tip], landmarks[0]) / scale;
  }
  return sum / tips.length;
}

/**
 * Preserves the spatial and geometric relationship between the left and right
 * hands (inter-wrist distance, fingertip proximity, alignment, and mirror symmetry).
 */
export function computeDualHandRelationship(
  left: readonly Landmark3D[],
  right: readonly Landmark3D[]
): DualHandRelationship {
  const meanScale = Math.max(
    0.02,
    (computePalmScale(left) + computePalmScale(right)) * 0.5
  );

  const lw = left[0];
  const rw = right[0];
  const wristDistance = dist3D(lw, rw) / meanScale;
  const horizontalSeparation = (rw.x - lw.x) / meanScale;
  const verticalOffset = (rw.y - lw.y) / meanScale;

  // Minimum normalized distance between key landmarks across the two hands
  let minPairDist = Infinity;
  for (const li of [0, 4, 8, 9, 12, 16, 20]) {
    for (const ri of [0, 4, 8, 9, 12, 16, 20]) {
      const d = dist3D(left[li], right[ri]) / meanScale;
      if (d < minPairDist) minPairDist = d;
    }
  }

  // Mirror-symmetry score across canonicalized hand poses
  const canonLeft = canonicalizeHandedness(left, 'Left');
  const canonRight = canonicalizeHandedness(right, 'Right');
  const lScale = computePalmScale(canonLeft);
  const rScale = computePalmScale(canonRight);
  let poseDiff = 0;
  for (let i = 1; i <= 20; i++) {
    const lx = (canonLeft[i].x - canonLeft[0].x) / lScale;
    const ly = (canonLeft[i].y - canonLeft[0].y) / lScale;
    const rx = (canonRight[i].x - canonRight[0].x) / rScale;
    const ry = (canonRight[i].y - canonRight[0].y) / rScale;
    poseDiff += Math.hypot(lx - rx, ly - ry);
  }
  const symmetryScore = Math.max(0, 1 - poseDiff / 20 / 0.85);

  return {
    wristDistance,
    fingertipProximity: minPairDist,
    horizontalSeparation,
    verticalOffset,
    symmetryScore,
    leftPalmOpenness: computeHandOpenness(left),
    rightPalmOpenness: computeHandOpenness(right),
  };
}

/**
 * Computes inter-hand dynamic motion features across a rolling dual-hand window
 * so two-handed dynamic ASL gestures (e.g. HELP, coordinated waves/signs) can be tracked.
 */
export function computeDualHandKinematics(
  frames: readonly DualHandTemporalFrame[]
): DualHandKinematics {
  const bothFrames = frames.filter(
    (f): f is { left: readonly Landmark3D[]; right: readonly Landmark3D[] } =>
      f.left !== null && f.right !== null
  );

  if (bothFrames.length < 4) {
    return {
      combinedMotionEnergy: 0,
      coordinatedLiftY: 0,
      motionCorrelation: 0,
      relativeApproachSpeed: 0,
    };
  }

  const recent = bothFrames.slice(-Math.min(18, bothFrames.length));
  const first = recent[0];
  const last = recent[recent.length - 1];
  const meanScale = Math.max(
    0.02,
    (computePalmScale(last.left) + computePalmScale(last.right)) * 0.5
  );

  const leftLiftY = (last.left[0].y - first.left[0].y) / meanScale;
  const rightLiftY = (last.right[0].y - first.right[0].y) / meanScale;
  const coordinatedLiftY = (leftLiftY + rightLiftY) * 0.5;

  let totalDisp = 0;
  let dotProduct = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  let relDistDeltaSum = 0;

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const curr = recent[i];

    const ldx = (curr.left[0].x - prev.left[0].x) / meanScale;
    const ldy = (curr.left[0].y - prev.left[0].y) / meanScale;
    const rdx = (curr.right[0].x - prev.right[0].x) / meanScale;
    const rdy = (curr.right[0].y - prev.right[0].y) / meanScale;

    const lStep = Math.hypot(ldx, ldy);
    const rStep = Math.hypot(rdx, rdy);
    totalDisp += (lStep + rStep) * 0.5 * meanScale;
    dotProduct += ldx * rdx + ldy * rdy;
    leftEnergy += lStep * lStep;
    rightEnergy += rStep * rStep;

    const dPrev = dist3D(prev.left[0], prev.right[0]) / meanScale;
    const dCurr = dist3D(curr.left[0], curr.right[0]) / meanScale;
    relDistDeltaSum += Math.abs(dCurr - dPrev);
  }

  const denom = Math.sqrt(leftEnergy * rightEnergy);
  const motionCorrelation = denom > 1e-6 ? dotProduct / denom : 0;

  return {
    combinedMotionEnergy: totalDisp / (recent.length - 1),
    coordinatedLiftY,
    motionCorrelation,
    relativeApproachSpeed: relDistDeltaSum / (recent.length - 1),
  };
}
