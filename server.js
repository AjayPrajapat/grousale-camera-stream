const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const expressWs = require('express-ws');

const config = require('./config');
const { captureSnapshotBuffer } = require('./lib/snapshot');
const onvifClient = require('./lib/onvifClient');

const app = express();

if (!config.auth.password && !config.auth.passwordHash) {
  console.warn('WARNING: No WEB_PASSWORD or WEB_PASSWORD_HASH set. Update your environment configuration.');
}

const sessionMiddleware = session({
  name: 'camera.sid',
  secret: config.server.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.server.httpsEnabled,
  },
});

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const server = config.server.httpsEnabled
  ? https.createServer(config.server.httpsOptions, app)
  : http.createServer(app);

expressWs(app, server);
const { proxy } = require('rtsp-relay')(app);
const playerScriptPath = require.resolve('rtsp-relay/browser');

function isAuthenticated(req) {
  return Boolean(req.session && req.session.user);
}

function requireAuth(req, res, next) {
  if (isAuthenticated(req)) {
    next();
  } else {
    res.redirect('/login');
  }
}

async function verifyPassword(password) {
  if (config.auth.passwordHash) {
    return bcrypt.compare(password, config.auth.passwordHash);
  }
  if (config.auth.password) {
    return password === config.auth.password;
  }
  return false;
}

app.use('/static', express.static(path.join(__dirname, 'public')));

app.get('/player.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(playerScriptPath);
});

app.get('/login', (req, res) => {
  if (isAuthenticated(req)) {
    return res.redirect('/');
  }
  return res.sendFile(path.join(__dirname, 'public/login.html'));
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).send('Missing credentials');
  }

  if (username !== config.auth.username) {
    return res.status(401).send('Invalid username or password');
  }

  const valid = await verifyPassword(password);
  if (!valid) {
    return res.status(401).send('Invalid username or password');
  }

  req.session.user = { username };
  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.get('/api/camera-info', requireAuth, (req, res) => {
  res.json({
    host: config.camera.host,
    protocol: config.camera.protocol,
  });
});

app.post('/api/ptz', requireAuth, async (req, res) => {
  const { direction } = req.body;
  if (!direction) {
    return res.status(400).json({ message: 'Direction is required' });
  }

  const speed = config.camera.ptzSpeed;
  const zoomSpeed = config.camera.zoomSpeed;

  try {
    switch (direction) {
      case 'up':
        await onvifClient.continuousMove({ y: speed });
        break;
      case 'down':
        await onvifClient.continuousMove({ y: -speed });
        break;
      case 'left':
        await onvifClient.continuousMove({ x: -speed });
        break;
      case 'right':
        await onvifClient.continuousMove({ x: speed });
        break;
      case 'zoom-in':
        await onvifClient.continuousMove({ zoom: zoomSpeed });
        break;
      case 'zoom-out':
        await onvifClient.continuousMove({ zoom: -zoomSpeed });
        break;
      default:
        return res.status(400).json({ message: `Unknown direction: ${direction}` });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('PTZ error:', error);
    res.status(500).json({ message: error.message || 'PTZ command failed' });
  }
});

app.post('/api/ptz/stop', requireAuth, async (req, res) => {
  try {
    await onvifClient.stop();
    res.json({ success: true });
  } catch (error) {
    console.error('PTZ stop error:', error);
    res.status(500).json({ message: error.message || 'Unable to stop PTZ' });
  }
});

app.get('/api/snapshot', requireAuth, async (req, res) => {
  try {
    const buffer = await captureSnapshotBuffer();
    res.type('image/jpeg');
    res.send(buffer);
  } catch (error) {
    console.error('Snapshot error:', error);
    res.status(500).json({ message: error.message || 'Snapshot failed' });
  }
});

const streamProxy = proxy({
  url: config.camera.rtspUrl,
  transport: 'tcp',
  verbose: false,
});

app.ws('/api/stream', (ws, req) => {
  if (!isAuthenticated(req)) {
    ws.close();
    return;
  }
  streamProxy(ws, req);
});

const listenCallback = () => {
  const protocol = config.server.httpsEnabled ? 'https' : 'http';
  console.log(`Camera server running on ${protocol}://localhost:${config.server.port}`);
};

server.listen(config.server.port, listenCallback);
