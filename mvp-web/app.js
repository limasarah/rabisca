const socket = io();
const nicknameEl = document.getElementById('nickname');
const roomCodeEl = document.getElementById('room-code');
const entryPanel = document.getElementById('entry-panel');
const roomPanel = document.getElementById('room-panel');
const roomLabel = document.getElementById('room-label');
const playerCount = document.getElementById('player-count');
const modeSelect = document.getElementById('mode-select');
const quickMessagesEl = document.getElementById('quick-messages');
const chatLog = document.getElementById('chat-log');
const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnClear = document.getElementById('btn-clear');
const canvas = document.getElementById('draw-canvas');
const ctx = canvas.getContext('2d');
const modeExtra = document.getElementById('mode-extra');
const roomMeta = document.getElementById('room-meta');
const guessSection = document.getElementById('guess-section');
const guessPrompt = document.getElementById('guess-prompt');
const guessOptions = document.getElementById('guess-options');
const guessInput = document.getElementById('guess-input');
const guessSubmit = document.getElementById('guess-submit');
const storySection = document.getElementById('story-section');
const storyPhase = document.getElementById('story-phase');
const storyContent = document.getElementById('story-content');

let currentRoom = null;
let currentNickname = null;
let drawing = false;
let currentTool = 'brush';
let currentColor = '#ff6f61';
let currentThickness = 6;
let lastPoint = null;

const safeMessages = [
  'Muito bom!',
  'Tá perto!',
  'Gostei!',
  'Sua vez!',
  'Vamos juntos!',
  'Que cor linda!',
  'Show de bola!',
  'Continue assim!'
];

const drawState = { width: 0, height: 0 };

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  redrawStored();
}

function getPointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function startDrawing(event) {
  drawing = true;
  lastPoint = getPointerPosition(event);
}

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

function drawLine(pointA, pointB, color, thickness, tool, shouldBroadcast = true) {
  ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  ctx.lineWidth = thickness;
  ctx.beginPath();
  ctx.moveTo(pointA.x, pointA.y);
  ctx.lineTo(pointB.x, pointB.y);
  ctx.stroke();
  ctx.closePath();

  if (shouldBroadcast && currentRoom) {
    // push into batch to be sent via requestAnimationFrame
    sendBatch.push({ tool, color, thickness, from: pointA, to: pointB, sentAt: Date.now() });
  }
}

function redrawStored() {
  if (!drawState.events) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawState.events.forEach((stroke) => {
    drawLine(stroke.from, stroke.to, stroke.color, stroke.thickness, stroke.tool, false);
  });
}

// Batching: collect strokes and send in batches via requestAnimationFrame
const sendBatch = [];
let lastFlush = 0;
const TARGET_HZ = 40; // target send frequency (30-60Hz recommended)
const MIN_INTERVAL = 1000 / TARGET_HZ;

function flushBatchLoop() {
  const now = Date.now();
  if (sendBatch.length > 0 && now - lastFlush >= MIN_INTERVAL) {
    const batch = sendBatch.splice(0, sendBatch.length);
    socket.emit('draw-batch', { events: batch });
    lastFlush = now;
  }
  requestAnimationFrame(flushBatchLoop);
}

requestAnimationFrame(flushBatchLoop);

canvas.addEventListener('mousedown', (event) => {
  event.preventDefault();
  startDrawing(event);
});
canvas.addEventListener('touchstart', (event) => {
  event.preventDefault();
  startDrawing(event);
});
canvas.addEventListener('mousemove', (event) => {
  if (!drawing) return;
  const point = getPointerPosition(event);
  if (!lastPoint) {
    lastPoint = point;
    return;
  }
  drawLine(lastPoint, point, currentColor, currentThickness, currentTool);
  lastPoint = point;
});
canvas.addEventListener('touchmove', (event) => {
  if (!drawing) return;
  const point = getPointerPosition(event);
  if (!lastPoint) {
    lastPoint = point;
    return;
  }
  drawLine(lastPoint, point, currentColor, currentThickness, currentTool);
  lastPoint = point;
});
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseleave', stopDrawing);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchcancel', stopDrawing);

window.addEventListener('resize', () => {
  resizeCanvas();
});

function setTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.tool-btn').forEach((btn) => btn.classList.toggle('selected', btn.dataset.tool === tool));
}

function setThickness(value) {
  currentThickness = parseInt(value, 10);
  document.querySelectorAll('[data-thickness]').forEach((btn) => btn.classList.toggle('selected', btn.dataset.thickness === value));
}

function setColor(value) {
  currentColor = value;
  document.querySelectorAll('.color-btn').forEach((btn) => btn.classList.toggle('selected', btn.dataset.color === value));
}

function appendChat(message) {
  const paragraph = document.createElement('p');
  paragraph.textContent = `${message.sender}: ${message.message}`;
  chatLog.appendChild(paragraph);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateRoomInfo(room) {
  roomLabel.textContent = room.code;
  playerCount.textContent = room.players.length;
}

function updateModeUI(mode, modeData = {}) {
  if (!mode) {
    modeExtra.classList.add('hidden');
    return;
  }
  modeExtra.classList.remove('hidden');
  roomMeta.textContent = mode === 'free' ? 'Modo Desenho Livre ativado.' : 'Modo especial ativo.';
  guessSection.classList.add('hidden');
  storySection.classList.add('hidden');
  guessOptions.innerHTML = '';

  if (mode === 'guess') {
    guessSection.classList.remove('hidden');
    const playerCountText = modeData.drawerNickname ? `Desenhando: ${modeData.drawerNickname}` : 'Adivinhe o tema!';
    roomMeta.textContent = playerCountText;
    guessPrompt.textContent = 'Escolha uma opção ou digite sua resposta:';
    (modeData.guessOptions || []).forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'action-btn guess-option-btn';
      button.textContent = option;
      button.addEventListener('click', () => {
        guessInput.value = option;
        guessSubmit.click();
      });
      guessOptions.appendChild(button);
    });
  }

  if (mode === 'story') {
    storySection.classList.remove('hidden');
    const phase = modeData.phase || 'draw';
    const currentPlayer = modeData.currentPlayerNickname || 'Alguém';
    storyPhase.textContent = phase === 'draw'
      ? `Desenho: ${currentPlayer}`
      : phase === 'phrase'
        ? `Frase: ${currentPlayer}`
        : 'História concluída';

    if (phase === 'draw') {
      const isMe = currentNickname === currentPlayer;
      storyContent.innerHTML = isMe
        ? '<button id="complete-draw" class="action-btn">Completar Desenho</button>'
        : `<p>Aguardando ${currentPlayer} terminar o desenho...</p>`;
    } else if (phase === 'phrase') {
      const isMe = currentNickname === currentPlayer;
      storyContent.innerHTML = isMe
        ? '<div class="guess-form-row"><input id="story-input" type="text" placeholder="Digite a frase..." /><button id="story-submit" class="action-btn">Enviar Frase</button></div>'
        : `<p>Aguardando ${currentPlayer} escrever a próxima frase...</p>`;
      if (isMe) {
        const storyInputField = document.getElementById('story-input');
        const storySubmitButton = document.getElementById('story-submit');
        storySubmitButton.addEventListener('click', () => {
          const phrase = storyInputField.value.trim();
          if (!phrase) return;
          socket.emit('submit-story-phrase', { phrase }, (result) => {
            if (!result.success) {
              alert(result.error || 'Não foi possível enviar a frase.');
              return;
            }
            storyInputField.value = '';
          });
        });
      }
    } else {
      storyContent.innerHTML = '<p>História finalizada! Volte para o modo livre ou reinicie a sala.</p>';
    }
  }
}

function openRoom(room) {
  currentRoom = room.code;
  entryPanel.classList.add('hidden');
  roomPanel.classList.remove('hidden');
  updateRoomInfo(room);
  drawState.events = room.canvasEvents || [];
  resizeCanvas();
  updateModeUI(room.mode, room.modeData);
}

btnCreate.addEventListener('click', () => {
  const nickname = nicknameEl.value.trim() || 'Amigo';
  currentNickname = nickname;
  socket.emit('create-room', { nickname }, (result) => {
    if (result.success) {
      openRoom(result.room);
    }
  });
});

btnJoin.addEventListener('click', () => {
  const nickname = nicknameEl.value.trim() || 'Amigo';
  const code = roomCodeEl.value.trim().toUpperCase();
  if (!code) return;
  currentNickname = nickname;
  socket.emit('join-room', { code, nickname }, (result) => {
    if (!result.success) {
      alert(result.error || 'Não foi possível entrar na sala.');
      return;
    }
    openRoom(result.room);
  });
});

modeSelect.addEventListener('change', () => {
  const mode = modeSelect.value;
  socket.emit('set-mode', { mode });
});

btnClear.addEventListener('click', () => {
  if (!currentRoom) return;
  socket.emit('clear-canvas');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

guessSubmit.addEventListener('click', () => {
  if (!currentRoom) return;
  const guess = guessInput.value.trim();
  if (!guess) return;
  socket.emit('guess-attempt', { guess }, (result) => {
    if (!result.success) {
      alert(result.error || 'Não foi possível enviar a adivinhação.');
      return;
    }
    if (result.correct) {
      appendChat({ sender: 'Sistema', message: 'Acertou! Um novo tema foi gerado.' });
    }
    guessInput.value = '';
  });
});

storyContent.addEventListener('click', (event) => {
  if (event.target.id === 'complete-draw') {
    socket.emit('complete-story-draw', {}, (result) => {
      if (!result.success) {
        alert(result.error || 'Não foi possível completar o desenho.');
      }
    });
  }
});

safeMessages.forEach((text, index) => {
  const button = document.createElement('button');
  button.textContent = text;
  button.addEventListener('click', () => {
    socket.emit('safe-chat', { index });
  });
  quickMessagesEl.appendChild(button);
});

socket.on('room-state', (payload) => {
  if (!payload) return;
  updateRoomInfo(payload);
  drawState.events = payload.canvasEvents || [];
  resizeCanvas();
  updateModeUI(payload.mode, payload.modeData);
});

socket.on('room-update', (payload) => {
  if (payload?.players) {
    playerCount.textContent = payload.players.length;
  }
  if (payload?.mode) {
    modeSelect.value = payload.mode;
  }
});

socket.on('draw-event', (event) => {
  drawState.events = drawState.events || [];
  drawState.events.push(event);
  drawLine(event.from, event.to, event.color, event.thickness, event.tool, false);
});

socket.on('draw-batch', (events) => {
  if (!Array.isArray(events)) return;
  drawState.events = drawState.events || [];
  events.forEach((event) => {
    drawState.events.push(event);
    drawLine(event.from, event.to, event.color, event.thickness, event.tool, false);
  });
});

socket.on('clear-canvas', () => {
  drawState.events = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});

socket.on('room-meta', (payload) => {
  if (payload?.secretWord) {
    roomMeta.textContent = `Segredo: ${payload.secretWord}`;
  }
});

socket.on('guess-result', (data) => {
  appendChat({ sender: data.player, message: `tentou "${data.guess}" ${data.correct ? '(correto)' : '(errado)'}` });
});

socket.on('room-chat', (message) => {
  appendChat(message);
});

resizeCanvas();
