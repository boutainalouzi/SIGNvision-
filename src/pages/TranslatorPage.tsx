import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Copy,
  Delete,
  FlipHorizontal2,
  Hand,
  History,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Space,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
} from 'lucide-react';
import {
  ASL_SIGNS,
  SIGN_MAP,
  type DynamicLabel,
  type StaticLabel,
} from '../data/aslSigns';
import {
  AslRecognizer,
  type DualHandFrameInput,
  type RecognitionOutput,
} from '../ml/aslRecognizer';
import {
  generateDynamicSequence,
  generateHandLandmarks,
  getStaticPoseParams,
} from '../ml/handKinematics';
import { HAND_CONNECTIONS, type Landmark3D } from '../ml/landmarkFeatures';
import {
  MediaPipeHandTracker,
  type DetectedHand,
  type DualHandDetectionResult,
} from '../services/mediapipeHandTracker';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis';

interface HistoryEntry {
  id: string;
  text: string;
  timestamp: string;
  avgConfidence: number;
}

const STATIC_DWELL_MS = 820;
const DYNAMIC_COOLDOWN_MS = 1700;
const STATIC_REPEAT_COOLDOWN_MS = 1400;

const INITIAL_RECOGNITION: RecognitionOutput = {
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

interface HandPalette {
  bone: string;
  tip: string;
  wrist: string;
  trailRgb: string;
  badgeBg: string;
  badgeBorder: string;
  labelText: 'LEFT HAND' | 'RIGHT HAND';
}

const LEFT_PALETTE: HandPalette = {
  bone: '#FF2D8D',
  tip: '#FF69B4',
  wrist: '#FFFFFF',
  trailRgb: '255, 45, 141',
  badgeBg: 'rgba(13, 13, 18, 0.88)',
  badgeBorder: '#FF2D8D',
  labelText: 'LEFT HAND',
};

const RIGHT_PALETTE: HandPalette = {
  bone: '#38BDF8',
  tip: '#67E8F9',
  wrist: '#FFFFFF',
  trailRgb: '56, 189, 248',
  badgeBg: 'rgba(13, 13, 18, 0.88)',
  badgeBorder: '#38BDF8',
  labelText: 'RIGHT HAND',
};

export const TranslatorPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const practiceParam = searchParams.get('practice');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const handTrackerRef = useRef<MediaPipeHandTracker | null>(null);
  const recognizerRef = useRef<AslRecognizer | null>(null);
  const leftTrailRef = useRef<Array<{ x: number; y: number }>>([]);
  const rightTrailRef = useRef<Array<{ x: number; y: number }>>([]);

  // Commit / debounce tracking refs
  const holdStateRef = useRef<{
    label: string | null;
    startTime: number;
    lastCommittedLabel: string | null;
    lastCommitTime: number;
  }>({
    label: null,
    startTime: 0,
    lastCommittedLabel: null,
    lastCommitTime: 0,
  });

  // UI & Camera states
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelRetryNonce, setModelRetryNonce] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [mirrored, setMirrored] = useState(true);
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;

  // Dual-hand tracking state
  const [leftHandActive, setLeftHandActive] = useState(false);
  const [rightHandActive, setRightHandActive] = useState(false);
  const [landmarkCount, setLandmarkCount] = useState(0);

  // Simulator (No-Webcam / Practice Mode)
  const [simulatorActive, setSimulatorActive] = useState(false);
  const [simDualHand, setSimDualHand] = useState(true);
  const [simSign, setSimSign] = useState<string>(() => {
    if (practiceParam && SIGN_MAP.has(practiceParam)) return practiceParam;
    return 'HELLO';
  });
  const simFrameRef = useRef(0);

  // Recognition & Sentence states
  const [recognition, setRecognition] = useState<RecognitionOutput>(INITIAL_RECOGNITION);
  const [holdProgress, setHoldProgress] = useState(0);
  const [recognizedLetters, setRecognizedLetters] = useState<string[]>([]);
  const [recognizedWords, setRecognizedWords] = useState<string[]>([]);
  const [sentence, setSentence] = useState('');
  const [confidenceHistory, setConfidenceHistory] = useState<number[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSupportedModal, setShowSupportedModal] = useState(false);

  const {
    isSupported: ttsSupported,
    isMuted,
    isSpeaking,
    lastSpokenText,
    rate,
    setRate,
    speak,
    replay,
    toggleMute,
  } = useSpeechSynthesis();

  const autoSpeakRef = useRef(autoSpeak);
  autoSpeakRef.current = autoSpeak;
  const speakRef = useRef(speak);
  speakRef.current = speak;

  // Initialize TensorFlow.js models & MediaPipe HandLandmarker (numHands: 2)
  useEffect(() => {
    let cancelled = false;
    const tracker = new MediaPipeHandTracker();
    const recognizer = new AslRecognizer();
    handTrackerRef.current = tracker;
    recognizerRef.current = recognizer;

    (async () => {
      try {
        setModelsLoading(true);
        setModelsError(null);
        await Promise.all([recognizer.init(), tracker.init()]);
        if (!cancelled) {
          setModelsLoading(false);
          setRecognition((prev) => ({ ...prev, modelReady: true }));
        }
      } catch (err) {
        if (!cancelled) {
          setModelsLoading(false);
          setModelsError(
            err instanceof Error
              ? err.message
              : 'Failed to initialize ASL TensorFlow.js or MediaPipe models.'
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      tracker.close();
    };
  }, [modelRetryNonce]);

  // Enumerate cameras on mount
  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoInputs);
      if (videoInputs.length > 0 && !selectedCameraId) {
        setSelectedCameraId(videoInputs[0].deviceId);
      }
    } catch {
      // Ignore enumerate failure before permission
    }
  }, [selectedCameraId]);

  useEffect(() => {
    refreshCameras();
  }, [refreshCameras]);

  // Append recognized token cleanly into sentence, letters, and words
  const commitToken = useCallback((token: string, confidence: number) => {
    const isSingleLetter = token.length === 1 && /^[A-Z]$/.test(token);

    if (isSingleLetter) {
      setRecognizedLetters((prev) => [...prev.slice(-19), token]);
    } else {
      setRecognizedWords((prev) => [...prev.slice(-11), token]);
    }

    setConfidenceHistory((prev) => [...prev.slice(-24), confidence]);

    setSentence((prev) => {
      if (isSingleLetter) {
        return prev + token;
      }
      const needsSpace = prev.length > 0 && !prev.endsWith(' ');
      return (needsSpace ? prev + ' ' : prev) + token + ' ';
    });

    if (autoSpeakRef.current) {
      speakRef.current(token);
    }
  }, []);

  const drawSingleHandSkeleton = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      hand: DetectedHand,
      palette: HandPalette,
      trail: Array<{ x: number; y: number }>,
      gestureType: 'static' | 'dynamic' | 'none',
      width: number,
      height: number,
      unflipLabels: boolean
    ) => {
      const landmarks = hand.landmarks;
      if (landmarks.length === 0) return;

      // Update per-hand wrist motion trail
      const wrist = landmarks[0];
      trail.push({ x: wrist.x * width, y: wrist.y * height });
      if (trail.length > 22) {
        trail.shift();
      }

      if (trail.length > 2) {
        ctx.save();
        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1];
          const p1 = trail[i];
          const alpha =
            (i / trail.length) * (gestureType === 'dynamic' ? 0.85 : 0.45);
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.strokeStyle = `rgba(${palette.trailRgb}, ${alpha})`;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }

      // Draw skeleton connections with subtle glow
      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = palette.bone;
      ctx.shadowColor = palette.bone;
      ctx.shadowBlur = 8;
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = landmarks[a];
        const pb = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(pa.x * width, pa.y * height);
        ctx.lineTo(pb.x * width, pb.y * height);
        ctx.stroke();
      }
      ctx.restore();

      // Draw all 21 landmarks
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;

      for (let i = 0; i < landmarks.length; i++) {
        const pt = landmarks[i];
        const px = pt.x * width;
        const py = pt.y * height;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;

        const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
        const isWrist = i === 0;
        ctx.beginPath();
        ctx.arc(px, py, isTip ? 6 : isWrist ? 6.5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? palette.tip : isWrist ? palette.wrist : '#FFFFFF';
        ctx.fill();
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = '#030304';
        ctx.stroke();
      }

      // Draw crisp LEFT HAND / RIGHT HAND pill label above the hand
      const cx = Math.max(64, Math.min(width - 64, (minX + maxX) * 0.5));
      const cy = Math.max(24, minY - 18);

      ctx.save();
      ctx.translate(cx, cy);
      if (unflipLabels) {
        ctx.scale(-1, 1);
      }
      ctx.font = '700 11px "JetBrains Mono", ui-monospace, monospace';
      const labelWidth = ctx.measureText(palette.labelText).width + 18;
      const boxH = 22;

      ctx.fillStyle = palette.badgeBg;
      ctx.strokeStyle = palette.badgeBorder;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-labelWidth / 2, -boxH / 2, labelWidth, boxH, 999);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(palette.labelText, 0, 0.5);
      ctx.restore();
    },
    []
  );

  const drawDualHandOverlay = useCallback(
    (
      detection: DualHandDetectionResult | null,
      gestureType: 'static' | 'dynamic' | 'none',
      width: number,
      height: number,
      unflipLabels: boolean
    ) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      if (!detection || (detection.left === null && detection.right === null)) {
        leftTrailRef.current = [];
        rightTrailRef.current = [];
        return;
      }

      // Draw connecting inter-hand line when both hands are visible
      if (detection.left && detection.right) {
        const lw = detection.left.landmarks[0];
        const rw = detection.right.landmarks[0];
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(255, 105, 180, 0.45)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lw.x * width, lw.y * height);
        ctx.lineTo(rw.x * width, rw.y * height);
        ctx.stroke();
        ctx.restore();
      }

      if (detection.left) {
        drawSingleHandSkeleton(
          ctx,
          detection.left,
          LEFT_PALETTE,
          leftTrailRef.current,
          gestureType,
          width,
          height,
          unflipLabels
        );
      } else {
        leftTrailRef.current = [];
      }

      if (detection.right) {
        drawSingleHandSkeleton(
          ctx,
          detection.right,
          RIGHT_PALETTE,
          rightTrailRef.current,
          gestureType,
          width,
          height,
          unflipLabels
        );
      } else {
        rightTrailRef.current = [];
      }
    },
    [drawSingleHandSkeleton]
  );

  const processDualHandFrame = useCallback(
    (detection: DualHandDetectionResult | null): 'static' | 'dynamic' | 'none' => {
      const recognizer = recognizerRef.current;
      const hasLeft = Boolean(detection?.left);
      const hasRight = Boolean(detection?.right);

      setLeftHandActive(hasLeft);
      setRightHandActive(hasRight);
      setLandmarkCount(detection?.totalLandmarks ?? 0);

      if (!detection || (!hasLeft && !hasRight) || !recognizer || !recognizer.isReady()) {
        setHoldProgress(0);
        holdStateRef.current.label = null;
        if (recognizer?.isReady() && detection) {
          const emptyOut = recognizer.predict({ left: null, right: null });
          setRecognition(emptyOut);
        }
        return 'none';
      }

      const frameInput: DualHandFrameInput = {
        left: detection.left,
        right: detection.right,
      };
      const pred = recognizer.predict(frameInput);
      setRecognition(pred);

      const now = performance.now();
      const hold = holdStateRef.current;

      if (!pred.label) {
        hold.label = null;
        setHoldProgress(0);
        return pred.gestureType;
      }

      if (pred.gestureType === 'dynamic' && pred.confidence >= 0.65) {
        const canCommit =
          hold.lastCommittedLabel !== pred.label ||
          now - hold.lastCommitTime > DYNAMIC_COOLDOWN_MS;
        if (canCommit) {
          commitToken(pred.label, pred.confidence);
          hold.lastCommittedLabel = pred.label;
          hold.lastCommitTime = now;
        }
        hold.label = null;
        setHoldProgress(1);
        return pred.gestureType;
      }

      if (pred.gestureType === 'static' && pred.confidence >= 0.68) {
        if (hold.label !== pred.label) {
          hold.label = pred.label;
          hold.startTime = now;
          setHoldProgress(0);
        } else {
          const elapsed = now - hold.startTime;
          const pct = Math.min(1, elapsed / STATIC_DWELL_MS);
          setHoldProgress(pct);

          const cooldownOk =
            hold.lastCommittedLabel !== pred.label ||
            now - hold.lastCommitTime > STATIC_REPEAT_COOLDOWN_MS;

          if (pct >= 1 && cooldownOk) {
            commitToken(pred.label, pred.confidence);
            hold.lastCommittedLabel = pred.label;
            hold.lastCommitTime = now;
            hold.startTime = now;
            setHoldProgress(0);
          }
        }
      } else {
        hold.label = null;
        setHoldProgress(0);
      }

      return pred.gestureType;
    },
    [commitToken]
  );

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    recognizerRef.current?.resetBuffers();
    drawDualHandOverlay(null, 'none', 640, 480, false);
    setCameraActive(false);
    setLeftHandActive(false);
    setRightHandActive(false);
    setLandmarkCount(0);
    setHoldProgress(0);
  }, [drawDualHandOverlay]);

  const startCamera = useCallback(
    async (overrideDeviceId?: string) => {
      setCameraError(null);
      setSimulatorActive(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(
          'Your browser does not support webcam capture (navigator.mediaDevices.getUserMedia).'
        );
        return;
      }

      try {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }

        const deviceId = overrideDeviceId ?? selectedCameraId;
        const fallbackConstraints: MediaStreamConstraints = {
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };
        const constraints: MediaStreamConstraints = deviceId
          ? {
              video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
              audio: false,
            }
          : fallbackConstraints;

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr) {
          if (
            deviceId &&
            firstErr instanceof DOMException &&
            firstErr.name === 'OverconstrainedError'
          ) {
            stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
          } else {
            throw firstErr;
          }
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setCameraActive(true);
        await refreshCameras();
      } catch (err) {
        let msg = 'Camera access was denied or no camera was found.';
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg =
              'Camera permission was denied. Please allow camera access in your browser site settings and try again.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'No webcam device was detected on this system.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            msg =
              'Your webcam is currently in use by another application or could not be started.';
          } else if (err.message) {
            msg = err.message;
          }
        } else if (err instanceof Error && err.message) {
          msg = err.message;
        }
        setCameraError(
          `${msg} You can still test SignVision using the Interactive Sign Simulator below.`
        );
        setCameraActive(false);
      }
    },
    [refreshCameras, selectedCameraId]
  );

  // Live Camera Loop — skips duplicate video frames & tracks both hands simultaneously
  useEffect(() => {
    if (!cameraActive || simulatorActive) return;

    let active = true;
    let lastTimestamp = -1;
    let lastVideoTime = -1;

    const tick = () => {
      if (!active) return;
      const video = videoRef.current;
      const tracker = handTrackerRef.current;

      if (
        video &&
        tracker &&
        tracker.isReady() &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        // Skip duplicate frames when the camera hasn't produced a new frame yet
        if (video.currentTime !== lastVideoTime) {
          lastVideoTime = video.currentTime;
          const now = performance.now();
          if (now > lastTimestamp) {
            lastTimestamp = now;
            const detection = tracker.detectFrame(video, now);
            const w = video.videoWidth;
            const h = video.videoHeight;

            const gestureType = processDualHandFrame(detection);
            drawDualHandOverlay(
              detection,
              gestureType === 'none' && detection.hands.length > 0 ? 'static' : gestureType,
              w,
              h,
              mirroredRef.current
            );
          }
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, simulatorActive, drawDualHandOverlay, processDualHandFrame]);

  // Interactive Sign Simulator Loop (supports both single-hand & dual-hand simulation)
  useEffect(() => {
    if (!simulatorActive) return;

    stopCamera();
    recognizerRef.current?.resetBuffers();
    simFrameRef.current = 0;

    const signMeta = SIGN_MAP.get(simSign);
    const interval = window.setInterval(() => {
      if (!recognizerRef.current?.isReady()) return;

      const frameIdx = simFrameRef.current++;
      let rightLandmarks: Landmark3D[];
      let leftLandmarks: Landmark3D[] | null = null;

      if (signMeta?.type === 'dynamic') {
        const seq = generateDynamicSequence(simSign as DynamicLabel, 24);
        rightLandmarks = seq[frameIdx % seq.length].map((p) => ({
          x: simDualHand ? Math.min(0.92, p.x + 0.14) : p.x,
          y: p.y,
          z: p.z,
        }));
        if (simDualHand) {
          if (simSign === 'HELP') {
            // Left open supporting palm beneath the lifting right fist
            const phase = (frameIdx % 24) / 23;
            const liftY = -0.14 * Math.sin(phase * Math.PI);
            const baseB = generateHandLandmarks({
              ...getStaticPoseParams('B'),
              wrist: { x: 0.42, y: 0.68 + liftY, z: 0.02 },
              pitch: 0.9,
              roll: 0.35,
            });
            leftLandmarks = baseB.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
          } else {
            leftLandmarks = seq[frameIdx % seq.length].map((p) => ({
              x: Math.max(0.08, 1 - p.x - 0.14),
              y: p.y,
              z: p.z,
            }));
          }
        }
      } else {
        const base = getStaticPoseParams((simSign as StaticLabel) || 'A');
        const microJitter = Math.sin(frameIdx * 0.25) * 0.015;
        rightLandmarks = generateHandLandmarks({
          ...base,
          wrist: simDualHand ? { x: 0.68, y: 0.66, z: 0 } : base.wrist,
          roll: (base.roll ?? 0) + microJitter,
        });
        if (simDualHand) {
          const leftRightBase = generateHandLandmarks({
            ...base,
            wrist: { x: 0.68, y: 0.66, z: 0 },
            roll: (base.roll ?? 0) - microJitter,
          });
          leftLandmarks = leftRightBase.map((p) => ({
            x: 1 - p.x,
            y: p.y,
            z: p.z,
          }));
        }
      }

      const rightHand: DetectedHand = {
        landmarks: rightLandmarks,
        handedness: 'Right',
        handednessScore: 0.99,
      };
      const leftHand: DetectedHand | null = leftLandmarks
        ? {
            landmarks: leftLandmarks,
            handedness: 'Left',
            handednessScore: 0.99,
          }
        : null;

      const simDetection: DualHandDetectionResult = {
        left: leftHand,
        right: rightHand,
        hands: leftHand ? [leftHand, rightHand] : [rightHand],
        totalLandmarks: leftHand ? 42 : 21,
      };

      const gestureType = processDualHandFrame(simDetection);
      drawDualHandOverlay(
        simDetection,
        gestureType === 'none'
          ? signMeta?.type === 'dynamic'
            ? 'dynamic'
            : 'static'
          : gestureType,
        640,
        480,
        false
      );
    }, 55);

    return () => {
      window.clearInterval(interval);
      drawDualHandOverlay(null, 'none', 640, 480, false);
    };
  }, [
    simulatorActive,
    simSign,
    simDualHand,
    stopCamera,
    processDualHandFrame,
    drawDualHandOverlay,
  ]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCameraSwitch = async (newDeviceId: string) => {
    setSelectedCameraId(newDeviceId);
    if (cameraActive) {
      await startCamera(newDeviceId);
    }
  };

  const handleClearSentence = () => {
    setSentence('');
    setRecognizedLetters([]);
    setRecognizedWords([]);
    setConfidenceHistory([]);
    holdStateRef.current.lastCommittedLabel = null;
  };

  const handleSaveToHistory = () => {
    const cleaned = sentence.trim();
    if (!cleaned) return;
    const avg =
      confidenceHistory.length > 0
        ? confidenceHistory.reduce((a, b) => a + b, 0) / confidenceHistory.length
        : recognition.confidence || 0.9;

    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      text: cleaned,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      avgConfidence: avg,
    };
    setHistory((prev) => [entry, ...prev.slice(0, 14)]);
  };

  const handleSpeakSentence = () => {
    const textToSpeak = sentence.trim() || recognition.label || '';
    if (!textToSpeak) return;
    speak(textToSpeak);
    if (sentence.trim()) {
      handleSaveToHistory();
    }
  };

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard fallback not needed
    }
  };

  const confidencePct = Math.round(recognition.confidence * 100);
  const confidenceBarClass = useMemo(() => {
    if (confidencePct >= 80) return 'bg-[#E60072] dark:bg-[#FF2D8D] shadow-[0_0_12px_rgba(255,45,141,0.5)]';
    if (confidencePct >= 55) return 'bg-[#FF69B4]';
    return 'bg-rose-500';
  }, [confidencePct]);

  const trackingStatusLabel = useMemo(() => {
    if (leftHandActive && rightHandActive) {
      return `2 HANDS · ${landmarkCount} LANDMARKS`;
    }
    if (leftHandActive) {
      return `LEFT HAND · ${landmarkCount} LANDMARKS`;
    }
    if (rightHandActive) {
      return `RIGHT HAND · ${landmarkCount} LANDMARKS`;
    }
    return 'Show 1 or 2 hands in frame';
  }, [leftHandActive, rightHandActive, landmarkCount]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white">
            Live Dual-Hand ASL Translator
          </h1>
          <p className="text-sm text-[#52525B] dark:text-[#A1A1AA]">
            Tracks both hands simultaneously (42 3D landmarks). Hold static signs (~0.8s) or
            perform single- and two-hand dynamic gestures.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSupportedModal((v) => !v)}
            className="sv-card inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#111111] dark:text-white hover:bg-[#FFF0F6] dark:hover:bg-[#14141B] transition-colors"
          >
            <Info className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" />
            Supported Signs (34)
          </button>

          <button
            type="button"
            onClick={() => setSimulatorActive((prev) => !prev)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              simulatorActive
                ? 'sv-btn-neon'
                : 'border border-[rgba(230,0,114,0.28)] dark:border-[rgba(255,45,141,0.3)] bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4] hover:border-[rgba(255,45,141,0.6)]'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {simulatorActive ? 'Stop Sign Simulator' : 'Try Sign Simulator (No Camera)'}
          </button>
        </div>
      </div>

      {/* Model Status / Error */}
      {modelsLoading && (
        <div
          role="status"
          className="sv-elevated flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-[#111111] dark:text-white"
        >
          <Loader2 className="h-5 w-5 animate-spin text-[#E60072] dark:text-[#FF2D8D]" />
          <span>
            Loading MediaPipe Dual-Hand Landmarker &amp; TensorFlow.js Static/Temporal ASL models...
          </span>
        </div>
      )}

      {modelsError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-50 dark:bg-[#14141B] px-4 py-3 text-sm text-rose-800 dark:text-rose-200"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#FF2D8D]" />
            <span>{modelsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setModelRetryNonce((n) => n + 1)}
            className="sv-btn-neon shrink-0 rounded-lg px-3 py-1 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Optional Supported Signs Quick Reference */}
      {showSupportedModal && (
        <div className="sv-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-[#111111] dark:text-white">
              Supported ASL Signs &amp; Model Separation
            </h2>
            <button
              type="button"
              onClick={() => setShowSupportedModal(false)}
              className="text-xs font-semibold text-[#E60072] dark:text-[#FF69B4] hover:underline"
            >
              Hide
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="sv-elevated rounded-xl p-3.5">
              <strong className="text-[#E60072] dark:text-[#FF69B4] block mb-1">
                Static Handshape MLP (25 signs):
              </strong>
              <p className="text-[#111111] dark:text-[#A1A1AA] font-mono">
                A, B, C, D, E, F, G, H, I, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, I LOVE YOU
              </p>
            </div>
            <div className="sv-elevated rounded-xl p-3.5">
              <strong className="text-[#E60072] dark:text-[#FF69B4] block mb-1">
                Dynamic Temporal Sequence Net (9 motion signs):
              </strong>
              <p className="text-[#111111] dark:text-[#A1A1AA] font-mono">
                J, Z, HELLO, THANK YOU, PLEASE, SORRY, YES, NO, HELP (1- &amp; 2-hand supported)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Camera + Dual-Hand Tracking Skeleton */}
        <div className="lg:col-span-7 space-y-4">
          <div
            className={`sv-card rounded-3xl overflow-hidden transition-all ${
              cameraActive || leftHandActive || rightHandActive ? 'sv-neon-highlight' : ''
            }`}
          >
            {/* Viewport */}
            <div className="relative aspect-video w-full bg-[#030304] flex items-center justify-center">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''} ${
                  cameraActive ? 'block' : 'hidden'
                }`}
              />

              <canvas
                ref={canvasRef}
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover ${
                  mirrored && cameraActive ? 'scale-x-[-1]' : ''
                }`}
              />

              {/* Status Overlay Pills */}
              <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-md ${
                      cameraActive
                        ? 'bg-[#FF2D8D]/20 text-white border border-[#FF2D8D]/60 shadow-[0_0_12px_rgba(255,45,141,0.35)]'
                        : simulatorActive
                        ? 'bg-[#FF69B4]/20 text-white border border-[#FF69B4]/50'
                        : 'bg-[#08080B]/85 text-[#A1A1AA] border border-[rgba(255,45,141,0.2)]'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        cameraActive
                          ? 'bg-[#FF2D8D] animate-pulse shadow-[0_0_8px_#FF2D8D]'
                          : simulatorActive
                          ? 'bg-[#FF69B4] animate-pulse'
                          : 'bg-zinc-500'
                      }`}
                    />
                    {cameraActive
                      ? 'LIVE CAMERA'
                      : simulatorActive
                      ? `SIMULATOR: ${simSign}`
                      : 'CAMERA OFF'}
                  </span>

                  {(cameraActive || simulatorActive) && (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold backdrop-blur-md ${
                        leftHandActive || rightHandActive
                          ? 'bg-[#0D0D12]/85 text-white border border-[#FF2D8D]/50 shadow-[0_0_12px_rgba(255,45,141,0.22)]'
                          : 'bg-[#08080B]/80 text-[#A1A1AA] border border-white/10'
                      }`}
                    >
                      {trackingStatusLabel}
                    </span>
                  )}
                </div>

                {/* Per-Hand Active Indicators */}
                {(cameraActive || simulatorActive) && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold backdrop-blur-md border transition-all ${
                        leftHandActive
                          ? 'bg-[#0D0D12]/90 text-[#FF69B4] border-[#FF2D8D] shadow-[0_0_10px_rgba(255,45,141,0.35)]'
                          : 'bg-[#08080B]/70 text-zinc-500 border-white/10'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          leftHandActive ? 'bg-[#FF2D8D]' : 'bg-zinc-600'
                        }`}
                      />
                      LEFT HAND
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-bold backdrop-blur-md border transition-all ${
                        rightHandActive
                          ? 'bg-[#0D0D12]/90 text-sky-300 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                          : 'bg-[#08080B]/70 text-zinc-500 border-white/10'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          rightHandActive ? 'bg-sky-400' : 'bg-zinc-600'
                        }`}
                      />
                      RIGHT HAND
                    </span>
                  </div>
                )}
              </div>

              {/* Empty state when camera & simulator off */}
              {!cameraActive && !simulatorActive && (
                <div className="text-center px-6 py-10 space-y-4 max-w-md">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#14141B] text-[#FF2D8D] border border-[rgba(255,45,141,0.35)] shadow-[0_0_24px_rgba(255,45,141,0.22)]">
                    <Camera className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-bold text-white">
                      Ready for Dual-Hand Tracking
                    </h2>
                    <p className="text-sm text-[#A1A1AA]">
                      Click <strong className="text-white">Start Camera</strong> to track both
                      hands simultaneously (42 landmarks), or launch the{' '}
                      <strong className="text-[#FF69B4]">Sign Simulator</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Camera Controls Bar */}
            <div className="bg-white dark:bg-[#0D0D12] border-t border-[rgba(230,0,114,0.14)] dark:border-[rgba(255,45,141,0.15)] p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  disabled={cameraActive || modelsLoading || Boolean(modelsError)}
                  className="sv-btn-neon inline-flex items-center gap-2 rounded-xl disabled:opacity-45 disabled:cursor-not-allowed px-5 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
                >
                  <Camera className="h-4 w-4" />
                  Start Camera
                </button>

                <button
                  type="button"
                  onClick={stopCamera}
                  disabled={!cameraActive}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-600/90 hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-3 text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                >
                  <CameraOff className="h-4 w-4" />
                  Stop Camera
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {cameras.length > 0 && (
                  <label className="flex items-center gap-2 text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA]">
                    <span className="sr-only">Select Camera</span>
                    <select
                      value={selectedCameraId}
                      onChange={(e) => handleCameraSwitch(e.target.value)}
                      aria-label="Select webcam device"
                      className="max-w-[200px] rounded-xl border border-[rgba(230,0,114,0.2)] dark:border-[rgba(255,45,141,0.2)] bg-[#FFF0F6]/50 dark:bg-[#14141B] px-3 py-2.5 text-xs font-medium text-[#111111] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#FF2D8D]"
                    >
                      {cameras.map((cam, idx) => (
                        <option key={cam.deviceId || idx} value={cam.deviceId}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button
                  type="button"
                  onClick={() => setMirrored((m) => !m)}
                  aria-pressed={mirrored}
                  title="Mirror camera preview"
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    mirrored
                      ? 'border-[#E60072]/50 dark:border-[#FF2D8D]/60 bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4] shadow-[0_0_12px_rgba(255,45,141,0.18)]'
                      : 'border-[rgba(230,0,114,0.18)] dark:border-[rgba(255,45,141,0.15)] text-[#52525B] dark:text-[#A1A1AA]'
                  }`}
                >
                  <FlipHorizontal2 className="h-4 w-4" />
                  Mirror
                </button>
              </div>
            </div>
          </div>

          {cameraError && (
            <div
              role="alert"
              className="sv-elevated flex items-start gap-2.5 rounded-2xl p-4 text-sm text-[#111111] dark:text-white"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-[#E60072] dark:text-[#FF2D8D]" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Dual-Hand Telemetry Strip */}
          <div className="sv-card rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sv-elevated rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#E60072] dark:text-[#FF69B4]">
                  LEFT HAND
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    leftHandActive ? 'bg-[#FF2D8D] shadow-[0_0_8px_#FF2D8D]' : 'bg-zinc-500'
                  }`}
                />
              </div>
              <div className="font-display text-sm font-bold text-[#111111] dark:text-white">
                {recognition.leftSign?.label
                  ? `${recognition.leftSign.label} (${Math.round(
                      recognition.leftSign.confidence * 100
                    )}%)`
                  : leftHandActive
                  ? 'Tracking 21 pts'
                  : 'Not in frame'}
              </div>
            </div>

            <div className="sv-elevated rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                  RIGHT HAND
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${
                    rightHandActive ? 'bg-sky-400 shadow-[0_0_8px_#38BDF8]' : 'bg-zinc-500'
                  }`}
                />
              </div>
              <div className="font-display text-sm font-bold text-[#111111] dark:text-white">
                {recognition.rightSign?.label
                  ? `${recognition.rightSign.label} (${Math.round(
                      recognition.rightSign.confidence * 100
                    )}%)`
                  : rightHandActive
                  ? 'Tracking 21 pts'
                  : 'Not in frame'}
              </div>
            </div>

            <div className="sv-elevated rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-[#52525B] dark:text-[#A1A1AA]">
                  DUAL SYNC
                </span>
                <Hand className="h-3.5 w-3.5 text-[#E60072] dark:text-[#FF2D8D]" />
              </div>
              <div className="font-mono text-xs font-semibold text-[#111111] dark:text-white">
                {recognition.dualHandMetrics
                  ? `Dist ${recognition.dualHandMetrics.wristDistance.toFixed(1)} · Sym ${Math.round(
                      recognition.dualHandMetrics.symmetryScore * 100
                    )}%`
                  : recognition.trackingMode === 'none'
                  ? 'Idle'
                  : 'Single-hand mode'}
              </div>
            </div>
          </div>

          {/* Simulator Controls when active */}
          {simulatorActive && (
            <div className="sv-card sv-neon-highlight rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#111111] dark:text-white">
                    3D Kinematic Hand Simulator
                  </h3>
                  <p className="text-xs text-[#52525B] dark:text-[#A1A1AA]">
                    Feeds synthetic {simDualHand ? '42-point dual-hand' : '21-point single-hand'}{' '}
                    3D landmarks into the live TensorFlow.js pipeline.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSimDualHand((v) => !v)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      simDualHand
                        ? 'border-[#FF2D8D]/60 bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4]'
                        : 'border-[rgba(255,45,141,0.2)] text-[#52525B] dark:text-[#A1A1AA]'
                    }`}
                  >
                    {simDualHand ? 'Both Hands (42 pts)' : 'Single Hand (21 pts)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSimulatorActive(false)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#111111] dark:bg-white text-white dark:text-[#030304] px-3 py-1.5 text-xs font-semibold"
                  >
                    <Square className="h-3 w-3" />
                    Exit
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {ASL_SIGNS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSimSign(s.label)}
                    className={`rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold transition-all ${
                      simSign === s.label
                        ? 'sv-btn-neon'
                        : 'sv-elevated text-[#111111] dark:text-[#A1A1AA] hover:text-[#E60072] dark:hover:text-white'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Live Translation Panel & TTS */}
        <div className="lg:col-span-5 space-y-4">
          {/* Current Sign + Confidence */}
          <div
            className={`sv-card rounded-3xl p-6 space-y-4 transition-all ${
              recognition.label ? 'sv-neon-highlight' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
                  Detected Sign
                </span>
                {recognition.gestureType !== 'none' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0F6] dark:bg-[#14141B] border border-[rgba(255,45,141,0.3)] px-2 py-0.5 text-[10px] font-bold uppercase text-[#E60072] dark:text-[#FF69B4]">
                    {recognition.gestureType === 'dynamic' ? (
                      <Waves className="h-3 w-3" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    {recognition.gestureType}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <Activity className="h-3.5 w-3.5 text-[#E60072] dark:text-[#FF2D8D]" />
                Motion: {(recognition.motionEnergy * 100).toFixed(1)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div
                aria-live="polite"
                className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111111] dark:text-white min-h-[3.25rem] flex items-center"
              >
                {recognition.label ?? '—'}
              </div>

              <div className="text-right space-y-1">
                <div className="font-mono text-2xl font-bold text-[#E60072] dark:text-[#FF69B4]">
                  {recognition.label ? `${confidencePct}%` : '0%'}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
                  Confidence
                </div>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="h-2.5 w-full rounded-full bg-[#FFF0F6] dark:bg-[#14141B] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-150 ${confidenceBarClass}`}
                style={{ width: `${recognition.label ? confidencePct : 0}%` }}
              />
            </div>

            {/* Hold-to-type progress for static signs */}
            {recognition.gestureType === 'static' && recognition.label && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-medium text-[#52525B] dark:text-[#A1A1AA]">
                  <span>Hold steady to add to sentence</span>
                  <span className="font-mono text-[#E60072] dark:text-[#FF69B4]">
                    {Math.round(holdProgress * 100)}%
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-[#FFF0F6] dark:bg-[#14141B] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FF2D8D] shadow-[0_0_8px_#FF2D8D] transition-all duration-75"
                    style={{ width: `${Math.round(holdProgress * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Top Candidates + Manual Add */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {recognition.topCandidates.map((cand) => (
                  <span
                    key={`${cand.type}-${cand.label}`}
                    className="sv-elevated rounded-lg px-2.5 py-1 font-mono text-xs text-[#111111] dark:text-[#A1A1AA]"
                  >
                    {cand.label} ({Math.round(cand.confidence * 100)}%)
                  </span>
                ))}
              </div>

              {recognition.label && (
                <button
                  type="button"
                  onClick={() => commitToken(recognition.label!, recognition.confidence)}
                  className="rounded-lg bg-[#FFF0F6] dark:bg-[#14141B] text-[#E60072] dark:text-[#FF69B4] border border-[rgba(255,45,141,0.35)] px-2.5 py-1 text-xs font-bold hover:shadow-[0_0_12px_rgba(255,45,141,0.25)] transition-all"
                >
                  + Add Now
                </button>
              )}
            </div>
          </div>

          {/* Complete Translated Sentence + TTS */}
          <div className="sv-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
                Translated Sentence
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSentence((s) => (s.endsWith(' ') ? s : s + ' '))}
                  className="sv-elevated inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#111111] dark:text-[#A1A1AA] hover:text-[#E60072] dark:hover:text-white"
                  title="Insert space"
                >
                  <Space className="h-3.5 w-3.5" />
                  Space
                </button>
                <button
                  type="button"
                  onClick={() => setSentence((s) => s.slice(0, -1))}
                  disabled={!sentence}
                  className="sv-elevated inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#111111] dark:text-[#A1A1AA] disabled:opacity-40"
                  title="Backspace"
                >
                  <Delete className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleClearSentence}
                  disabled={!sentence && recognizedLetters.length === 0 && recognizedWords.length === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-600 dark:text-[#FF69B4] disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            <textarea
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              rows={3}
              aria-label="Translated English sentence"
              placeholder="Signed letters and words will appear here..."
              className="w-full resize-none rounded-2xl border border-[rgba(230,0,114,0.18)] dark:border-[rgba(255,45,141,0.18)] bg-[#FAFAFA] dark:bg-[#14141B] p-4 font-display text-xl sm:text-2xl font-bold text-[#111111] dark:text-white placeholder:text-[#71717A] focus:outline-none focus:ring-2 focus:ring-[#FF2D8D]"
            />

            {/* Recognized Letters & Words chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sv-elevated rounded-xl p-3">
                <span className="font-bold text-[#52525B] dark:text-[#A1A1AA] block mb-1">
                  RECOGNIZED LETTERS
                </span>
                <div className="font-mono font-bold text-[#111111] dark:text-white min-h-[1.25rem] break-words">
                  {recognizedLetters.length > 0 ? recognizedLetters.join(' · ') : 'None yet'}
                </div>
              </div>
              <div className="sv-elevated rounded-xl p-3">
                <span className="font-bold text-[#52525B] dark:text-[#A1A1AA] block mb-1">
                  RECOGNIZED WORDS
                </span>
                <div className="font-mono font-bold text-[#E60072] dark:text-[#FF69B4] min-h-[1.25rem] break-words">
                  {recognizedWords.length > 0 ? recognizedWords.join(', ') : 'None yet'}
                </div>
              </div>
            </div>

            {/* Text-to-Speech Action Bar */}
            <div className="pt-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSpeakSentence}
                  disabled={!ttsSupported || (!sentence.trim() && !recognition.label) || isMuted}
                  className="sv-btn-neon flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 rounded-xl disabled:opacity-45 px-5 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2D8D]"
                >
                  <Volume2 className={`h-5 w-5 ${isSpeaking ? 'animate-pulse' : ''}`} />
                  {isSpeaking ? 'Speaking...' : 'Speak Sentence'}
                </button>

                <button
                  type="button"
                  onClick={replay}
                  disabled={!ttsSupported || !lastSpokenText || isMuted}
                  title="Replay last spoken phrase"
                  className="sv-elevated inline-flex items-center gap-1.5 rounded-xl disabled:opacity-40 px-4 py-3 text-sm font-semibold text-[#111111] dark:text-white hover:border-[rgba(255,45,141,0.4)]"
                >
                  <RotateCcw className="h-4 w-4 text-[#E60072] dark:text-[#FF69B4]" />
                  Replay
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-pressed={isMuted}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    isMuted
                      ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-[#FF69B4]'
                      : 'sv-elevated text-[#111111] dark:text-white'
                  }`}
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  {isMuted ? 'Muted' : 'Mute'}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSpeak}
                    onChange={(e) => setAutoSpeak(e.target.checked)}
                    className="rounded border-[rgba(255,45,141,0.3)] accent-[#FF2D8D] focus:ring-[#FF2D8D]"
                  />
                  Auto-speak each recognized sign
                </label>

                <div className="flex items-center gap-1.5">
                  <span>Speed:</span>
                  {[0.85, 1.0, 1.2].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRate(r)}
                      className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${
                        rate === r
                          ? 'sv-btn-neon'
                          : 'sv-elevated text-[#52525B] dark:text-[#A1A1AA]'
                      }`}
                    >
                      {r}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Translation History */}
          <div className="sv-card rounded-3xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#52525B] dark:text-[#A1A1AA]">
                <History className="h-4 w-4 text-[#E60072] dark:text-[#FF2D8D]" />
                Translation History
              </h2>
              <div className="flex items-center gap-2">
                {sentence.trim() && (
                  <button
                    type="button"
                    onClick={handleSaveToHistory}
                    className="text-xs font-semibold text-[#E60072] dark:text-[#FF69B4] hover:underline"
                  >
                    Save Current
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="text-xs font-semibold text-[#52525B] dark:text-[#A1A1AA] hover:text-[#FF2D8D]"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <p className="text-xs text-[#52525B] dark:text-[#A1A1AA] py-3">
                Spoken or saved sentences appear here for quick replay.
              </p>
            ) : (
              <ul className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {history.map((item) => (
                  <li
                    key={item.id}
                    className="sv-elevated flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#111111] dark:text-white truncate">
                        {item.text}
                      </p>
                      <span className="font-mono text-[11px] text-[#52525B] dark:text-[#A1A1AA]">
                        {item.timestamp} · {Math.round(item.avgConfidence * 100)}% avg confidence
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => speak(item.text)}
                        disabled={isMuted}
                        title="Play speech"
                        aria-label={`Play speech for ${item.text}`}
                        className="rounded-lg p-1.5 text-[#E60072] dark:text-[#FF2D8D] hover:bg-[#FFF0F6] dark:hover:bg-[#0D0D12] disabled:opacity-40"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.text, item.id)}
                        title="Copy text"
                        aria-label={`Copy ${item.text}`}
                        className="rounded-lg p-1.5 text-[#52525B] dark:text-[#A1A1AA] hover:bg-[#FFF0F6] dark:hover:bg-[#0D0D12]"
                      >
                        {copiedId === item.id ? (
                          <CheckCircle2 className="h-4 w-4 text-[#E60072] dark:text-[#FF69B4]" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
