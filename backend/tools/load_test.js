const { io } = require('socket.io-client');

const argv = require('process').argv;
function argVal(name, def) {
  const idx = argv.indexOf(`--${name}`);
  if (idx === -1) return def;
  const v = argv[idx + 1];
  return v !== undefined ? v : def;
}

const TOTAL = parseInt(argVal('clients', '10'), 10);
const DURATION = parseInt(argVal('duration', '20'), 10) * 1000; // ms
const INTERVAL = parseInt(argVal('interval', '200'), 10); // ms
const SERVER = argVal('server', 'http://localhost:4000');

console.log(`Load test: ${TOTAL} clients, ${DURATION / 1000}s, interval ${INTERVAL}ms -> ${SERVER}`);

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function run() {
  const clients = [];
  const stats = { sent: 0, received: 0, latencies: [] };

  // create first client to create room
  const creator = io(SERVER, { transports: ['websocket'], reconnection: false });
  await new Promise((resolve) => creator.on('connect', resolve));
  const roomCode = await new Promise((resolve) => {
    creator.emit('create-room', { nickname: 'lt_creator' }, (res) => {
      if (res && res.success) resolve(res.code || res.room?.code);
      else resolve(null);
    });
  });
  if (!roomCode) {
    console.error('Failed to create room');
    process.exit(1);
  }
  console.log('Room created:', roomCode);

  // join creator to room (already joined by server logic), add listeners
  creator.on('connect_error', (e) => console.error('connect_error', e));
  creator.on('draw-event', (ev) => {
    if (ev && ev.sentAt) {
      stats.received += 1;
      stats.latencies.push(Date.now() - ev.sentAt);
    }
  });
  clients.push(creator);

  // spawn other clients
  for (let i = 1; i < TOTAL; i += 1) {
    const s = io(SERVER, { transports: ['websocket'], reconnection: false });
    // wait connect
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => s.on('connect', resolve));
    // join room
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => s.emit('join-room', { code: roomCode, nickname: `lt_${i}` }, () => resolve()));
    s.on('draw-event', (ev) => {
      if (ev && ev.sentAt) {
        stats.received += 1;
        stats.latencies.push(Date.now() - ev.sentAt);
      }
    });
    s.on('draw-batch', (events) => {
      if (!Array.isArray(events)) return;
      events.forEach((ev) => {
        if (ev && ev.sentAt) {
          stats.received += 1;
          stats.latencies.push(Date.now() - ev.sentAt);
        }
      });
    });
    clients.push(s);
    // small stagger
    // eslint-disable-next-line no-await-in-loop
    await sleep(20);
  }

  console.log(`All ${clients.length} clients connected and joined room ${roomCode}`);

  // start sending events from each client at interval
  const MODE = argVal('mode', 'single');
  const FLUSH = parseInt(argVal('flush', String(Math.max(10, Math.floor(1000 / 40)))), 10); // ms, default ~40Hz
  const timers = [];

  if (MODE === 'batch') {
    clients.forEach((s) => {
      let localBatch = [];
      const genTimer = setInterval(() => {
        const ev = { from: { x: Math.random() * 500, y: Math.random() * 400 }, to: { x: Math.random() * 500, y: Math.random() * 400 }, color: '#000', thickness: 2, tool: 'brush', sentAt: Date.now() };
        localBatch.push(ev);
        stats.sent += 1;
      }, INTERVAL);
      const flushTimer = setInterval(() => {
        if (localBatch.length === 0) return;
        try {
          s.emit('draw-batch', { events: localBatch.splice(0, localBatch.length) });
        } catch (e) {
          // ignore
        }
      }, FLUSH);
      timers.push(genTimer, flushTimer);
    });
  } else {
    clients.forEach((s) => {
      const t = setInterval(() => {
        const ev = { from: { x: Math.random() * 500, y: Math.random() * 400 }, to: { x: Math.random() * 500, y: Math.random() * 400 }, color: '#000', thickness: 2, tool: 'brush', sentAt: Date.now() };
        try {
          s.emit('draw-event', ev);
          stats.sent += 1;
        } catch (e) {
          // ignore
        }
      }, INTERVAL);
      timers.push(t);
    });
  }

  // run for duration
  await sleep(DURATION);

  // stop timers and disconnect
  timers.forEach(clearInterval);
  clients.forEach((s) => s.disconnect());

  // compute stats
  const lat = stats.latencies;
  const avg = lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0;
  const p95 = lat.length ? lat.sort((a, b) => a - b)[Math.floor(lat.length * 0.95)] : 0;

  console.log('--- RESULTS ---');
  console.log('Clients:', TOTAL);
  console.log('Sent events (approx):', stats.sent);
  console.log('Received events (count):', stats.received);
  console.log('Avg latency (ms):', avg);
  console.log('p95 latency (ms):', p95);
  console.log('Total recorded latencies:', lat.length);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
