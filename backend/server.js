require('dotenv').config();
const path = require('path');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const roomStore = require('./src/services/roomStore');

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || process.env.CORS_ORIGIN || '';
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({ origin: CLIENT_URL || '*', credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

const SAFE_MESSAGES = [
  'Muito bom!',
  'Tá perto!',
  'Gostei!',
  'Sua vez!',
  'Vamos juntos!',
  'Que cor linda!',
  'Show de bola!',
  'Continue assim!'
];

function sanitizeNickname(value) {
  return (value || 'Amigo').toString().trim().replace(/[^A-Za-z0-9\u00C0-\u017F ]/g, '').slice(0, 16) || 'Amigo';
}

function buildRoomData(room, includeSecret = false) {
  const modeData = room.modeData ? { ...room.modeData } : {};
  if (!includeSecret && room.mode === 'guess') {
    delete modeData.secretWord;
  }
  return {
    code: room.code,
    players: room.players,
    mode: room.mode,
    canvasEvents: room.canvasEvents,
    modeData
  };
}

function emitRoomUpdate(room) {
  io.to(room.code).emit('room-update', { players: room.players, mode: room.mode, code: room.code });
}

function emitRoomState(room) {
  io.to(room.code).emit('room-state', buildRoomData(room, false));
}

function emitSecretToDrawer(room) {
  if (room.mode !== 'guess' || !room.modeData) return;
  const drawerId = room.modeData.drawerSocketId;
  if (!drawerId) return;
  io.to(drawerId).emit('room-meta', { secretWord: room.modeData.secretWord });
}

function emitRoomStateToSocket(socket, room) {
  socket.emit('room-state', buildRoomData(room, false));
  if (room.mode === 'guess' && room.modeData) {
    if (room.modeData.drawerSocketId === socket.id) {
      socket.emit('room-meta', { secretWord: room.modeData.secretWord });
    }
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentNickname = null;

  const RATE_LIMIT_PER_SEC = 80; // max events per second per socket
  const tokenState = { tokens: RATE_LIMIT_PER_SEC, lastRefill: Date.now() };

  function refillTokens() {
    const now = Date.now();
    const elapsed = (now - tokenState.lastRefill) / 1000;
    if (elapsed <= 0) return;
    tokenState.tokens = Math.min(RATE_LIMIT_PER_SEC, tokenState.tokens + elapsed * RATE_LIMIT_PER_SEC);
    tokenState.lastRefill = now;
  }

  socket.on('create-room', async ({ nickname }, callback) => {
    try {
      const room = await roomStore.createRoom(nickname);
      currentRoom = room.code;
      currentNickname = nickname;
      await roomStore.addPlayer(room.code, socket.id, nickname);
      socket.join(room.code);
      callback?.({ success: true, code: room.code, room: buildRoomData(room, true) });
      emitRoomUpdate(room);
      emitRoomState(room);
      emitSecretToDrawer(room);
    } catch (error) {
      callback?.({ success: false, error: 'Erro ao criar sala.' });
    }
  });

  socket.on('join-room', async ({ code, nickname }, callback) => {
    try {
      const room = await roomStore.getRoom(code);
      if (!room) {
        callback?.({ success: false, error: 'Sala não encontrada ou expirada.' });
        return;
      }
      currentRoom = room.code;
      currentNickname = nickname;
      await roomStore.addPlayer(room.code, socket.id, nickname);
      socket.join(room.code);
      const updatedRoom = await roomStore.getRoom(room.code);
      callback?.({ success: true, code: updatedRoom.code, room: buildRoomData(updatedRoom, true) });
      emitRoomUpdate(updatedRoom);
      emitRoomState(updatedRoom);
      emitSecretToDrawer(updatedRoom);
      emitRoomStateToSocket(socket, updatedRoom);
    } catch (error) {
      callback?.({ success: false, error: 'Erro ao entrar na sala.' });
    }
  });

  socket.on('draw-event', async (data) => {
    if (!currentRoom) return;
    try {
      refillTokens();
      if (tokenState.tokens < 1) {
        // drop event silently
        return;
      }
      tokenState.tokens -= 1;

      // basic validation
      const validNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000;
      if (!data || !data.from || !data.to || !validNumber(data.from.x) || !validNumber(data.from.y) || !validNumber(data.to.x) || !validNumber(data.to.y)) {
        return;
      }
      if (typeof data.thickness !== 'number' || data.thickness <= 0 || data.thickness > 200) return;
      if (typeof data.color !== 'string' || data.color.length > 32) return;
      if (typeof data.tool !== 'string' || data.tool.length > 32) return;

      await roomStore.saveCanvasEvent(currentRoom, data);
      socket.to(currentRoom).emit('draw-event', data);
    } catch (err) {
      // ignore malformed events
    }
  });

  socket.on('draw-batch', async (payload) => {
    if (!currentRoom) return;
    try {
      const events = payload?.events;
      if (!Array.isArray(events) || events.length === 0) return;
      refillTokens();
      const allowed = Math.floor(tokenState.tokens);
      if (allowed <= 0) return;
      const toProcess = events.slice(0, allowed);
      tokenState.tokens = Math.max(0, tokenState.tokens - toProcess.length);

      // basic validation per event
      const validNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000;
      const good = toProcess.filter((d) => d && d.from && d.to && validNumber(d.from.x) && validNumber(d.from.y) && validNumber(d.to.x) && validNumber(d.to.y));
      if (good.length === 0) return;
      // persist batch
      await roomStore.appendCanvasEvents(currentRoom, good);
      // emit batch to other clients
      socket.to(currentRoom).emit('draw-batch', good);
    } catch (err) {
      // ignore
    }
  });

  socket.on('clear-canvas', async () => {
    if (!currentRoom) return;
    await roomStore.clearCanvas(currentRoom);
    io.to(currentRoom).emit('clear-canvas');
  });

  socket.on('set-mode', async ({ mode }) => {
    if (!currentRoom) return;
    const room = await roomStore.setMode(currentRoom, mode);
    if (!room) return;
    emitRoomUpdate(room);
    emitRoomState(room);
    emitSecretToDrawer(room);
  });

  socket.on('guess-attempt', async ({ guess }, callback) => {
    if (!currentRoom || !currentNickname) return;
    const result = await roomStore.submitGuess(currentRoom, guess, currentNickname);
    if (!result) {
      callback?.({ success: false, error: 'Não foi possível processar a tentativa.' });
      return;
    }
    const room = result.room;
    emitRoomUpdate(room);
    emitRoomState(room);
    emitSecretToDrawer(room);
    io.to(currentRoom).emit('guess-result', {
      player: currentNickname,
      guess,
      correct: result.correct,
      drawer: room.modeData.drawerNickname
    });
    callback?.({ success: true, correct: result.correct });
  });

  socket.on('complete-story-draw', async (callback) => {
    if (!currentRoom || !currentNickname) return;
    const room = await roomStore.completeStoryDraw(currentRoom, currentNickname);
    if (!room) {
      callback?.({ success: false, error: 'Não foi possível completar o desenho.' });
      return;
    }
    emitRoomUpdate(room);
    emitRoomState(room);
    callback?.({ success: true });
  });

  socket.on('submit-story-phrase', async ({ phrase }, callback) => {
    if (!currentRoom || !currentNickname) return;
    const room = await roomStore.submitStoryPhrase(currentRoom, phrase, currentNickname);
    if (!room) {
      callback?.({ success: false, error: 'Não foi possível enviar a frase.' });
      return;
    }
    emitRoomUpdate(room);
    emitRoomState(room);
    callback?.({ success: true });
  });

  socket.on('safe-chat', ({ index }) => {
    if (!currentRoom || typeof index !== 'number') return;
    const message = SAFE_MESSAGES[index] || SAFE_MESSAGES[0];
    io.to(currentRoom).emit('room-chat', {
      sender: sanitizeNickname(currentNickname),
      message,
      createdAt: Date.now()
    });
  });

  socket.on('disconnect', async () => {
    if (!currentRoom) return;
    await roomStore.removePlayer(currentRoom, socket.id);
    const room = await roomStore.getRoom(currentRoom);
    if (room) {
      emitRoomUpdate(room);
      emitRoomState(room);
    }
  });
});

const port = parseInt(process.env.PORT, 10) || 4000;

roomStore.init().then(async () => {
  // If Redis is available and not disabled, configure the Socket.io Redis adapter
  const disable = process.env.DISABLE_REDIS === '1' || process.env.REDIS_URL === 'DISABLE';
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  if (!disable && process.env.REDIS_URL) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { createClient } = require('redis');
      const pubClient = createClient({ url: redisUrl });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Socket.io Redis adapter inicializado');
    } catch (err) {
      console.warn('Falha ao inicializar Redis adapter:', err.message || err);
    }
  }

  server.listen(port, () => {
    console.log(`Rabisca backend rodando em http://localhost:${port}`);
  });
}).catch((error) => {
  console.error('Falha na inicialização do backend:', error);
  process.exit(1);
});
