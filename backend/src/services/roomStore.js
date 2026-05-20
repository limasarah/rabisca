const { createClient } = require('redis');

const DEFAULT_INACTIVITY_MS = 10 * 60 * 1000;
const DEFAULT_TTL_SECONDS = 10 * 60;
const ROOM_CODE_PATTERN = /^[A-Z0-9\-]{4,6}$/;
const WORDS = [
  'ARCO-ÍRIS',
  'ESTRELA',
  'BALEIA',
  'CASTELO',
  'CACHORRO',
  'GATO',
  'BOLHA',
  'PIRATA',
  'FLORESTA',
  'DINOSSAURO',
  'SOL',
  'TORRE',
  'SEREIA',
  'NAVE',
  'ROBÔ'
];
const STORY_PHRASES = [
  'Um amigo encontra um tesouro',
  'A festa das cores',
  'O animal mágico viaja',
  'A nuvem virou algodão doce',
  'A ponte brilhante aparece',
  'A descoberta na floresta',
  'O barco voador',
  'O gigante dorme tranquilo'
];

function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const part1 = letters.charAt(Math.floor(Math.random() * letters.length)) + letters.charAt(Math.floor(Math.random() * letters.length));
  const part2 = digits.charAt(Math.floor(Math.random() * digits.length)) + digits.charAt(Math.floor(Math.random() * digits.length));
  return `${part1}-${part2}`;
}

function sanitizeNickname(value) {
  return (value || 'Amigo').toString().trim().replace(/[^A-Za-z0-9\u00C0-\u017F ]/g, '').slice(0, 16) || 'Amigo';
}

function shuffleArray(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

class RoomStore {
  constructor() {
    this.rooms = new Map();
    this.redis = null;
    this.ttlSeconds = parseInt(process.env.REDIS_TTL_SECONDS || '', 10) || DEFAULT_TTL_SECONDS;
    this.cleanupInterval = setInterval(() => this.cleanup(), 30 * 1000);
  }

  async init() {
    const disable = process.env.DISABLE_REDIS === '1' || process.env.REDIS_URL === 'DISABLE';
    if (disable) {
      console.log('Redis desativado via DISABLE_REDIS=1 ou REDIS_URL=DISABLE');
      this.redis = null;
      return;
    }
    const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    try {
      this.redis = createClient({ url });
      this.redis.on('error', (err) => {
        console.warn('Redis error:', err.message || err);
      });
      await this.redis.connect();
      console.log(`Redis conectado em ${url}`);
    } catch (error) {
      console.warn('Não foi possível conectar ao Redis:', error.message || error);
      this.redis = null;
    }
  }

  roomKey(code) {
    return `room:${code.toUpperCase()}`;
  }

  async persistRoom(code, room) {
    if (!this.redis) return;
    try {
      await this.redis.set(this.roomKey(code), JSON.stringify(room), { EX: this.ttlSeconds });
    } catch (error) {
      console.warn('Falha ao persistir sala no Redis:', error.message || error);
    }
  }

  async fetchRoom(code) {
    if (!this.redis) return null;
    if (!code || !ROOM_CODE_PATTERN.test(code)) return null;
    try {
      const raw = await this.redis.get(this.roomKey(code));
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      console.warn('Falha ao buscar sala no Redis:', error.message || error);
      return null;
    }
  }

  async hasRoom(code) {
    const normalized = code?.toUpperCase();
    if (!normalized) return false;
    if (this.rooms.has(normalized)) return true;
    if (!this.redis) return false;
    return (await this.redis.exists(this.roomKey(normalized))) === 1;
  }

  async createRoom(ownerNickname) {
    let code;
    do {
      code = generateRoomCode();
    } while (await this.hasRoom(code));

    const room = {
      code,
      players: [],
      canvasEvents: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      mode: 'free',
      modeData: {},
      history: [],
      safeChat: []
    };
    this.rooms.set(code, room);
    await this.persistRoom(code, room);
    return room;
  }

  createGuessOptions(secretWord) {
    const candidates = WORDS.filter((word) => word !== secretWord);
    const options = shuffleArray(candidates).slice(0, 3);
    options.push(secretWord);
    return shuffleArray(options);
  }

  createStoryPhraseOptions() {
    return shuffleArray(STORY_PHRASES).slice(0, 4);
  }

  getNextPlayerIndex(room, currentIndex) {
    if (!room.players.length) return null;
    return (currentIndex + 1) % room.players.length;
  }

  initializeMode(room) {
    room.canvasEvents = [];
    if (room.mode === 'guess') {
      const drawer = room.players[0] || null;
      const secretWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      room.modeData = {
        phase: 'guess',
        drawerSocketId: drawer?.socketId || null,
        drawerNickname: drawer?.nickname || 'Amigo',
        secretWord,
        guessOptions: this.createGuessOptions(secretWord),
        solved: false,
        attempts: 0,
        guessHistory: []
      };
    } else if (room.mode === 'story') {
      const starter = room.players[0] || null;
      const playerCount = room.players.length || 1;
      room.modeData = {
        phase: 'draw',
        currentPlayerIndex: 0,
        currentPlayerNickname: starter?.nickname || 'Amigo',
        currentPlayerSocketId: starter?.socketId || null,
        phraseOptions: this.createStoryPhraseOptions(),
        storySteps: [],
        complete: false,
        maxSteps: Math.max(playerCount * 2, 4)
      };
    } else {
      room.modeData = {};
    }
  }

  async getRoom(code) {
    if (!code || !ROOM_CODE_PATTERN.test(code)) return null;
    const normalized = code.toUpperCase();
    let room = this.rooms.get(normalized);
    if (!room && this.redis) {
      room = await this.fetchRoom(normalized);
    }
    if (!room) return null;
    room.lastActiveAt = Date.now();
    this.rooms.set(normalized, room);
    await this.persistRoom(normalized, room);
    return room;
  }

  async addPlayer(code, socketId, nickname) {
    const room = await this.getRoom(code);
    if (!room) return null;
    const cleanedName = sanitizeNickname(nickname);
    const existing = room.players.find((p) => p.socketId === socketId);
    if (!existing) {
      room.players.push({ socketId, nickname: cleanedName });
    }
    if (room.mode === 'guess' && (!room.modeData.drawerSocketId || !room.players.some((p) => p.socketId === room.modeData.drawerSocketId))) {
      const next = room.players[0] || null;
      room.modeData.drawerSocketId = next?.socketId || null;
      room.modeData.drawerNickname = next?.nickname || 'Amigo';
    }
    if (room.mode === 'story' && (!room.modeData.currentPlayerSocketId || !room.players.some((p) => p.socketId === room.modeData.currentPlayerSocketId))) {
      const next = room.players[0] || null;
      room.modeData.currentPlayerIndex = 0;
      room.modeData.currentPlayerNickname = next?.nickname || 'Amigo';
      room.modeData.currentPlayerSocketId = next?.socketId || null;
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
    return { room, nickname: cleanedName };
  }

  async removePlayer(code, socketId) {
    const room = await this.getRoom(code);
    if (!room) return;
    room.players = room.players.filter((p) => p.socketId !== socketId);
    if (room.players.length === 0) {
      this.rooms.delete(code.toUpperCase());
      if (this.redis) {
        await this.redis.del(this.roomKey(code));
      }
      return;
    }
    if (room.mode === 'guess' && room.modeData.drawerSocketId === socketId) {
      const next = room.players[0] || null;
      const secretWord = WORDS[Math.floor(Math.random() * WORDS.length)];
      room.modeData.drawerSocketId = next?.socketId || null;
      room.modeData.drawerNickname = next?.nickname || 'Amigo';
      room.modeData.secretWord = secretWord;
      room.modeData.guessOptions = this.createGuessOptions(secretWord);
      room.modeData.solved = false;
      room.modeData.attempts = 0;
      room.modeData.guessHistory = [];
      room.canvasEvents = [];
    }
    if (room.mode === 'story') {
      const nextIndex = this.getNextPlayerIndex(room, room.modeData.currentPlayerIndex || 0);
      const next = room.players[nextIndex] || room.players[0] || null;
      room.modeData.currentPlayerIndex = nextIndex;
      room.modeData.currentPlayerNickname = next?.nickname || 'Amigo';
      room.modeData.currentPlayerSocketId = next?.socketId || null;
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
  }

  async saveCanvasEvent(code, event) {
    const room = await this.getRoom(code);
    if (!room) return;
    room.canvasEvents.push(event);
    if (room.canvasEvents.length > 3000) {
      room.canvasEvents = room.canvasEvents.slice(-2000);
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
  }

  async appendCanvasEvents(code, events) {
    const room = await this.getRoom(code);
    if (!room || !Array.isArray(events) || events.length === 0) return;
    room.canvasEvents = room.canvasEvents || [];
    room.canvasEvents.push(...events);
    if (room.canvasEvents.length > 3000) {
      room.canvasEvents = room.canvasEvents.slice(-2000);
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
  }

  async clearCanvas(code) {
    const room = await this.getRoom(code);
    if (!room) return;
    room.canvasEvents = [];
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
  }

  async setMode(code, mode) {
    const room = await this.getRoom(code);
    if (!room) return null;
    room.mode = mode;
    this.initializeMode(room);
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
    return room;
  }

  async submitGuess(code, guess, nickname) {
    const room = await this.getRoom(code);
    if (!room || room.mode !== 'guess') return null;
    const normalized = guess?.toString().trim().toUpperCase();
    room.modeData.attempts += 1;
    const correct = normalized === room.modeData.secretWord?.toString().trim().toUpperCase();
    room.modeData.guessHistory = room.modeData.guessHistory || [];
    room.modeData.guessHistory.push({ player: nickname, guess: normalized, correct, createdAt: Date.now() });
    if (correct) {
      const currentDrawerIndex = room.players.findIndex((p) => p.socketId === room.modeData.drawerSocketId);
      const nextIndex = this.getNextPlayerIndex(room, currentDrawerIndex === -1 ? 0 : currentDrawerIndex);
      const nextDrawer = room.players[nextIndex] || room.players[0];
      const newSecret = WORDS[Math.floor(Math.random() * WORDS.length)];
      room.modeData.drawerSocketId = nextDrawer?.socketId || null;
      room.modeData.drawerNickname = nextDrawer?.nickname || 'Amigo';
      room.modeData.secretWord = newSecret;
      room.modeData.guessOptions = this.createGuessOptions(newSecret);
      room.modeData.solved = true;
      room.modeData.attempts = 0;
      room.modeData.guessHistory = [];
      room.canvasEvents = [];
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
    return { correct, room };
  }

  async completeStoryDraw(code, authorNickname) {
    const room = await this.getRoom(code);
    if (!room || room.mode !== 'story') return null;
    room.modeData.storySteps = room.modeData.storySteps || [];
    room.modeData.storySteps.push({
      type: 'draw',
      author: authorNickname,
      frame: room.canvasEvents.slice(),
      createdAt: Date.now()
    });
    room.canvasEvents = [];
    room.modeData.phase = 'phrase';
    room.modeData.currentPlayerIndex = this.getNextPlayerIndex(room, room.modeData.currentPlayerIndex || 0);
    const next = room.players[room.modeData.currentPlayerIndex] || room.players[0] || null;
    room.modeData.currentPlayerNickname = next?.nickname || 'Amigo';
    room.modeData.currentPlayerSocketId = next?.socketId || null;
    room.modeData.phraseOptions = this.createStoryPhraseOptions();
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
    return room;
  }

  async submitStoryPhrase(code, phrase, authorNickname) {
    const room = await this.getRoom(code);
    if (!room || room.mode !== 'story') return null;
    room.modeData.storySteps = room.modeData.storySteps || [];
    room.modeData.storySteps.push({
      type: 'phrase',
      author: authorNickname,
      phrase,
      createdAt: Date.now()
    });
    const nextIndex = this.getNextPlayerIndex(room, room.modeData.currentPlayerIndex || 0);
    room.modeData.currentPlayerIndex = nextIndex;
    const next = room.players[nextIndex] || room.players[0] || null;
    room.modeData.currentPlayerNickname = next?.nickname || 'Amigo';
    room.modeData.currentPlayerSocketId = next?.socketId || null;
    if (room.modeData.storySteps.length >= room.modeData.maxSteps) {
      room.modeData.phase = 'complete';
      room.modeData.complete = true;
      room.canvasEvents = [];
    } else {
      room.modeData.phase = 'draw';
      room.modeData.phraseOptions = this.createStoryPhraseOptions();
    }
    room.lastActiveAt = Date.now();
    this.rooms.set(code.toUpperCase(), room);
    await this.persistRoom(code.toUpperCase(), room);
    return room;
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActiveAt > DEFAULT_INACTIVITY_MS) {
        this.rooms.delete(code);
      }
    }
  }
}

module.exports = new RoomStore();
