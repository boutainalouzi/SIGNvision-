import * as tf from '@tensorflow/tfjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  STATIC_LABELS,
  DYNAMIC_LABELS,
} from '../src/data/aslSigns.ts';
import {
  STATIC_FEATURE_DIM,
  DYNAMIC_FEATURE_DIM,
  DYNAMIC_SEQUENCE_LENGTH,
  extractStaticFeatures,
  extractDynamicSequenceFeatures,
} from '../src/ml/landmarkFeatures.ts';
import {
  getStaticPoseParams,
  generateHandLandmarks,
  generateDynamicSequence,
} from '../src/ml/handKinematics.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_MODELS_DIR = path.join(ROOT_DIR, 'public', 'models');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng) {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function jitterLandmarks(landmarks, rng, stdDev = 0.004) {
  return landmarks.map((p) => ({
    x: p.x + randn(rng) * stdDev,
    y: p.y + randn(rng) * stdDev,
    z: p.z + randn(rng) * stdDev,
  }));
}

async function saveTfjsModel(model, targetDir, metadata) {
  await fs.mkdir(targetDir, { recursive: true });

  await model.save(
    tf.io.withSaveHandler(async (artifacts) => {
      const weightBuffer = Buffer.from(artifacts.weightData);
      await fs.writeFile(path.join(targetDir, 'weights.bin'), weightBuffer);

      const modelJson = {
        format: artifacts.format ?? 'layers-model',
        generatedBy: artifacts.generatedBy ?? 'TensorFlow.js SignVision Trainer',
        convertedBy: artifacts.convertedBy ?? null,
        modelTopology: artifacts.modelTopology,
        weightsManifest: [
          {
            paths: ['weights.bin'],
            weights: artifacts.weightSpecs,
          },
        ],
      };

      await fs.writeFile(
        path.join(targetDir, 'model.json'),
        JSON.stringify(modelJson)
      );

      return {
        modelArtifactsInfo: {
          dateSaved: new Date(),
          modelTopologyType: 'JSON',
          weightDataBytes: weightBuffer.byteLength,
        },
      };
    })
  );

  await fs.writeFile(
    path.join(targetDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
}

function shufflePairs(xsArray, ysArray, sampleDim, rng) {
  const n = ysArray.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const shuffledX = new Float32Array(n * sampleDim);
  const shuffledY = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const src = indices[i];
    shuffledX.set(xsArray.subarray(src * sampleDim, (src + 1) * sampleDim), i * sampleDim);
    shuffledY[i] = ysArray[src];
  }
  return { shuffledX, shuffledY };
}

async function trainStaticModel(rng) {
  console.log('\n--- Training Static ASL Landmark MLP ---');
  const samplesPerClass = 220;
  const numClasses = STATIC_LABELS.length;
  const totalSamples = numClasses * samplesPerClass;

  const rawX = new Float32Array(totalSamples * STATIC_FEATURE_DIM);
  const rawY = new Int32Array(totalSamples);

  let sampleIdx = 0;
  for (let c = 0; c < numClasses; c++) {
    const label = STATIC_LABELS[c];
    const basePose = getStaticPoseParams(label);

    for (let s = 0; s < samplesPerClass; s++) {
      const pitchJitter = randn(rng) * 0.14;
      const yawJitter = randn(rng) * 0.16;
      const rollJitter = randn(rng) * 0.14;
      const scale = 0.14 + rng() * 0.08;
      const wrist = {
        x: 0.28 + rng() * 0.44,
        y: 0.48 + rng() * 0.34,
        z: randn(rng) * 0.03,
      };

      const perturbFinger = (f) => ({
        mcpFlex: f.mcpFlex + randn(rng) * 0.08,
        pipFlex: f.pipFlex + randn(rng) * 0.09,
        dipFlex: f.dipFlex + randn(rng) * 0.08,
        splay: f.splay + randn(rng) * 0.04,
        crossOffset: f.crossOffset,
      });

      const pose = {
        thumb: {
          abduction: basePose.thumb.abduction + randn(rng) * 0.07,
          opposition: basePose.thumb.opposition + randn(rng) * 0.08,
          ipFlex: basePose.thumb.ipFlex + randn(rng) * 0.07,
          elevation: basePose.thumb.elevation + randn(rng) * 0.08,
        },
        index: perturbFinger(basePose.index),
        middle: perturbFinger(basePose.middle),
        ring: perturbFinger(basePose.ring),
        pinky: perturbFinger(basePose.pinky),
        pitch: (basePose.pitch ?? 0) + pitchJitter,
        yaw: (basePose.yaw ?? 0) + yawJitter,
        roll: (basePose.roll ?? 0) + rollJitter,
        wrist,
        scale,
      };

      let landmarks = generateHandLandmarks(pose);
      landmarks = jitterLandmarks(landmarks, rng, 0.0025);

      // Randomly mirror half of samples as Left hand and pass handedness='left'
      const mirrorAsLeft = rng() < 0.35;
      if (mirrorAsLeft) {
        landmarks = landmarks.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
      }

      const feat = extractStaticFeatures(landmarks, mirrorAsLeft ? 'Left' : 'Right');
      rawX.set(feat, sampleIdx * STATIC_FEATURE_DIM);
      rawY[sampleIdx] = c;
      sampleIdx++;
    }
  }

  const { shuffledX, shuffledY } = shufflePairs(rawX, rawY, STATIC_FEATURE_DIM, rng);

  const xsTensor = tf.tensor2d(shuffledX, [totalSamples, STATIC_FEATURE_DIM]);
  const ysTensor = tf.oneHot(tf.tensor1d(shuffledY, 'int32'), numClasses);

  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [STATIC_FEATURE_DIM],
        units: 128,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }),
      }),
      tf.layers.batchNormalization(),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 1e-4 }),
      }),
      tf.layers.dropout({ rate: 0.12 }),
      tf.layers.dense({
        units: numClasses,
        activation: 'softmax',
      }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.003),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const history = await model.fit(xsTensor, ysTensor, {
    epochs: 30,
    batchSize: 64,
    validationSplit: 0.15,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(
            `Static Epoch ${epoch + 1}/30 - loss: ${logs.loss.toFixed(4)} acc: ${(
              logs.acc * 100
            ).toFixed(1)}% val_acc: ${(logs.val_acc * 100).toFixed(1)}%`
          );
        }
      },
    },
  });

  const finalValAcc = history.history.val_acc.at(-1);
  const finalAcc = history.history.acc.at(-1);

  await saveTfjsModel(model, path.join(PUBLIC_MODELS_DIR, 'static-asl'), {
    name: 'SignVision Static ASL Landmark MLP',
    architecture: 'MLP (89 -> 128 -> BN -> 64 -> 25 Softmax)',
    labels: STATIC_LABELS,
    featureDim: STATIC_FEATURE_DIM,
    trainingSamples: totalSamples,
    trainAccuracy: Number(finalAcc.toFixed(4)),
    valAccuracy: Number(finalValAcc.toFixed(4)),
    trainedAt: new Date().toISOString(),
  });

  xsTensor.dispose();
  ysTensor.dispose();
  model.dispose();
}

async function trainDynamicModel(rng) {
  console.log('\n--- Training Dynamic ASL Temporal 1D-CNN ---');
  const samplesPerClass = 100;
  const numClasses = DYNAMIC_LABELS.length;
  const totalSamples = numClasses * samplesPerClass;
  const sampleDim = DYNAMIC_SEQUENCE_LENGTH * DYNAMIC_FEATURE_DIM;

  const rawX = new Float32Array(totalSamples * sampleDim);
  const rawY = new Int32Array(totalSamples);

  let sampleIdx = 0;
  for (let c = 0; c < numClasses; c++) {
    const label = DYNAMIC_LABELS[c];

    for (let s = 0; s < samplesPerClass; s++) {
      const phaseOffset = (rng() - 0.5) * 0.14;
      const speedScale = 0.8 + rng() * 0.4;
      const amplitudeScale = 0.78 + rng() * 0.44;
      const dxGlobal = (rng() - 0.5) * 0.2;
      const dyGlobal = (rng() - 0.5) * 0.16;
      const scaleFactor = 0.85 + rng() * 0.3;

      let seq = generateDynamicSequence(
        label,
        DYNAMIC_SEQUENCE_LENGTH,
        phaseOffset,
        speedScale,
        amplitudeScale
      );

      // Add natural per-frame spatial jitter & global translation/scale
      const mirrorAsLeft = rng() < 0.3;
      const framesInput = seq.map((lm) => {
        let noisy = lm.map((p) => ({
          x: 0.5 + (p.x - 0.5) * scaleFactor + dxGlobal + randn(rng) * 0.003,
          y: 0.5 + (p.y - 0.5) * scaleFactor + dyGlobal + randn(rng) * 0.003,
          z: p.z * scaleFactor + randn(rng) * 0.003,
        }));
        if (mirrorAsLeft) {
          noisy = noisy.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
        }
        return {
          landmarks: noisy,
          handedness: mirrorAsLeft ? 'Left' : 'Right',
        };
      });

      // For IDLE class, also synthesize stationary static letter holds so static signs don't trigger dynamic signs
      if (label === 'IDLE' && s % 2 === 0) {
        const randomStatic = STATIC_LABELS[Math.floor(rng() * STATIC_LABELS.length)];
        const basePose = getStaticPoseParams(randomStatic);
        const holdWrist = { x: 0.4 + rng() * 0.2, y: 0.55 + rng() * 0.2, z: 0 };
        const holdFrames = [];
        for (let f = 0; f < DYNAMIC_SEQUENCE_LENGTH; f++) {
          const lm = jitterLandmarks(
            generateHandLandmarks({ ...basePose, wrist: holdWrist }),
            rng,
            0.0025
          );
          holdFrames.push({ landmarks: lm, handedness: 'Right' });
        }
        const feat = extractDynamicSequenceFeatures(holdFrames);
        rawX.set(feat, sampleIdx * sampleDim);
      } else {
        const feat = extractDynamicSequenceFeatures(framesInput);
        rawX.set(feat, sampleIdx * sampleDim);
      }

      rawY[sampleIdx] = c;
      sampleIdx++;
    }
  }

  const { shuffledX, shuffledY } = shufflePairs(rawX, rawY, sampleDim, rng);

  const xsTensor = tf.tensor3d(shuffledX, [
    totalSamples,
    DYNAMIC_SEQUENCE_LENGTH,
    DYNAMIC_FEATURE_DIM,
  ]);
  const ysTensor = tf.oneHot(tf.tensor1d(shuffledY, 'int32'), numClasses);

  const model = tf.sequential({
    layers: [
      tf.layers.averagePooling1d({
        inputShape: [DYNAMIC_SEQUENCE_LENGTH, DYNAMIC_FEATURE_DIM],
        poolSize: 3,
        strides: 3,
      }),
      tf.layers.flatten(),
      tf.layers.dense({ units: 96, activation: 'relu' }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({ units: 48, activation: 'relu' }),
      tf.layers.dense({ units: numClasses, activation: 'softmax' }),
    ],
  });

  model.compile({
    optimizer: tf.train.adam(0.004),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  const history = await model.fit(xsTensor, ysTensor, {
    epochs: 30,
    batchSize: 64,
    validationSplit: 0.15,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if ((epoch + 1) % 10 === 0 || epoch === 0) {
          console.log(
            `Dynamic Epoch ${epoch + 1}/30 - loss: ${logs.loss.toFixed(4)} acc: ${(
              logs.acc * 100
            ).toFixed(1)}% val_acc: ${(logs.val_acc * 100).toFixed(1)}%`
          );
        }
      },
    },
  });

  const finalValAcc = history.history.val_acc.at(-1);
  const finalAcc = history.history.acc.at(-1);

  await saveTfjsModel(model, path.join(PUBLIC_MODELS_DIR, 'dynamic-asl'), {
    name: 'SignVision Dynamic ASL Temporal Sequence Classifier',
    architecture: 'Temporal Sequence Net ([24, 22] -> AvgPool1D(3) -> Flatten -> 96 -> 48 -> 10 Softmax)',
    labels: DYNAMIC_LABELS,
    sequenceLength: DYNAMIC_SEQUENCE_LENGTH,
    featureDim: DYNAMIC_FEATURE_DIM,
    trainingSamples: totalSamples,
    trainAccuracy: Number(finalAcc.toFixed(4)),
    valAccuracy: Number(finalValAcc.toFixed(4)),
    trainedAt: new Date().toISOString(),
  });

  xsTensor.dispose();
  ysTensor.dispose();
  model.dispose();
}

async function main() {
  await tf.setBackend('cpu');
  await tf.ready();
  const rng = mulberry32(20261126);
  await trainStaticModel(rng);
  await trainDynamicModel(rng);
  console.log('\nSaved trained TensorFlow.js models to public/models/');
}

main().catch((err) => {
  console.error('Training failed:', err);
  process.exit(1);
});
