import { randomUUID } from 'node:crypto';

const TEAM_IDS = ['Nova', 'Eclipse', 'Comet', 'Vortex', 'Orion'];
const MAX_HEARTS = 3;
const START_HEARTS = 3;
const DEFAULT_ROUNDS = 5;
const DEFAULT_SECONDS = 20;
const ALLOWED_ROUNDS = [5, 7, 10];
const ALLOWED_SECONDS = [15, 20, 30];

export const PROMPTS = [
  { text: 'I ___ (visit) London last year.', answers: ['visited', 'have visited', 'visit'], correct: 'visited', note: '"Last year" es un tiempo terminado: usamos Simple Past.' },
  { text: 'Have you ever ___ sushi?', answers: ['tried', 'try', 'trying'], correct: 'tried', note: 'Después de have/has usamos el participio: tried.' },
  { text: 'She hasn’t ___ the film yet.', answers: ['seen', 'saw', 'see'], correct: 'seen', note: '"Yet" suele acompañar al Present Perfect: hasn’t + participio.' },
  { text: 'We ___ to the museum yesterday.', answers: ['went', 'have gone', 'go'], correct: 'went', note: '"Yesterday" requiere Simple Past: went.' },
  { text: 'They have ___ their homework already.', answers: ['finished', 'finish', 'finishing'], correct: 'finished', note: 'Present Perfect: have + participio (finished).' },
  { text: '___ you ever been to Canada?', answers: ['Have', 'Did', 'Do'], correct: 'Have', note: 'La pregunta con "ever" usa Present Perfect: Have you ever…?' },
  { text: 'My brother ___ his keys two days ago.', answers: ['lost', 'has lost', 'lose'], correct: 'lost', note: '"Two days ago" es un momento terminado: Simple Past (lost).' },
  { text: 'I ___ this song since 2019.', answers: ['have known', 'knew', 'know'], correct: 'have known', note: '"Since 2019" conecta pasado y presente: Present Perfect.' },
  { text: 'It ___ raining an hour ago.', answers: ['stopped', 'has stopped', 'stops'], correct: 'stopped', note: '"An hour ago" pide Simple Past: stopped.' },
  { text: 'He ___ in Medellín for five years.', answers: ['has lived', 'lived', 'lives'], correct: 'has lived', note: '"For five years" indica duración que continúa: Present Perfect.' },
  { text: 'We ___ that movie last weekend.', answers: ['watched', 'have watched', 'watch'], correct: 'watched', note: '"Last weekend" es tiempo terminado: Simple Past (watched).' },
  { text: '___ she finished her project yet?', answers: ['Has', 'Did', 'Does'], correct: 'Has', note: 'Con "yet" usamos Present Perfect: Has she finished…?' },
  { text: 'I ___ my phone! Can you help me find it?', answers: ['have lost', 'lost', 'lose'], correct: 'have lost', note: 'Sin marcador de tiempo y con efecto presente: Present Perfect.' },
  { text: 'They ___ married in 2020.', answers: ['got', 'have got', 'get'], correct: 'got', note: 'Un año concreto (2020) requiere Simple Past: got married.' },
  { text: 'She ___ never eaten octopus.', answers: ['has', 'have', 'had'], correct: 'has', note: 'Con she/he/it el Present Perfect usa "has" + participio.' },
  { text: 'When ___ you arrive?', answers: ['did', 'have', 'do'], correct: 'did', note: 'Las preguntas con "when" sobre un momento pasado usan Simple Past: did.' },
  { text: 'I have ___ here since 8 a.m.', answers: ['been', 'be', 'was'], correct: 'been', note: 'Present Perfect: have + been (participio de be).' },
  { text: 'We have ___ seen that series.', answers: ['already', 'yet', 'ago'], correct: 'already', note: '"Already" se coloca entre have y el participio.' },
  { text: 'My parents ___ a new car last month.', answers: ['bought', 'have bought', 'buy'], correct: 'bought', note: '"Last month" exige Simple Past: bought.' },
  { text: '___ you finished the report yet?', answers: ['Have', 'Did', 'Are'], correct: 'Have', note: 'Con "yet" usamos Present Perfect: Have you finished…?' }
];

const ORAL_CHALLENGES = [
  { question: 'Have you ever…?', task: 'Di una oración en Present Perfect usando “ever”.', example: 'I have never visited Brazil.' },
  { question: 'Yesterday I…', task: 'Di una oración en Simple Past usando “yesterday”.', example: 'Yesterday I played football.' },
  { question: '¿Qué has hecho hoy?', task: 'Di dos cosas que ya hiciste hoy con “I have already…”.', example: 'I have already finished my homework.' },
  { question: 'Last weekend…', task: 'Cuenta una actividad del fin de semana en Simple Past.', example: 'Last weekend I watched a movie with my family.' },
  { question: 'For or since?', task: 'Di una oración con “for” o “since” sobre algo que empezó en el pasado.', example: 'I have studied English for five years.' }
];

const rooms = new Map();

const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
};

const normalizeCode = value => String(value || '').trim().toUpperCase();

const cleanName = value => (typeof value === 'string' ? value.trim() : '');

const validName = value => /^[\p{L}\p{N} _.-]{2,24}$/u.test(cleanName(value));

const validClientId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{6,64}$/.test(value);

const shuffle = list => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const makeTeams = () => Object.fromEntries(TEAM_IDS.map(team => [team, { score: 0, hearts: START_HEARTS }]));

const snapshot = (room, { withAnswer = false } = {}) => {
  const connectedPlayers = room.players.filter(player => player.connected).length;
  const answered = Object.fromEntries(TEAM_IDS.map(team => [
    team,
    room.players.filter(player => player.team === team && player.answered).length
  ]));
  const totals = Object.fromEntries(TEAM_IDS.map(team => [
    team,
    room.players.filter(player => player.team === team).length
  ]));

  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    maxRounds: room.maxRounds,
    durationMs: room.durationMs,
    prompt: room.prompt
      ? { text: room.prompt.text, answers: [...room.prompt.answers], ...(withAnswer ? { correct: room.prompt.correct } : {}) }
      : null,
    endsAt: room.endsAt,
    oralTeam: room.oralTeam,
    reveal: room.reveal,
    teams: Object.fromEntries(TEAM_IDS.map(team => [team, { ...room.teams[team] }])),
    players: room.players.map(player => ({
      clientId: player.clientId,
      name: player.name,
      team: player.team,
      connected: player.connected,
      answered: player.answered,
      correct: player.correct
    })),
    answered,
    totals,
    connectedPlayers,
    hostConnected: Boolean(room.hostSocket),
    hostName: room.hostName || '',
    closedByHost: Boolean(room.closedByHost),
    history: room.history,
    serverNow: Date.now()
  };
};

const oralChallenge = room => ORAL_CHALLENGES[(Math.max(1, room.round) - 1) % ORAL_CHALLENGES.length];

export function attachRooms(io) {
  const broadcast = room => {
    const base = snapshot(room);
    if (room.hostSocket) {
      io.to(room.hostSocket).emit('room:update', {
        ...base,
        host: true,
        prompt: room.prompt ? { ...base.prompt, correct: room.prompt.correct } : null
      });
      io.to(room.code).except(room.hostSocket).emit('room:update', base);
    } else {
      io.to(room.code).emit('room:update', base);
    }
  };

  const touch = room => { room.lastActivity = Date.now(); };

  const closeRound = room => {
    if (!room || room.phase !== 'race') return;
    clearTimeout(room.timer);
    room.timer = null;

    const entries = Object.entries(room.teams);
    const active = entries.filter(([team]) => room.players.some(player => player.team === team && player.connected));
    const pool = active.length ? active : entries;
    const minimum = Math.min(...pool.map(([, value]) => value.score));
    const last = pool.filter(([, value]) => value.score === minimum).map(([team]) => team);

    const counts = Object.fromEntries(TEAM_IDS.map(team => {
      const teamPlayers = room.players.filter(player => player.team === team);
      return [team, {
        total: teamPlayers.length,
        answered: teamPlayers.filter(player => player.answered).length,
        correct: teamPlayers.filter(player => player.correct).length
      }];
    }));

    room.reveal = {
      round: room.round,
      question: room.prompt.text,
      correct: room.prompt.correct,
      note: room.prompt.note,
      counts,
      oralChallenge: oralChallenge(room)
    };
    room.history.push({
      round: room.round,
      question: room.prompt.text,
      correct: room.prompt.correct,
      counts
    });
    room.oralTeam = last.length === 1 ? last[0] : null;
    room.phase = 'oral';
    room.endsAt = null;
    touch(room);
    broadcast(room);
  };

  const endGame = room => {
    clearTimeout(room.timer);
    room.timer = null;
    room.phase = 'ended';
    room.endsAt = null;
    touch(room);
    broadcast(room);
  };

  const scheduleClose = room => {
    clearTimeout(room.timer);
    room.timer = setTimeout(() => closeRound(room), room.durationMs + 350);
  };

  const joinAsPlayer = (room, socket, { name, team, clientId }, done) => {
    if (!TEAM_IDS.includes(team)) return done?.({ ok: false, error: 'Elige uno de los cinco escuadrones.' });
    if (!validName(name)) return done?.({ ok: false, error: 'El nombre debe tener entre 2 y 24 caracteres.' });
    if (!validClientId(clientId)) return done?.({ ok: false, error: 'No pudimos identificar tu dispositivo. Recarga la página.' });
    if (room.phase === 'ended') return done?.({ ok: false, error: 'Esta partida ya terminó.' });

    const clean = cleanName(name);
    let player = room.players.find(item => item.clientId === clientId);
    if (!player) {
      player = { clientId, name: clean, team, socketId: socket.id, connected: true, answered: false, correct: false };
      room.players.push(player);
    } else {
      player.name = clean;
      player.team = team;
      player.socketId = socket.id;
      player.connected = true;
    }

    socket.join(room.code);
    touch(room);
    broadcast(room);
    done?.({ ok: true, room: snapshot(room), host: false });
  };

  io.on('connection', socket => {
    socket.on('room:create', ({ hostName, maxRounds, durationSec } = {}, done) => {
      let id = randomCode();
      while (rooms.has(id)) id = randomCode();

      const rounds = ALLOWED_ROUNDS.includes(Number(maxRounds)) ? Number(maxRounds) : DEFAULT_ROUNDS;
      const seconds = ALLOWED_SECONDS.includes(Number(durationSec)) ? Number(durationSec) : DEFAULT_SECONDS;

      const room = {
        code: id,
        hostToken: randomUUID(),
        hostSocket: socket.id,
        hostName: cleanName(hostName).slice(0, 24),
        phase: 'lobby',
        round: 0,
        maxRounds: rounds,
        durationMs: seconds * 1000,
        prompt: null,
        endsAt: null,
        oralTeam: null,
        reveal: null,
        teams: makeTeams(),
        players: [],
        history: [],
        deck: shuffle(PROMPTS),
        closedByHost: false,
        timer: null,
        createdAt: Date.now(),
        lastActivity: Date.now()
      };

      rooms.set(id, room);
      socket.join(id);
      done?.({ ok: true, room: snapshot(room, { withAnswer: true }), host: true, hostToken: room.hostToken });
    });

    socket.on('room:join', ({ code, name, team, clientId }, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) return done?.({ ok: false, error: 'Sala no encontrada. Revisa el código.' });
      joinAsPlayer(room, socket, { name, team, clientId }, done);
    });

    socket.on('room:resume', ({ code, hostToken, clientId, name, team }, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) return done?.({ ok: false, error: 'La sala ya no existe.' });

      if (hostToken && room.hostToken === hostToken) {
        room.hostSocket = socket.id;
        room.closedByHost = false;
        socket.join(room.code);
        touch(room);
        broadcast(room);
        return done?.({ ok: true, room: snapshot(room, { withAnswer: true }), host: true });
      }

      if (validClientId(clientId)) {
        const player = room.players.find(item => item.clientId === clientId);
        if (player) {
          player.socketId = socket.id;
          player.connected = true;
          if (validName(name)) player.name = cleanName(name);
          if (TEAM_IDS.includes(team)) player.team = team;
          socket.join(room.code);
          touch(room);
          broadcast(room);
          return done?.({ ok: true, room: snapshot(room), host: false });
        }
      }

      if (validName(name) && TEAM_IDS.includes(team) && room.phase !== 'ended') {
        return joinAsPlayer(room, socket, { name, team, clientId }, done);
      }

      done?.({ ok: false, error: 'No pudimos reconectarte a la sala.' });
    });

    socket.on('room:leave', ({ code } = {}) => {
      const room = rooms.get(normalizeCode(code));
      if (!room) return;

      if (room.hostSocket === socket.id) {
        room.hostSocket = null;
        room.closedByHost = true;
        room.phase = 'ended';
        room.endsAt = null;
        clearTimeout(room.timer);
        room.timer = null;
      } else {
        room.players = room.players.filter(player => player.socketId !== socket.id);
      }

      socket.leave(room.code);
      touch(room);
      broadcast(room);
    });

    socket.on('round:start', ({ code } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.hostSocket !== socket.id) return done?.({ ok: false, error: 'Solo el anfitrión puede iniciar la ronda.' });
      if (room.phase !== 'lobby') return done?.({ ok: false, error: 'Termina la ronda actual antes de iniciar otra.' });
      if (room.round >= room.maxRounds) return done?.({ ok: false, error: 'La partida ya completó todas las rondas.' });

      room.round += 1;
      if (room.round > room.deck.length) room.deck = shuffle(PROMPTS);
      room.prompt = room.deck[(room.round - 1) % room.deck.length];
      room.phase = 'race';
      room.endsAt = Date.now() + room.durationMs;
      room.reveal = null;
      room.oralTeam = null;
      room.players.forEach(player => { player.answered = false; player.correct = false; });
      touch(room);

      broadcast(room);
      scheduleClose(room);
      done?.({ ok: true });
    });

    socket.on('round:answer', ({ code, answer } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.phase !== 'race') return done?.({ ok: false, error: 'La ronda ya terminó.' });

      const player = room.players.find(item => item.socketId === socket.id);
      if (!player) return done?.({ ok: false, error: 'No estás registrado en esta sala.' });
      if (player.answered) return done?.({ ok: false, error: 'Ya enviaste tu respuesta en esta ronda.' });
      if (room.endsAt && Date.now() > room.endsAt + 600) return done?.({ ok: false, error: 'Se acabó el tiempo de esta ronda.' });
      if (!room.prompt.answers.includes(answer)) return done?.({ ok: false, error: 'Opción inválida.' });

      player.answered = true;
      const correct = answer === room.prompt.correct;
      player.correct = correct;
      if (correct) room.teams[player.team].score += 100;

      touch(room);
      broadcast(room);
      done?.({
        ok: true,
        correct,
        note: correct ? room.prompt.note : 'No es la opción correcta. Fíjate en el marcador de tiempo (yesterday, last…, since, yet…).'
      });
    });

    socket.on('round:close', ({ code } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.hostSocket !== socket.id || room.phase !== 'race') return done?.({ ok: false });
      closeRound(room);
      done?.({ ok: true });
    });

    socket.on('oral:judge', ({ code, success } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.hostSocket !== socket.id || room.phase !== 'oral') return done?.({ ok: false });

      if (room.oralTeam && !success) {
        room.teams[room.oralTeam].hearts = Math.max(0, room.teams[room.oralTeam].hearts - 1);
      }

      const alive = Object.entries(room.teams).filter(([, team]) => team.hearts > 0);
      const finished = alive.length < 2 || room.round >= room.maxRounds;
      room.phase = finished ? 'ended' : 'lobby';
      room.endsAt = null;
      touch(room);
      broadcast(room);
      done?.({ ok: true });
    });

    socket.on('host:heart', ({ code, team, delta } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.hostSocket !== socket.id || !TEAM_IDS.includes(team)) return done?.({ ok: false });
      const change = Number(delta) === 1 ? 1 : -1;
      room.teams[team].hearts = Math.min(MAX_HEARTS, Math.max(0, room.teams[team].hearts + change));
      touch(room);
      broadcast(room);
      done?.({ ok: true });
    });

    socket.on('host:end', ({ code } = {}, done) => {
      const room = rooms.get(normalizeCode(code));
      if (!room || room.hostSocket !== socket.id) return done?.({ ok: false });
      endGame(room);
      done?.({ ok: true });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        let changed = false;

        for (const player of room.players) {
          if (player.socketId === socket.id) {
            player.socketId = null;
            player.connected = false;
            changed = true;
            const reference = player;
            setTimeout(() => {
              if (!reference.connected) {
                room.players = room.players.filter(item => item !== reference);
                broadcast(room);
              }
            }, 120_000).unref?.();
          }
        }

        if (room.hostSocket === socket.id) {
          room.hostSocket = null;
          changed = true;
        }

        if (changed) {
          touch(room);
          broadcast(room);
        }
      }
    });
  });

  const sweeper = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (!room.hostSocket && now - room.lastActivity > 30 * 60_000) {
        clearTimeout(room.timer);
        rooms.delete(code);
      }
    }
  }, 5 * 60_000);
  sweeper.unref?.();
}
