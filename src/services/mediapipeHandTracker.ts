import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from '@mediapipe/tasks-vision';
import type { Landmark3D } from '../ml/landmarkFeatures';

export interface DetectedHand {
  landmarks: Landmark3D[];
  handedness: 'Left' | 'Right';
  handednessScore: number;
}

export interface DualHandDetectionResult {
  left: DetectedHand | null;
  right: DetectedHand | null;
  hands: DetectedHand[];
  totalLandmarks: number;
}

const LOCAL_WASM_BASE = '/mediapipe/wasm';
const CDN_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const LOCAL_MODEL_URL = '/models/hand_landmarker.task';
const FALLBACK_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const MIN_TASK_BUNDLE_BYTES = 100_000;
const DUPLICATE_HAND_THRESHOLD = 0.045;

/**
 * Validates that a downloaded buffer is a genuine MediaPipe .task ZIP bundle
 * rather than an HTML SPA fallback, Git LFS pointer, truncated download, or raw .tflite.
 */
export function isValidMediaPipeTaskBundle(bytes: Uint8Array): boolean {
  if (bytes.byteLength < MIN_TASK_BUNDLE_BYTES) {
    return false;
  }

  const headText = new TextDecoder('utf-8', { fatal: false })
    .decode(bytes.subarray(0, Math.min(256, bytes.byteLength)))
    .trimStart()
    .toLowerCase();

  if (
    headText.startsWith('<!doctype') ||
    headText.startsWith('<html') ||
    headText.startsWith('<') ||
    headText.startsWith('version https://git-lfs')
  ) {
    return false;
  }

  // Raw TFLite flatbuffers carry "TFL3" at bytes 4..7 without a ZIP container.
  if (
    bytes[4] === 0x54 &&
    bytes[5] === 0x46 &&
    bytes[6] === 0x4c &&
    bytes[7] === 0x33
  ) {
    return false;
  }

  // Official MediaPipe .task bundles begin with PK\x03\x04 (at offset 0 or 2).
  let hasZipLocalHeader = false;
  const headerScanLimit = Math.min(32, bytes.byteLength - 4);
  for (let i = 0; i <= headerScanLimit; i++) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x03 &&
      bytes[i + 3] === 0x04
    ) {
      hasZipLocalHeader = true;
      break;
    }
  }
  if (!hasZipLocalHeader) {
    return false;
  }

  // Verify ZIP End-of-Central-Directory (PK\x05\x06) near the tail to ensure completeness.
  const tailStart = Math.max(0, bytes.byteLength - 65_557);
  for (let i = bytes.byteLength - 4; i >= tailStart; i--) {
    if (
      bytes[i] === 0x50 &&
      bytes[i + 1] === 0x4b &&
      bytes[i + 2] === 0x05 &&
      bytes[i + 3] === 0x06
    ) {
      return true;
    }
  }

  return false;
}

export class MediaPipeHandTracker {
  private landmarker: HandLandmarker | null = null;
  private initPromise: Promise<void> | null = null;
  private disposed = false;
  private lastTimestampMs = -1;

  async init(): Promise<void> {
    if (this.landmarker) return;
    if (this.initPromise) return this.initPromise;

    this.disposed = false;
    this.initPromise = (async () => {
      try {
        const vision = await this.resolveVisionFileset();
        const modelBuffer = await this.loadValidatedModelBuffer();

        if (this.disposed) return;

        let created: HandLandmarker;
        try {
          created = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetBuffer: new Uint8Array(modelBuffer.slice(0)),
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.5,
          });
        } catch {
          // Fallback to CPU delegate if WebGL GPU delegate isn't supported
          created = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetBuffer: new Uint8Array(modelBuffer.slice(0)),
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.5,
          });
        }

        if (this.disposed) {
          created.close();
          return;
        }

        this.landmarker = created;
      } catch (err) {
        this.initPromise = null;
        throw err;
      }
    })();

    return this.initPromise;
  }

  private async resolveVisionFileset() {
    try {
      // Verify local WASM assets are served as JS/WASM rather than an SPA HTML fallback.
      const [jsProbe, wasmProbe] = await Promise.all([
        fetch(`${LOCAL_WASM_BASE}/vision_wasm_internal.js`, { method: 'HEAD' }),
        fetch(`${LOCAL_WASM_BASE}/vision_wasm_internal.wasm`, { method: 'HEAD' }),
      ]);
      const jsType = jsProbe.headers.get('content-type')?.toLowerCase() ?? '';
      const wasmType = wasmProbe.headers.get('content-type')?.toLowerCase() ?? '';
      if (
        !jsProbe.ok ||
        !wasmProbe.ok ||
        jsType.includes('text/html') ||
        wasmType.includes('text/html')
      ) {
        throw new Error(
          `Invalid local WASM asset response (${jsProbe.status}/${wasmProbe.status})`
        );
      }
      return await FilesetResolver.forVisionTasks(LOCAL_WASM_BASE);
    } catch {
      return await FilesetResolver.forVisionTasks(CDN_WASM_BASE);
    }
  }

  private async fetchAndValidateTaskBundle(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} while fetching ${url}`);
    }

    const contentType = res.headers.get('content-type')?.toLowerCase() ?? '';
    if (
      contentType.includes('text/html') ||
      contentType.includes('text/plain') ||
      contentType.includes('application/json')
    ) {
      throw new Error(
        `Unexpected MIME type "${contentType}" for ${url} (expected binary .task bundle)`
      );
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    if (!isValidMediaPipeTaskBundle(bytes)) {
      throw new Error(
        `Invalid or corrupted MediaPipe .task bundle at ${url} (${bytes.byteLength} bytes)`
      );
    }

    return arrayBuffer;
  }

  private async loadValidatedModelBuffer(): Promise<ArrayBuffer> {
    try {
      return await this.fetchAndValidateTaskBundle(LOCAL_MODEL_URL);
    } catch (localErr) {
      console.warn(
        'Local hand_landmarker.task unavailable or invalid, falling back to official MediaPipe CDN:',
        localErr
      );
    }

    try {
      return await this.fetchAndValidateTaskBundle(FALLBACK_MODEL_URL);
    } catch (remoteErr) {
      const reason =
        remoteErr instanceof Error ? remoteErr.message : String(remoteErr);
      throw new Error(
        `Unable to load a valid MediaPipe hand_landmarker.task model bundle (${reason}).`
      );
    }
  }

  isReady(): boolean {
    return this.landmarker !== null && !this.disposed;
  }

  private areHandsOverlapping(a: Landmark3D[], b: Landmark3D[]): boolean {
    const wristDist = Math.hypot(a[0].x - b[0].x, a[0].y - b[0].y);
    if (wristDist > DUPLICATE_HAND_THRESHOLD * 1.5) return false;

    let sumDist = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      sumDist += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
    }
    return len > 0 && sumDist / len < DUPLICATE_HAND_THRESHOLD;
  }

  detectFrame(video: HTMLVideoElement, timestampMs: number): DualHandDetectionResult {
    const empty: DualHandDetectionResult = {
      left: null,
      right: null,
      hands: [],
      totalLandmarks: 0,
    };

    if (
      !this.landmarker ||
      this.disposed ||
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      return empty;
    }

    const safeTimestamp =
      timestampMs > this.lastTimestampMs ? timestampMs : this.lastTimestampMs + 1;
    this.lastTimestampMs = safeTimestamp;

    let result: HandLandmarkerResult;
    try {
      result = this.landmarker.detectForVideo(video, safeTimestamp);
    } catch (err) {
      console.warn('HandLandmarker.detectForVideo frame error:', err);
      return empty;
    }

    if (!result.landmarks || result.landmarks.length === 0) {
      return empty;
    }

    // Build raw detections and remove near-identical duplicate hand proposals
    const candidates: DetectedHand[] = result.landmarks.map((lm, idx) => {
      const handednessEntry = result.handednesses?.[idx]?.[0];
      const categoryName = handednessEntry?.categoryName === 'Left' ? 'Left' : 'Right';
      return {
        landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        handedness: categoryName,
        handednessScore: handednessEntry?.score ?? 1,
      };
    });

    candidates.sort((a, b) => b.handednessScore - a.handednessScore);
    const deduped: DetectedHand[] = [];
    for (const cand of candidates) {
      const isDuplicate = deduped.some((existing) =>
        this.areHandsOverlapping(existing.landmarks, cand.landmarks)
      );
      if (!isDuplicate) {
        deduped.push(cand);
      }
      if (deduped.length >= 2) break;
    }

    let left: DetectedHand | null = null;
    let right: DetectedHand | null = null;

    if (deduped.length === 1) {
      const single = deduped[0];
      if (single.handedness === 'Left') {
        left = single;
      } else {
        right = single;
      }
    } else if (deduped.length === 2) {
      const [first, second] = deduped;
      if (first.handedness !== second.handedness) {
        left = first.handedness === 'Left' ? first : second;
        right = first.handedness === 'Right' ? first : second;
      } else {
        // Disambiguate when MediaPipe assigns both hands the same handedness
        if (first.handedness === 'Left') {
          left = first;
          right = { ...second, handedness: 'Right' };
        } else {
          right = first;
          left = { ...second, handedness: 'Left' };
        }
      }
    }

    const hands: DetectedHand[] = [];
    if (left) hands.push(left);
    if (right) hands.push(right);

    return {
      left,
      right,
      hands,
      totalLandmarks: hands.reduce((acc, h) => acc + h.landmarks.length, 0),
    };
  }

  close(): void {
    this.disposed = true;
    this.landmarker?.close();
    this.landmarker = null;
    this.initPromise = null;
    this.lastTimestampMs = -1;
  }
}
