const canvas = document.getElementById('cameraCanvas');
const statusBanner = document.getElementById('streamStatus');
const snapshotButton = document.getElementById('snapshotButton');
const downloadLink = document.getElementById('downloadLink');
const controlButtons = document.querySelectorAll('.control');

const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const streamUrl = `${wsProtocol}://${window.location.host}/api/stream`;

if (window.loadPlayer && canvas) {
  let statusTimeout;
  let activePlayer;
  if (statusBanner) {
    statusBanner.classList.remove('hidden');
    statusBanner.textContent = 'Connecting to camera…';
    statusTimeout = setTimeout(() => {
      if (!canvas.dataset.streamReady) {
        statusBanner.textContent = 'Unable to reach the camera stream. Check RTSP settings and network.';
      }
    }, 8000);
  }

  loadPlayer({
    url: streamUrl,
    canvas,
    onDisconnect: () => {
      canvas.dataset.streamReady = '';
      if (statusBanner) {
        statusBanner.classList.remove('hidden');
        statusBanner.textContent = 'Lost connection to camera stream. Retrying…';
      }
    },
  })
    .then((player) => {
      activePlayer = player;
      canvas.dataset.streamReady = 'true';
      if (statusBanner) {
        statusBanner.classList.add('hidden');
        statusBanner.textContent = 'Connecting to camera…';
      }
    })
    .catch((error) => {
      console.error('Player error:', error);
      if (statusBanner) {
        statusBanner.textContent = 'Video player error – see console for details.';
      }
    })
    .finally(() => {
      if (statusTimeout) {
        clearTimeout(statusTimeout);
      }
      if (activePlayer && typeof activePlayer.destroy === 'function') {
        window.addEventListener('beforeunload', () => {
          activePlayer.destroy();
        });
      }
    });
}

async function sendPTZCommand(direction, action = 'move') {
  try {
    const response = await fetch('/api/ptz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ direction, action }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'PTZ command failed');
    }
  } catch (error) {
    console.error(error);
  }
}

async function stopPTZ() {
  try {
    await fetch('/api/ptz/stop', { method: 'POST' });
  } catch (error) {
    console.error(error);
  }
}

controlButtons.forEach((button) => {
  const direction = button.dataset.direction;
  if (!direction) return;

  if (direction === 'stop') {
    button.addEventListener('click', stopPTZ);
    return;
  }

  button.addEventListener('mousedown', () => sendPTZCommand(direction));
  button.addEventListener('touchstart', () => sendPTZCommand(direction));
  button.addEventListener('mouseup', stopPTZ);
  button.addEventListener('mouseleave', stopPTZ);
  button.addEventListener('touchend', stopPTZ);
});

window.addEventListener('mouseup', stopPTZ);
window.addEventListener('touchend', stopPTZ);

async function captureSnapshot() {
  try {
    snapshotButton.disabled = true;
    snapshotButton.textContent = 'Capturing…';
    const response = await fetch('/api/snapshot');
    if (!response.ok) {
      throw new Error('Unable to capture snapshot');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
    downloadLink.hidden = false;
    downloadLink.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch (error) {
    console.error(error);
    alert(error.message || 'Snapshot failed');
  } finally {
    snapshotButton.disabled = false;
    snapshotButton.textContent = 'Take Snapshot';
  }
}

if (snapshotButton) {
  snapshotButton.addEventListener('click', captureSnapshot);
}
