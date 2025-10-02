const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const { getSnapshotUri } = require('./onvifClient');

async function captureSnapshotToFile(outputPath) {
  const rtspUrl = config.camera.rtspUrl;
  const absolutePath = path.resolve(outputPath);

  await new Promise((resolve, reject) => {
    ffmpeg(rtspUrl)
      .inputOptions('-rtsp_transport', 'tcp')
      .frames(1)
      .format('image2')
      .save(absolutePath)
      .on('end', resolve)
      .on('error', reject)
      .timeout({
        input: config.camera.snapshotTimeoutMs,
      });
  });

  return absolutePath;
}

async function captureSnapshotBuffer() {
  try {
    const snapshotUri = await getSnapshotUri();
    if (snapshotUri) {
      const response = await fetch(snapshotUri);
      if (!response.ok) {
        throw new Error(`Snapshot fetch failed: ${response.status}`);
      }
      const buffer = await response.buffer();
      return buffer;
    }
  } catch (err) {
    // Fallback to ffmpeg
  }

  const tempFile = path.join(process.cwd(), 'snapshot-temp.jpg');
  await captureSnapshotToFile(tempFile);
  const buffer = fs.readFileSync(tempFile);
  fs.unlinkSync(tempFile);
  return buffer;
}

module.exports = {
  captureSnapshotToFile,
  captureSnapshotBuffer,
};
