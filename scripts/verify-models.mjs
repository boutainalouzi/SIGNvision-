import * as tf from '@tensorflow/tfjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DYNAMIC_LABELS, STATIC_LABELS } from '../src/data/aslSigns.ts';
import {
  DYNAMIC_FEATURE_DIM,
  DYNAMIC_SEQUENCE_LENGTH,
  STATIC_FEATURE_DIM,
  extractDynamicSequenceFeatures,
  extractStaticFeatures,
} from '../src/ml/landmarkFeatures.ts';
import {
  generateDynamicSequence,
  generateHandLandmarks,
  getStaticPoseParams,
} from '../src/ml/handKinematics.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.resolve(__dirname, '..', 'public', 'models');

async function loadLocalModel(dir) {
  const modelJson = JSON.parse(await fs.readFile(path.join(dir, 'model.json'), 'utf8'));
  const weightData = await fs.readFile(path.join(dir, 'weights.bin'));
  const handler = tf.io.fromMemory(
    modelJson.modelTopology,
    modelJson.weightsManifest[0].weights,
    weightData.buffer.slice(weightData.byteOffset, weightData.byteOffset + weightData.byteLength)
  );
  return tf.loadLayersModel(handler);
}

async function main() {
  await tf.setBackend('cpu');
  await tf.ready();

  const staticModel = await loadLocalModel(path.join(MODELS_DIR, 'static-asl'));
  const dynamicModel = await loadLocalModel(path.join(MODELS_DIR, 'dynamic-asl'));

  let staticCorrect = 0;
  for (let i = 0; i < STATIC_LABELS.length; i++) {
    const label = STATIC_LABELS[i];
    const lm = generateHandLandmarks(getStaticPoseParams(label));
    const feat = extractStaticFeatures(lm, 'Right');
    const probs = tf.tidy(() => {
      const out = staticModel.predict(tf.tensor2d(feat, [1, STATIC_FEATURE_DIM]));
      return out.dataSync();
    });
    const predIdx = probs.indexOf(Math.max(...probs));
    if (STATIC_LABELS[predIdx] === label) {
      staticCorrect++;
    } else {
      console.error(`Static mismatch: expected ${label}, got ${STATIC_LABELS[predIdx]}`);
    }
  }

  let dynamicCorrect = 0;
  for (let i = 0; i < DYNAMIC_LABELS.length; i++) {
    const label = DYNAMIC_LABELS[i];
    const seq = generateDynamicSequence(label, DYNAMIC_SEQUENCE_LENGTH);
    const feat = extractDynamicSequenceFeatures(
      seq.map((landmarks) => ({ landmarks, handedness: 'Right' }))
    );
    const probs = tf.tidy(() => {
      const out = dynamicModel.predict(
        tf.tensor3d(feat, [1, DYNAMIC_SEQUENCE_LENGTH, DYNAMIC_FEATURE_DIM])
      );
      return out.dataSync();
    });
    const predIdx = probs.indexOf(Math.max(...probs));
    if (DYNAMIC_LABELS[predIdx] === label) {
      dynamicCorrect++;
    } else {
      console.error(`Dynamic mismatch: expected ${label}, got ${DYNAMIC_LABELS[predIdx]}`);
    }
  }

  console.log(`Static verification: ${staticCorrect}/${STATIC_LABELS.length} passed`);
  console.log(`Dynamic verification: ${dynamicCorrect}/${DYNAMIC_LABELS.length} passed`);

  if (staticCorrect !== STATIC_LABELS.length || dynamicCorrect !== DYNAMIC_LABELS.length) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
