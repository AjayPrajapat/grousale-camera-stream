# Grousale / V380 Camera Web Controller

A complete Node.js + HTML5 application that lets you stream, control, and capture snapshots from a Grousale/V380-style IP camera directly in your browser. The backend pulls the camera's RTSP feed, exposes PTZ and snapshot APIs via ONVIF, and secures access behind a login screen.

## Features

- **Secure login** with session-based authentication (supports bcrypt hashed passwords).
- **RTSP to WebRTC (canvas) relay** powered by [`rtsp-relay`](https://github.com/kyriesent/rtsp-relay), viewable in any modern browser.
- **PTZ controls** (pan, tilt, zoom) exposed through REST endpoints and ONVIF commands.
- **Snapshot capture** via ONVIF snapshot URI or `ffmpeg` fallback.
- **Responsive UI** with PTZ buttons, snapshot download, and placeholders for two-way audio integration.
- **Environment-based configuration** for camera credentials, RTSP path, PTZ speeds, and HTTPS certificates.

## Prerequisites

- Node.js 18+ (for native `fetch` support).
- `npm` (ships with Node.js).
- A Grousale/V380 (or ONVIF-compatible) IP camera with RTSP stream enabled.
- `ffmpeg` installed and available in your system PATH (for snapshot fallback and optional transcoding).
- Optional: TLS certificate and key if you want to serve the UI over HTTPS.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create your environment file**

   Copy the sample configuration and adjust the values for your camera and login credentials:

   ```bash
   cp .env.example .env
   ```

   Update `.env` with:

   - `WEB_USERNAME` and either `WEB_PASSWORD` (plain text for local dev) or `WEB_PASSWORD_HASH` (see below).
   - Camera network details (`CAMERA_HOST`, `CAMERA_USERNAME`, `CAMERA_PASSWORD`, `CAMERA_RTSP_PATH`, `CAMERA_ONVIF_PORT`).
   - Optional HTTPS paths and PTZ tuning values.

3. **(Optional) Generate a bcrypt password hash**

   Using Node.js REPL or a script:

   ```bash
   node -e "console.log(require('bcrypt').hashSync('your-strong-password', 12))"
   ```

   Set `WEB_PASSWORD_HASH` to the output and remove `WEB_PASSWORD` from `.env`.

4. **Run the server**

   ```bash
   npm start
   ```

   The application listens on `http://localhost:3000` by default. If HTTPS is enabled via environment variables, it will listen on `https://localhost:3000` instead.

5. **Log in and stream**

   - Open your browser to `http://localhost:3000`.
   - Sign in with the credentials configured in your `.env` file.
   - The live video canvas should begin streaming automatically once the RTSP connection is established.
   - Use the PTZ buttons to move the camera or zoom. Hold the direction buttons for continuous motion; release (or press stop) to halt movement.
   - Click **Take Snapshot** to capture and download the current frame as a JPEG.

## HTTPS Configuration

1. Generate or obtain TLS certificate (`cert.pem`) and private key (`key.pem`).
2. Update `.env`:

   ```ini
   HTTPS_ENABLED=true
   HTTPS_KEY_PATH=./certs/key.pem
   HTTPS_CERT_PATH=./certs/cert.pem
   ```

3. Restart the server. Static assets, API calls, and WebSocket streaming will automatically switch to secure protocols.

## ONVIF & PTZ Notes

- The backend uses the [`onvif`](https://www.npmjs.com/package/onvif) package to communicate with the camera's ONVIF services.
- `lib/onvifClient.js` establishes a single ONVIF session and exposes helper functions:
  - `continuousMove({ x, y, zoom })`
  - `stop({ panTilt, zoom })`
  - `getSnapshotUri()`
- The default PTZ speed (`CAMERA_PTZ_SPEED`, `CAMERA_ZOOM_SPEED`) controls how fast the camera moves. Increase or decrease the values to tune responsiveness.
- If your camera supports presets or absolute moves, you can extend `lib/onvifClient.js` with additional ONVIF methods (`gotoPreset`, `absoluteMove`, etc.) and add REST endpoints in `server.js`.
- Two-way audio APIs vary per vendor. Consult your camera's HTTP or proprietary SDK. The UI already includes placeholder buttons where you can wire up WebRTC/RTMP talk and listen features.

### Using Raw ONVIF Commands

If the included helpers don't match your device, you can send ONVIF SOAP requests directly:

```js
const { Cam } = require('onvif');

new Cam({
  hostname: 'CAMERA_IP',
  username: 'USERNAME',
  password: 'PASSWORD',
}, (err, cam) => {
  if (err) throw err;
  cam.gotoPreset({ preset: '1' }, console.log);
});
```

The structure above can be dropped into a new API route. Replace the method (`gotoPreset`, `relativeMove`, `setHomePosition`, etc.) with the ONVIF call you need.

## File Structure

```
.
├── .env.example            # Sample environment configuration
├── config.js               # Centralised runtime configuration loader
├── lib/
│   ├── onvifClient.js      # ONVIF helper and PTZ abstractions
│   └── snapshot.js         # Snapshot capture utilities (ONVIF + ffmpeg fallback)
├── package.json            # npm dependencies and scripts
├── public/
│   ├── css/styles.css      # Global styles for login + control UI
│   ├── index.html          # Authenticated camera dashboard
│   ├── js/app.js           # Frontend logic (stream + PTZ + snapshots)
│   └── login.html          # Login page
├── server.js               # Express server, RTSP relay, REST and WebSocket APIs
└── README.md               # This document
```

## API Overview

| Method | Endpoint         | Description                                 |
| ------ | ---------------- | ------------------------------------------- |
| GET    | `/api/snapshot`  | Returns a JPEG snapshot of the current feed |
| POST   | `/api/ptz`       | Issues a PTZ command (`direction` required) |
| POST   | `/api/ptz/stop`  | Stops any active PTZ movement                |
| WS     | `/api/stream`    | WebSocket endpoint for the RTSP relay       |

All endpoints require an authenticated session. Use the existing routes as templates when adding custom controls (presets, patrol, IR toggles, etc.).

## Troubleshooting

- **Black screen / no stream**: Verify the RTSP URL (use VLC first). Some cameras require `rtsp_transport=udp`; adjust in `lib/snapshot.js` / RTSP relay options if needed.
- **ONVIF errors**: Ensure ONVIF is enabled on the camera and that the ONVIF port matches (`80` or `8899` depending on firmware). Update `config.camera.onvifPort` in `config.js` if necessary.
- **Snapshot failures**: Confirm `ffmpeg` is installed. On macOS use `brew install ffmpeg`; on Linux use your distro's package manager.
- **Session resets**: Set a stronger `SESSION_SECRET` and consider enabling HTTPS to protect cookies in transit.

## License

MIT
