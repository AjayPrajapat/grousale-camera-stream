const path = require('path');
const fs = require('fs');
require('dotenv').config();

const boolFromEnv = (value) => {
  if (typeof value === 'boolean') return value;
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const cameraHost = process.env.CAMERA_HOST || '192.168.1.100';
const cameraPort = process.env.CAMERA_PORT || '554';
const cameraProtocol = process.env.CAMERA_PROTOCOL || 'rtsp';
const cameraPath = process.env.CAMERA_RTSP_PATH || 'live/ch00_1';
const cameraUsername = process.env.CAMERA_USERNAME || 'admin';
const cameraPassword = process.env.CAMERA_PASSWORD || '123456';

const rtspUrlFromParts = () => {
  const auth = cameraUsername && cameraPassword ? `${encodeURIComponent(cameraUsername)}:${encodeURIComponent(cameraPassword)}@` : '';
  const host = cameraHost || 'localhost';
  const portPart = cameraPort ? `:${cameraPort}` : '';
  const pathPart = cameraPath.startsWith('/') ? cameraPath.slice(1) : cameraPath;
  return `${cameraProtocol}://${auth}${host}${portPart}/${pathPart}`;
};

const rtspUrl = process.env.CAMERA_RTSP_URL || rtspUrlFromParts();

const httpsEnabled = boolFromEnv(process.env.HTTPS_ENABLED);
const httpsKeyPath = process.env.HTTPS_KEY_PATH ? path.resolve(process.env.HTTPS_KEY_PATH) : null;
const httpsCertPath = process.env.HTTPS_CERT_PATH ? path.resolve(process.env.HTTPS_CERT_PATH) : null;

const httpsOptions = httpsEnabled && httpsKeyPath && httpsCertPath &&
  fs.existsSync(httpsKeyPath) &&
  fs.existsSync(httpsCertPath)
  ? {
      key: fs.readFileSync(httpsKeyPath),
      cert: fs.readFileSync(httpsCertPath),
    }
  : null;

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    sessionSecret: process.env.SESSION_SECRET || 'replace-me-with-a-strong-secret',
    httpsEnabled: Boolean(httpsOptions),
    httpsOptions,
  },
  auth: {
    username: process.env.WEB_USERNAME || 'admin',
    password: process.env.WEB_PASSWORD || null,
    passwordHash: process.env.WEB_PASSWORD_HASH || null,
  },
  camera: {
    host: cameraHost,
    port: cameraPort,
    onvifPort: process.env.CAMERA_ONVIF_PORT || '80',
    protocol: cameraProtocol,
    username: cameraUsername,
    password: cameraPassword,
    rtspUrl,
    snapshotPath: process.env.CAMERA_SNAPSHOT_PATH || 'snapshot.jpg',
    snapshotTimeoutMs: Number(process.env.SNAPSHOT_TIMEOUT_MS || 5000),
    ptzSpeed: Number(process.env.CAMERA_PTZ_SPEED || 0.3),
    zoomSpeed: Number(process.env.CAMERA_ZOOM_SPEED || 0.3),
    moveDurationMs: Number(process.env.CAMERA_MOVE_DURATION_MS || 500),
  },
};
