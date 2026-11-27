import * as tf from '@tensorflow/tfjs';
import {
  DYNAMIC_LABELS,
  STATIC_LABELS,
  type SignGestureType,
} from '../data/aslSigns';
import {
  DYNAMIC_FEATURE_DIM,
  DYNAMIC_SEQUENCE_LENGTH,
  STATIC_FEATURE_DIM,
  computeDualHandKinematics,
  computeDualHandRelationship,
  extractDynamicSequenceFeatures,
  extractStaticFeatures,
  type DualHandKinematics,
  type DualHandRelationship,
  type DualHandTemporalFrame,
  type Landmark3D,
  type TemporalFrameInput,
} from './landmarkFeatures';

export interface CandidatePrediction {
  label: string;
  confidence: number;
  type: SignGestureType;
}

export interface HandPredictionSummary {
  handedness: 'Left' | 'Right';
  label: string | null;
  confidence: number;
  gestureType: SignGestureType | 'none';
  motionEnergy: number;
}

export interface DualHandMetrics {
  wristDistance: number;
  fingertipProximity: number;
  symmetryScore: number;
  motionCorrelation: number;
  coordinatedLiftY: number;
  twoHandGestureDetected: boolean;
}

export type TrackingMode = 'none' | 'single-left' | 'single-right' | 'dual-hand';

export interface DualHandFrameInput {
  left: { landmarks: readonly Landmark3D[]; handedness?: string } | null;
  right: { landmarks: readonly Landmark3D[]; handedness?: string } | null;
}

export interface RecognitionOutput {
  label: string | null;
  confidence: number;
  gestureType: SignGestureType | 'none';
  topCandidates: CandidatePrediction[];
  motionEnergy: number;
  modelReady: boolean;
  trackingMode: TrackingMode;
  activeHands: Array<'Left' | 'Right'>;
  leftSign: HandPredictionSummary | null;
  rightSign: HandPredictionSummary | null;
  dualHandMetrics: DualHandMetrics | null;
}

export interface ModelMetadata {
  name: string;
  architecture: string;
  labels: string[];
  trainAccuracy: number;
  valAccuracy: number;
  trainingSamples: number;
}

interface SingleHandInference {
  handedness: 'Left' | 'Right';
  motionEnergy: number;
  dynamicBestLabel: string;
  dynamicBestConf: number;
  dynamicProbs: Float32Array | null;
  dynamicCandidates: CandidatePrediction[];
  staticBest: CandidatePrediction | undefined;
  staticCandidates: CandidatePrediction[];
  summary: HandPredictionSummary;
}

interface HandTrackState {
  frameBuffer: TemporalFrameInput[];
  smoothedStaticProbs: Float32Array | null;
  missedFrames: number;
}

function createEmptyHandState(): HandTrackState {
  return {
    frameBuffer: [],
    smoothedStaticProbs: null,
    missedFrames: 0,
  };
}

export class AslRecognizer {
  private staticModel: tf.LayersModel | null = null;
  private dynamicModel: tf.LayersModel | null = null;
  public staticMeta: ModelMetadata | null = null;
  public dynamicMeta: ModelMetadata | null = null;

  private leftState: HandTrackState = createEmptyHandState();
  private rightState: HandTrackState = createEmptyHandState();
  private dualFrameBuffer: DualHandTemporalFrame[] = [];
  private ready = false;
  private loadingPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.ready) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = (async () => {
      try {
        await tf.ready();
        const [staticModel, dynamicModel, staticMetaRes, dynamicMetaRes] =
          await Promise.all([
            tf.loadLayersModel('/models/static-asl/model.json'),
            tf.loadLayersModel('/models/dynamic-asl/model.json'),
            fetch('/models/static-asl/metadata.json'),
            fetch('/models/dynamic-asl/metadata.json'),
          ]);

        this.staticModel = staticModel;
        this.dynamicModel = dynamicModel;
        if (staticMetaRes.ok) {
          this.staticMeta = (await staticMetaRes.json()) as ModelMetadata;
        }
        if (dynamicMetaRes.ok) {
          this.dynamicMeta = (await dynamicMetaRes.json()) as ModelMetadata;
        }

        // Warm up both TensorFlow.js graphs so first camera frame is instantaneous
        tf.tidy(() => {
          const dummyStatic = tf.zeros([1, STATIC_FEATURE_DIM]);
          staticModel.predict(dummyStatic);
          const dummyDyn = tf.zeros([1, DYNAMIC_SEQUENCE_LENGTH, DYNAMIC_FEATURE_DIM]);
          dynamicModel.predict(dummyDyn);
        });

        this.ready = true;
      } catch (err) {
        this.loadingPromise = null;
        throw err;
      }
    })();

    return this.loadingPromise;
  }

  isReady(): boolean {
    return this.ready;
  }

  resetBuffers(): void {
    this.leftState = createEmptyHandState();
    this.rightState = createEmptyHandState();
    this.dualFrameBuffer = [];
  }

  private computeMotionEnergy(buffer: readonly TemporalFrameInput[]): number {
    if (buffer.length < 6) return 0;
    const recent = buffer.slice(-Math.min(18, buffer.length));
    let totalDisp = 0;
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1].landmarks;
      const b = recent[i].landmarks;
      // Combine wrist movement + index tip + pinky tip movement
      const dw = Math.hypot(b[0].x - a[0].x, b[0].y - a[0].y, b[0].z - a[0].z);
      const di = Math.hypot(b[8].x - a[8].x, b[8].y - a[8].y);
      const dp = Math.hypot(b[20].x - a[20].x, b[20].y - a[20].y);
      totalDisp += dw * 1.4 + (di + dp) * 0.45;
    }
    return totalDisp / (recent.length - 1);
  }

  private inferSingleHand(
    state: HandTrackState,
    landmarks: readonly Landmark3D[],
    handedness: 'Left' | 'Right'
  ): SingleHandInference {
    state.missedFrames = 0;
    state.frameBuffer.push({
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness,
    });
    if (state.frameBuffer.length > DYNAMIC_SEQUENCE_LENGTH) {
      state.frameBuffer.shift();
    }

    const motionEnergy = this.computeMotionEnergy(state.frameBuffer);

    let dynamicBestLabel: string = 'IDLE';
    let dynamicBestConf = 0;
    let dynProbs: Float32Array | null = null;
    const dynamicCandidates: CandidatePrediction[] = [];

    if (state.frameBuffer.length >= 12) {
      const seqFeatures = extractDynamicSequenceFeatures(state.frameBuffer);
      dynProbs = tf.tidy(() => {
        const input = tf.tensor3d(seqFeatures, [
          1,
          DYNAMIC_SEQUENCE_LENGTH,
          DYNAMIC_FEATURE_DIM,
        ]);
        const out = this.dynamicModel!.predict(input) as tf.Tensor;
        return new Float32Array(out.dataSync() as Float32Array);
      });

      const indexedDyn = Array.from(dynProbs).map((prob, idx) => ({
        label: DYNAMIC_LABELS[idx] ?? 'IDLE',
        confidence: prob,
        type: 'dynamic' as const,
      }));
      indexedDyn.sort((a, b) => b.confidence - a.confidence);

      dynamicBestLabel = indexedDyn[0]?.label ?? 'IDLE';
      dynamicBestConf = indexedDyn[0]?.confidence ?? 0;

      for (const item of indexedDyn) {
        if (item.label !== 'IDLE' && dynamicCandidates.length < 3) {
          dynamicCandidates.push(item);
        }
      }
    }

    const staticFeatures = extractStaticFeatures(landmarks, handedness);
    const rawStaticProbs = tf.tidy(() => {
      const input = tf.tensor2d(staticFeatures, [1, STATIC_FEATURE_DIM]);
      const out = this.staticModel!.predict(input) as tf.Tensor;
      return out.dataSync() as Float32Array;
    });

    if (!state.smoothedStaticProbs) {
      state.smoothedStaticProbs = new Float32Array(rawStaticProbs);
    } else {
      const alpha = motionEnergy > 0.022 ? 0.55 : 0.35;
      for (let i = 0; i < rawStaticProbs.length; i++) {
        state.smoothedStaticProbs[i] =
          alpha * rawStaticProbs[i] + (1 - alpha) * state.smoothedStaticProbs[i];
      }
    }

    const indexedStatic = Array.from(state.smoothedStaticProbs).map((prob, idx) => ({
      label: STATIC_LABELS[idx] ?? 'A',
      confidence: prob,
      type: 'static' as const,
    }));
    indexedStatic.sort((a, b) => b.confidence - a.confidence);
    const staticBest = indexedStatic[0];

    let summaryLabel: string | null = null;
    let summaryConf = staticBest?.confidence ?? 0;
    let summaryType: SignGestureType | 'none' = 'none';

    if (
      dynamicBestLabel !== 'IDLE' &&
      dynamicBestConf >= 0.62 &&
      motionEnergy >= 0.012
    ) {
      summaryLabel = dynamicBestLabel;
      summaryConf = dynamicBestConf;
      summaryType = 'dynamic';
    } else if (staticBest && staticBest.confidence >= 0.38) {
      summaryLabel = staticBest.label;
      summaryConf = staticBest.confidence;
      summaryType = 'static';
    }

    return {
      handedness,
      motionEnergy,
      dynamicBestLabel,
      dynamicBestConf,
      dynamicProbs: dynProbs,
      dynamicCandidates,
      staticBest,
      staticCandidates: indexedStatic.slice(0, 3),
      summary: {
        handedness,
        label: summaryLabel,
        confidence: summaryConf,
        gestureType: summaryType,
        motionEnergy,
      },
    };
  }

  private decayMissingHand(state: HandTrackState): void {
    state.missedFrames++;
    if (state.missedFrames > 4) {
      state.frameBuffer = [];
      state.smoothedStaticProbs = null;
    }
  }

  private normalizeDualInput(
    input: DualHandFrameInput | readonly Landmark3D[],
    handedness?: string
  ): DualHandFrameInput {
    if (Array.isArray(input)) {
      const isLeft = handedness?.toLowerCase() === 'left';
      return isLeft
        ? { left: { landmarks: input, handedness: 'Left' }, right: null }
        : { left: null, right: { landmarks: input, handedness: 'Right' } };
    }
    return input as DualHandFrameInput;
  }

  private evaluateTwoHandDynamicGesture(
    leftInf: SingleHandInference,
    rightInf: SingleHandInference,
    rel: DualHandRelationship,
    kin: DualHandKinematics
  ): {
    label: string;
    confidence: number;
    candidates: CandidatePrediction[];
  } | null {
    // 1. Two-handed ASL HELP: flat supporting palm + fist hand lifting upward together
    const oneOpenOneClosed =
      (rel.leftPalmOpenness >= 1.52 && rel.rightPalmOpenness <= 1.38) ||
      (rel.rightPalmOpenness >= 1.52 && rel.leftPalmOpenness <= 1.38);
    const handsTogether = rel.wristDistance < 2.9 && rel.fingertipProximity < 1.65;
    const liftingUpward = kin.coordinatedLiftY < -0.14 && kin.combinedMotionEnergy >= 0.008;

    if (oneOpenOneClosed && handsTogether && liftingUpward) {
      const helpIdx = DYNAMIC_LABELS.indexOf('HELP');
      const leftHelp = helpIdx >= 0 && leftInf.dynamicProbs ? leftInf.dynamicProbs[helpIdx] : 0;
      const rightHelp = helpIdx >= 0 && rightInf.dynamicProbs ? rightInf.dynamicProbs[helpIdx] : 0;
      const helpConf = Math.min(
        0.96,
        Math.max(0.72, 0.52 + Math.max(leftHelp, rightHelp) * 0.45 + Math.min(0.2, -kin.coordinatedLiftY * 0.35))
      );
      return {
        label: 'HELP',
        confidence: helpConf,
        candidates: [
          { label: 'HELP', confidence: helpConf, type: 'dynamic' },
          ...leftInf.dynamicCandidates.filter((c) => c.label !== 'HELP').slice(0, 2),
        ],
      };
    }

    // 2. Fuse temporal dynamic probabilities across both hands when both sequences exist
    if (leftInf.dynamicProbs && rightInf.dynamicProbs) {
      const fused: CandidatePrediction[] = [];
      for (let i = 0; i < DYNAMIC_LABELS.length; i++) {
        const label = DYNAMIC_LABELS[i];
        if (label === 'IDLE') continue;
        const pL = leftInf.dynamicProbs[i] ?? 0;
        const pR = rightInf.dynamicProbs[i] ?? 0;
        const maxP = Math.max(pL, pR);
        const minP = Math.min(pL, pR);
        // Reward bilateral agreement while allowing one dominant hand + supporting hand
        const fusedScore =
          minP >= 0.35
            ? Math.min(0.98, 0.58 * maxP + 0.42 * minP + 0.08)
            : maxP;
        fused.push({ label, confidence: fusedScore, type: 'dynamic' });
      }
      fused.sort((a, b) => b.confidence - a.confidence);
      const top = fused[0];
      const maxEnergy = Math.max(
        leftInf.motionEnergy,
        rightInf.motionEnergy,
        kin.combinedMotionEnergy
      );
      if (top && top.confidence >= 0.62 && maxEnergy >= 0.012) {
        return {
          label: top.label,
          confidence: top.confidence,
          candidates: fused.slice(0, 3),
        };
      }
    }

    return null;
  }

  predict(
    input: DualHandFrameInput | readonly Landmark3D[],
    handedness?: string
  ): RecognitionOutput {
    if (!this.ready || !this.staticModel || !this.dynamicModel) {
      return {
        label: null,
        confidence: 0,
        gestureType: 'none',
        topCandidates: [],
        motionEnergy: 0,
        modelReady: false,
        trackingMode: 'none',
        activeHands: [],
        leftSign: null,
        rightSign: null,
        dualHandMetrics: null,
      };
    }

    const dualInput = this.normalizeDualInput(input, handedness);
    const hasLeft = dualInput.left !== null;
    const hasRight = dualInput.right !== null;

    this.dualFrameBuffer.push({
      left: dualInput.left
        ? dualInput.left.landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        : null,
      right: dualInput.right
        ? dualInput.right.landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z }))
        : null,
    });
    if (this.dualFrameBuffer.length > DYNAMIC_SEQUENCE_LENGTH) {
      this.dualFrameBuffer.shift();
    }

    const leftInf = dualInput.left
      ? this.inferSingleHand(this.leftState, dualInput.left.landmarks, 'Left')
      : (this.decayMissingHand(this.leftState), null);

    const rightInf = dualInput.right
      ? this.inferSingleHand(this.rightState, dualInput.right.landmarks, 'Right')
      : (this.decayMissingHand(this.rightState), null);

    const activeHands: Array<'Left' | 'Right'> = [];
    if (leftInf) activeHands.push('Left');
    if (rightInf) activeHands.push('Right');

    const trackingMode: TrackingMode =
      hasLeft && hasRight
        ? 'dual-hand'
        : hasLeft
        ? 'single-left'
        : hasRight
        ? 'single-right'
        : 'none';

    // Case 1: No hands visible
    if (!leftInf && !rightInf) {
      return {
        label: null,
        confidence: 0,
        gestureType: 'none',
        topCandidates: [],
        motionEnergy: 0,
        modelReady: true,
        trackingMode,
        activeHands,
        leftSign: null,
        rightSign: null,
        dualHandMetrics: null,
      };
    }

    // Case 2: Single hand visible (Left only OR Right only)
    if (!leftInf || !rightInf) {
      const single = (leftInf ?? rightInf)!;
      if (
        single.dynamicBestLabel !== 'IDLE' &&
        single.dynamicBestConf >= 0.62 &&
        single.motionEnergy >= 0.012
      ) {
        return {
          label: single.dynamicBestLabel,
          confidence: single.dynamicBestConf,
          gestureType: 'dynamic',
          topCandidates: single.dynamicCandidates.slice(0, 3),
          motionEnergy: single.motionEnergy,
          modelReady: true,
          trackingMode,
          activeHands,
          leftSign: leftInf?.summary ?? null,
          rightSign: rightInf?.summary ?? null,
          dualHandMetrics: null,
        };
      }

      if (single.staticBest && single.staticBest.confidence >= 0.38) {
        return {
          label: single.staticBest.label,
          confidence: single.staticBest.confidence,
          gestureType: 'static',
          topCandidates: single.staticCandidates,
          motionEnergy: single.motionEnergy,
          modelReady: true,
          trackingMode,
          activeHands,
          leftSign: leftInf?.summary ?? null,
          rightSign: rightInf?.summary ?? null,
          dualHandMetrics: null,
        };
      }

      return {
        label: null,
        confidence: single.staticBest?.confidence ?? 0,
        gestureType: 'none',
        topCandidates: single.staticCandidates,
        motionEnergy: single.motionEnergy,
        modelReady: true,
        trackingMode,
        activeHands,
        leftSign: leftInf?.summary ?? null,
        rightSign: rightInf?.summary ?? null,
        dualHandMetrics: null,
      };
    }

    // Case 3: Both hands visible simultaneously — preserve inter-hand relationship & fuse predictions
    const rel = computeDualHandRelationship(
      dualInput.left!.landmarks,
      dualInput.right!.landmarks
    );
    const kin = computeDualHandKinematics(this.dualFrameBuffer);
    const combinedEnergy = Math.max(
      leftInf.motionEnergy,
      rightInf.motionEnergy,
      kin.combinedMotionEnergy
    );

    const dualDynamic = this.evaluateTwoHandDynamicGesture(leftInf, rightInf, rel, kin);
    if (dualDynamic) {
      return {
        label: dualDynamic.label,
        confidence: dualDynamic.confidence,
        gestureType: 'dynamic',
        topCandidates: dualDynamic.candidates,
        motionEnergy: combinedEnergy,
        modelReady: true,
        trackingMode,
        activeHands,
        leftSign: leftInf.summary,
        rightSign: rightInf.summary,
        dualHandMetrics: {
          wristDistance: rel.wristDistance,
          fingertipProximity: rel.fingertipProximity,
          symmetryScore: rel.symmetryScore,
          motionCorrelation: kin.motionCorrelation,
          coordinatedLiftY: kin.coordinatedLiftY,
          twoHandGestureDetected: true,
        },
      };
    }

    // Static dual-hand arbitration: fuse matching hands or prioritize the clearest active signing hand
    const leftBest = leftInf.staticBest;
    const rightBest = rightInf.staticBest;
    const dualMetrics: DualHandMetrics = {
      wristDistance: rel.wristDistance,
      fingertipProximity: rel.fingertipProximity,
      symmetryScore: rel.symmetryScore,
      motionCorrelation: kin.motionCorrelation,
      coordinatedLiftY: kin.coordinatedLiftY,
      twoHandGestureDetected: false,
    };

    let chosenStatic: CandidatePrediction | undefined;
    let mergedCandidates: CandidatePrediction[] = [];

    if (leftBest && rightBest && leftBest.label === rightBest.label) {
      const boosted = Math.min(
        0.99,
        (leftBest.confidence + rightBest.confidence) * 0.5 + 0.04
      );
      chosenStatic = { label: leftBest.label, confidence: boosted, type: 'static' };
      mergedCandidates = [
        chosenStatic,
        ...leftInf.staticCandidates.filter((c) => c.label !== chosenStatic!.label),
      ].slice(0, 3);
    } else {
      const leftConf = leftBest?.confidence ?? 0;
      const rightConf = rightBest?.confidence ?? 0;
      const primary = rightConf >= leftConf ? rightInf : leftInf;
      chosenStatic = primary.staticBest;
      mergedCandidates = primary.staticCandidates;
    }

    if (chosenStatic && chosenStatic.confidence >= 0.38) {
      return {
        label: chosenStatic.label,
        confidence: chosenStatic.confidence,
        gestureType: 'static',
        topCandidates: mergedCandidates,
        motionEnergy: combinedEnergy,
        modelReady: true,
        trackingMode,
        activeHands,
        leftSign: leftInf.summary,
        rightSign: rightInf.summary,
        dualHandMetrics: dualMetrics,
      };
    }

    return {
      label: null,
      confidence: chosenStatic?.confidence ?? 0,
      gestureType: 'none',
      topCandidates: mergedCandidates,
      motionEnergy: combinedEnergy,
      modelReady: true,
      trackingMode,
      activeHands,
      leftSign: leftInf.summary,
      rightSign: rightInf.summary,
      dualHandMetrics: dualMetrics,
    };
  }
}
