const { Cam } = require('onvif');
const config = require('../config');

let camInstancePromise;

const createCam = () =>
  new Promise((resolve, reject) => {
    const cameraConfig = {
      hostname: config.camera.host,
      username: config.camera.username,
      password: config.camera.password,
      port: Number(config.camera.onvifPort || config.camera.port || 80),
      timeout: 2000,
    };

    const cam = new Cam(cameraConfig, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(cam);
      }
    });
  });

async function getCam() {
  if (!camInstancePromise) {
    camInstancePromise = createCam().catch((error) => {
      camInstancePromise = null;
      throw error;
    });
  }
  return camInstancePromise;
}

async function continuousMove({ x = 0, y = 0, zoom = 0, timeout = config.camera.moveDurationMs }) {
  const cam = await getCam();
  return new Promise((resolve, reject) => {
    cam.continuousMove({
      x,
      y,
      zoom,
      timeout,
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function absoluteMove({ x = 0, y = 0, zoom = 0 }) {
  const cam = await getCam();
  return new Promise((resolve, reject) => {
    cam.absoluteMove({ x, y, zoom }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function stop({ panTilt = true, zoom = true } = {}) {
  const cam = await getCam();
  return new Promise((resolve, reject) => {
    cam.stop({ panTilt, zoom }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function getSnapshotUri() {
  const cam = await getCam();
  return new Promise((resolve, reject) => {
    cam.getSnapshotUri((err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.uri);
      }
    });
  });
}

module.exports = {
  getCam,
  continuousMove,
  absoluteMove,
  stop,
  getSnapshotUri,
};
