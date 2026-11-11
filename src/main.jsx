import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import ship from './assets/portal-rush-ship.png';
import './styles.css';

const socket = io({ autoConnect: false });

const TEAMS = {
  Nova: { icon: '✦', label: 'Nova', color: '#3fe3c0', filter: 'none', trait: 'Velocidad' },
  Eclipse: { icon: '◉', label: 'Eclipse', color: '#bd8cff', filter: 'hue-rotate(120deg) saturate(1.1)', trait: 'Estrategia' },
  Comet: { icon: '☄', label: 'Comet', color: '#ffb44d', filter: 'hue-rotate(-120deg) saturate(1.5) brightness(1.1)', trait: 'Impulso' },
  Vortex: { icon: '◎', label: 'Vortex', color: '#ff7ad9', filter: 'hue-rotate(165deg) saturate(1.3)', trait: 'Caos' },
  Orion: { icon: '✧', label: 'Orion', color: '#6fa8ff', filter: 'hue-rotate(40deg) saturate(1.2)', trait: 'Precisión' }
};
const TEAM_IDS = Object.keys(TEAMS);
const SESSION_KEY = 'tw-session-v2';
const PROFILE_KEY = 'tw-profile';
const CLIENT_KEY = 'tw-client-id';
const MUTE_KEY = 'tw-muted';

const readJSON = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJSON = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible */
  }
};

const getClientId = () => {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(id || '')) {
      id = `${Math.random().toString(36).slice(2, 11)}${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return `guest${Math.random().toString(36).slice(2, 12)}`;
  }
};

const clearJoinParam = () => {
  try {
    if (new URLSearchParams(location.search).has('join')) history.replaceState({}, '', location.pathname);
  } catch {
    /* historial no disponible */
  }
};

/* ---------- sonido ---------- */

function useSound(muted) {
  const ctxRef = useRef(null);
  return useCallback(type => {
    if (muted) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!ctxRef.current) ctxRef.current = new AudioCtx();
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const tone = (freq, start, duration, volume, wave = 'sine') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(volume, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.03);
      };

      if (type === 'correct') {
        tone(660, 0, 0.12, 0.16, 'triangle');
        tone(990, 0.1, 0.2, 0.14, 'triangle');
      } else if (type === 'wrong') {
        tone(220, 0, 0.2, 0.15, 'sawtooth');
        tone(160, 0.14, 0.25, 0.12, 'sawtooth');
      } else if (type === 'start') {
        tone(440, 0, 0.1, 0.1, 'triangle');
        tone(660, 0.09, 0.12, 0.11, 'triangle');
        tone(880, 0.19, 0.2, 0.12, 'triangle');
      } else if (type === 'win') {
        [523, 659, 784, 1046].forEach((freq, index) => {
          tone(freq, index * 0.13, 0.3, 0.13, 'triangle');
        });
      }
    } catch {
      /* audio bloqueado por el navegador */
    }
  }, [muted]);
}

/* ---------- utilidades de interfaz ---------- */

function useCountdown(room) {
  const [, force] = useState(0);
  const offset = useMemo(() => (room?.serverNow ? room.serverNow - Date.now() : 0), [room?.serverNow]);

  useEffect(() => {
    if (!room?.endsAt) return;
    const id = setInterval(() => force(tick => tick + 1), 100);
    return () => clearInterval(id);
  }, [room?.endsAt]);

  const ms = room?.endsAt ? Math.max(0, room.endsAt - (Date.now() + offset)) : 0;
  const total = room?.durationMs || 1;
  return { ms, sec: Math.ceil(ms / 1000), progress: Math.max(0, Math.min(1, ms / total)) };
}

function Starfield() {
  return (
    <>
      <div className="sky sky-a" aria-hidden="true" />
      <div className="sky sky-b" aria-hidden="true" />
    </>
  );
}

function Toasts({ items }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map(item => <div className="toast" key={item.id}>{item.text}</div>)}
    </div>
  );
}

function Confetti() {
  const pieces = useMemo(() => Array.from({ length: 44 }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 2.6 + Math.random() * 2.8,
    color: ['#3fe3c0', '#ffd166', '#bd8cff', '#ff7ad9', '#6fa8ff'][index % 5],
    rotate: Math.random() * 360
  })), []);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map(piece => (
        <span
          key={piece.id}
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            background: piece.color,
            transform: `rotate(${piece.rotate}deg)`
          }}
        />
      ))}
    </div>
  );
}

function Countdown({ sec, progress, size = 96 }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className={`countdown ${sec <= 5 ? 'urgent' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-bg" cx="50" cy="50" r={radius} />
        <circle
          className="ring-fg"
          cx="50"
          cy="50"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <div className="countdown-text"><b>{sec}</b><small>seg</small></div>
    </div>
  );
}

function Hearts({ hearts, small = false }) {
  return (
    <div className={`hearts ${small ? 'small' : ''}`} aria-label={`${hearts} corazones`}>
      {[0, 1, 2].map(index => (
        <span key={index} className={index < hearts ? 'on' : 'off'}>♥</span>
      ))}
    </div>
  );
}

function Logo({ compact = false }) {
  return (
    <div className={`logo ${compact ? 'compact' : ''}`}>
      <span className="logo-mark">⧖</span>
      <span className="logo-text"><b>TIME WARRIORS</b><small>PORTAL RUSH</small></span>
    </div>
  );
}

function Topbar({ code, connected, muted, toggleMute, onLeave, children }) {
  return (
    <header className="topbar">
      <Logo />
      {code && <span className="code-badge">SALA <b>{code}</b></span>}
      {children}
      <div className="topbar-actions">
        <span className={`conn ${connected ? 'on' : 'off'}`}>
          <i /><span>{connected ? 'En línea' : 'Reconectando'}</span>
        </span>
        <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'} title={muted ? 'Activar sonido' : 'Silenciar'}>
          {muted ? '🔇' : '🔊'}
        </button>
        {onLeave && <button className="btn btn-ghost btn-sm" onClick={onLeave}>Salir</button>}
      </div>
    </header>
  );
}

/* ---------- pantallas de inicio ---------- */

function Home({ connected, muted, toggleMute, onCreate, onJoin }) {
  return (
    <main className="home">
      <header className="home-nav">
        <Logo />
        <div className="home-nav-actions">
          <span className={`conn ${connected ? 'on' : 'off'}`}><i /><span>{connected ? 'Servidor conectado' : 'Conectando…'}</span></span>
          <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>{muted ? '🔇' : '🔊'}</button>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">ENGLISH FINAL PROJECT · LIVE CLASS GAME</p>
          <h1>PORTAL<br /><em>RUSH.</em></h1>
          <p className="lead">
            Una carrera en vivo para salvar la línea del tiempo. Compitan por equipos,
            respondan retos de <b>Present Perfect</b> y <b>Simple Past</b>, y protejan sus corazones.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onCreate}>Crear sala de clase →</button>
            <button className="btn btn-outline btn-lg" onClick={onJoin}>Tengo un código</button>
          </div>
          <div className="chips">
            <span>⚡ Competencia en vivo</span>
            <span>♥ 3 vidas por equipo</span>
            <span>🎤 Reto oral</span>
            <span>📱 Entra con QR</span>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="orbit orbit-a" />
          <div className="orbit orbit-b" />
          <div className="orbit orbit-c" />
          <img src={ship} alt="" />
          <span className="spark spark-a">✦</span>
          <span className="spark spark-b">✧</span>
          <span className="spark spark-c">✦</span>
        </div>
      </section>

      <section className="steps">
        <article className="step">
          <span className="step-num">01</span>
          <h3>Crea y proyecta</h3>
          <p>El líder abre la sala y muestra el código QR. Todos entran desde el celular en segundos.</p>
        </article>
        <article className="step">
          <span className="step-num">02</span>
          <h3>Corre y responde</h3>
          <p>Cada respuesta correcta suma 100 XP y mueve la nave del equipo hacia el portal.</p>
        </article>
        <article className="step">
          <span className="step-num">03</span>
          <h3>Defiende corazones</h3>
          <p>El equipo con menos XP enfrenta un reto oral. Si no lo logra, pierde un corazón.</p>
        </article>
      </section>

      <section className="grammar-strip">
        <div>
          <span className="eyebrow">FOCO GRAMATICAL</span>
          <p><b>Present Perfect</b> para experiencias y acciones conectadas al presente. <b>Simple Past</b> para momentos terminados.</p>
        </div>
        <div className="grammar-tags">
          <span>ever / never</span>
          <span>already / yet</span>
          <span>since / for</span>
          <span>yesterday / last…</span>
        </div>
      </section>

      <footer className="home-footer">
        <span>⧖ Time Warriors · Portal Rush</span>
        <span>Solo se guardan alias y puntajes durante la partida.</span>
      </footer>
    </main>
  );
}

function SetupShell({ children, onBack, tag, title, subtitle, artSide }) {
  return (
    <main className="setup">
      <header className="setup-nav">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Volver</button>
        <Logo compact />
      </header>
      <section className="setup-card">
        <div className="setup-copy">
          <p className="eyebrow">{tag}</p>
          <h1>{title}</h1>
          {subtitle && <p className="lead small">{subtitle}</p>}
          {children}
        </div>
        {artSide && <div className="setup-art" aria-hidden="true"><img src={ship} alt="" /><span>✦</span></div>}
      </section>
    </main>
  );
}

function HostSetup({ profile, setProfile, onCreate, onBack }) {
  const [rounds, setRounds] = useState(5);
  const [duration, setDuration] = useState(20);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = event => {
    event.preventDefault();
    if (profile.name.trim().length < 2) {
      setError('Escribe tu nombre (mínimo 2 letras).');
      return;
    }
    setError('');
    setBusy(true);
    onCreate({ maxRounds: rounds, durationSec: duration }, () => setBusy(false));
  };

  return (
    <SetupShell
      onBack={onBack}
      tag="PANTALLA DEL PROFESOR"
      title={<>Crea la <em>batalla.</em></>}
      subtitle="Esta pantalla controla las rondas, el tiempo y los retos orales. Proyéctala para toda la clase."
      artSide
    >
      <form onSubmit={submit} className="form">
        <label>
          Tu nombre
          <input
            value={profile.name}
            maxLength={24}
            onChange={event => setProfile({ ...profile, name: event.target.value })}
            placeholder="Ej. Profe Ana"
            autoComplete="name"
          />
        </label>

        <fieldset>
          <legend>Número de rondas</legend>
          <div className="choice-row">
            {[5, 7, 10].map(value => (
              <button type="button" key={value} className={`choice ${rounds === value ? 'selected' : ''}`} onClick={() => setRounds(value)}>
                {value} rondas
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Tiempo por ronda</legend>
          <div className="choice-row">
            {[15, 20, 30].map(value => (
              <button type="button" key={value} className={`choice ${duration === value ? 'selected' : ''}`} onClick={() => setDuration(value)}>
                {value} seg
              </button>
            ))}
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
          {busy ? 'Generando sala…' : 'Generar sala y QR →'}
        </button>
        <p className="form-note">5 escuadrones · 3 corazones por equipo · respuestas de 100 XP</p>
      </form>
    </SetupShell>
  );
}

function JoinSetup({ profile, setProfile, onJoin, onBack }) {
  const [code, setCode] = useState(() => (new URLSearchParams(location.search).get('join') || '').toUpperCase().slice(0, 5));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = event => {
    event.preventDefault();
    if (code.trim().length < 4) {
      setError('Escribe el código de 5 caracteres que aparece en pantalla.');
      return;
    }
    if (profile.name.trim().length < 2) {
      setError('Escribe tu nombre (mínimo 2 letras).');
      return;
    }
    setError('');
    setBusy(true);
    onJoin(code.trim().toUpperCase(), () => setBusy(false));
  };

  return (
    <SetupShell
      onBack={onBack}
      tag="UNIRSE A LA MISIÓN"
      title={<>Elige tu <em>escuadrón.</em></>}
      subtitle="Escanea el QR o escribe el código de la sala. Después elige el equipo con el que vas a competir."
    >
      <form onSubmit={submit} className="form">
        <label>
          Código de sala
          <input
            className="code-input"
            value={code}
            maxLength={5}
            onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="ABCDE"
            autoComplete="off"
            spellCheck="false"
            inputMode="text"
          />
        </label>

        <label>
          Tu nombre
          <input
            value={profile.name}
            maxLength={24}
            onChange={event => setProfile({ ...profile, name: event.target.value })}
            placeholder="Ej. Mateo"
            autoComplete="name"
          />
        </label>

        <fieldset>
          <legend>Tu equipo</legend>
          <div className="team-grid">
            {TEAM_IDS.map(id => {
              const team = TEAMS[id];
              return (
                <button
                  type="button"
                  key={id}
                  className={`team-option ${profile.team === id ? 'selected' : ''}`}
                  style={{ '--team': team.color }}
                  onClick={() => setProfile({ ...profile, team: id })}
                  aria-pressed={profile.team === id}
                >
                  <span className="team-icon">{team.icon}</span>
                  <b>{team.label}</b>
                  <small>{team.trait}</small>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar a la carrera →'}
        </button>
      </form>
    </SetupShell>
  );
}

/* ---------- pista y paneles ---------- */

function RaceTrack({ teams }) {
  const best = Math.max(1, ...TEAM_IDS.map(id => teams[id].score));
  return (
    <section className="race" aria-label="Pista de la carrera">
      <div className="race-head">
        <span className="eyebrow">PISTA TEMPORAL</span>
        <span className="race-goal">META <b>⌁</b></span>
      </div>
      <div className="lanes">
        {TEAM_IDS.map(id => {
          const team = TEAMS[id];
          const score = teams[id].score;
          const percent = score > 0 ? 5 + 85 * (score / best) : 1.5;
          const shipFilter = `${team.filter === 'none' ? '' : `${team.filter} `}drop-shadow(0 0 9px ${team.color})`;
          return (
            <div className="lane" key={id} style={{ '--team': team.color }}>
              <div className="lane-label">
                <span className="team-icon">{team.icon}</span>
                <b>{team.label}</b>
                <small>{score} XP</small>
              </div>
              <div className="lane-track">
                <span className="lane-glow" style={{ width: `${percent}%` }} />
                <img
                  className="lane-ship"
                  src={ship}
                  alt=""
                  style={{ left: `calc(${percent}% - 23px)`, filter: shipFilter }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="portal" aria-hidden="true"><span>⌁</span><small>PORTAL</small></div>
    </section>
  );
}

function QrPanel({ room }) {
  const [copied, setCopied] = useState(false);
  const [host, setHost] = useState(location.host);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);

  useEffect(() => {
    if (!isLocal) return undefined;
    let alive = true;
    fetch('/api/network')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        const ip = data?.ips?.[0];
        if (alive && ip) setHost(`${ip}${location.port ? `:${location.port}` : ''}`);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [isLocal]);

  const link = `${location.protocol}//${host}${location.pathname}?join=${room.code}`;
  const onLan = isLocal && host !== location.host;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="qr-panel">
      <div className="qr-frame">
        <QRCodeSVG value={link} size={118} bgColor="#f4f7ff" fgColor="#0a1122" level="M" />
      </div>
      <div className="qr-copy">
        <span className="eyebrow">CÓDIGO DE SALA</span>
        <strong className="room-code">{room.code}</strong>
        <button className="btn btn-outline btn-sm" onClick={copy}>{copied ? '✓ Enlace copiado' : 'Copiar enlace'}</button>
        {onLan && (
          <small className="qr-hint" title={link}>
            📱 Celulares: {host}
          </small>
        )}
      </div>
    </div>
  );
}

function RoundDots({ room }) {
  return (
    <div className="round-dots">
      <div className="side-head"><span className="eyebrow">PROGRESO</span><span>Ronda {Math.min(room.round, room.maxRounds)}/{room.maxRounds}</span></div>
      <div className="dots">
        {Array.from({ length: room.maxRounds }, (_, index) => (
          <span
            key={index}
            className={index + 1 < room.round ? 'done' : index + 1 === room.round ? 'current' : ''}
          />
        ))}
      </div>
    </div>
  );
}

function TeamList({ room, onHeart }) {
  const showHearts = room.phase === 'oral';
  return (
    <div className="team-list">
      <div className="side-head"><span className="eyebrow">ESCUADRÓNES</span><span>{room.connectedPlayers} en línea</span></div>
      {TEAM_IDS.map(id => {
        const team = TEAMS[id];
        const data = room.teams[id];
        const count = room.players.filter(player => player.team === id && player.connected).length;
        return (
          <div className="mini-team" key={id} style={{ '--team': team.color }}>
            <span className="team-icon">{team.icon}</span>
            <div className="mini-name">
              <b>{team.label}</b>
              <small>{count} {count === 1 ? 'jugador' : 'jugadores'}</small>
            </div>
            <div className="mini-score">{data.score}<small>XP</small></div>
            <div className="mini-hearts">
              <Hearts hearts={data.hearts} small />
              {showHearts && (
                <div className="heart-buttons">
                  <button onClick={() => onHeart(id, -1)} aria-label={`Quitar un corazón a ${team.label}`}>−</button>
                  <button onClick={() => onHeart(id, 1)} aria-label={`Añadir un corazón a ${team.label}`}>+</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayersPanel({ room }) {
  const connected = room.players.filter(player => player.connected);
  return (
    <div className="players-panel">
      <div className="side-head"><span className="eyebrow">GUERREROS</span><span>{connected.length} conectados</span></div>
      {connected.length === 0 ? (
        <p className="muted small">Esperando jugadores. Comparte el QR o el código.</p>
      ) : (
        <div className="player-groups">
          {TEAM_IDS.map(id => {
            const members = connected.filter(player => player.team === id);
            if (!members.length) return null;
            return (
              <div className="player-group" key={id}>
                <span style={{ color: TEAMS[id].color }}>{TEAMS[id].icon} {TEAMS[id].label}</span>
                <div>
                  {members.map(player => (
                    <span className="player-chip" key={player.clientId}>
                      {player.name}
                      {room.phase === 'race' && (player.answered ? <i className="answered">✓</i> : <i className="pending">…</i>)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RevealCard({ reveal }) {
  if (!reveal) return null;
  return (
    <div className="reveal">
      <span className="eyebrow">RESPUESTA CORRECTA</span>
      <strong>{reveal.correct}</strong>
      <p>{reveal.note}</p>
    </div>
  );
}

/* ---------- paneles del anfitrión ---------- */

function LobbyDeck({ room, act }) {
  const seconds = Math.round(room.durationMs / 1000);
  return (
    <div className="deck lobby">
      <div className="deck-head">
        <div>
          <span className="eyebrow">{room.round === 0 ? 'SALA DE ESPERA' : 'SIGUIENTE RONDA'}</span>
          <h2>{room.round === 0 ? 'Todo listo para empezar' : `Ronda ${room.round + 1} preparada`}</h2>
        </div>
      </div>
      <p className="deck-copy">
        {room.connectedPlayers === 0
          ? 'Aún no hay jugadores. Puedes iniciar en modo prueba para ver la carrera, o esperar a que entren con el QR.'
          : `${room.connectedPlayers} guerreros conectados. Cuando todos estén listos, inicia la ronda.`}
      </p>
      <div className="hint-row">
        <span>⏱ {seconds}s por ronda</span>
        <span>🏁 {room.maxRounds} rondas</span>
        <span>♥ 3 vidas</span>
        <span>⚡ 100 XP por acierto</span>
      </div>
      <button className="btn btn-primary btn-xl" onClick={() => act('round:start')}>
        ⚡ Iniciar ronda {room.round + 1}
      </button>
    </div>
  );
}

function RaceDeck({ room, act, countdown }) {
  const counts = room.answered || {};
  const totals = room.totals || {};
  return (
    <div className="deck live">
      <div className="deck-head race-deck-head">
        <div>
          <span className="eyebrow">RONDA {room.round}/{room.maxRounds} EN CURSO</span>
          <h2>{room.prompt?.text}</h2>
        </div>
        <Countdown sec={countdown.sec} progress={countdown.progress} />
      </div>

      <div className="answer-key">
        {room.prompt?.answers.map(answer => (
          <span key={answer} className={room.prompt.correct === answer ? 'right' : ''}>
            {room.prompt.correct === answer && '✓ '}{answer}
          </span>
        ))}
      </div>

      <p className="deck-copy">La ronda se cierra sola al llegar a cero. Respuestas recibidas por equipo:</p>
      <div className="answered-grid">
        {TEAM_IDS.map(id => (
          <div className="answered" key={id} style={{ '--team': TEAMS[id].color }}>
            <span>{TEAMS[id].icon} {TEAMS[id].label}</span>
            <b>{counts[id] || 0}/{totals[id] || 0}</b>
          </div>
        ))}
      </div>

      <button className="btn btn-outline" onClick={() => act('round:close')}>Cerrar ronda ahora</button>
    </div>
  );
}

function OralDeck({ room, act }) {
  const reveal = room.reveal;
  const challenge = reveal?.oralChallenge;
  const tied = !room.oralTeam;

  return (
    <div className="deck oral">
      <div className="deck-head">
        <div>
          <span className="eyebrow">RETO ORAL · RONDA {room.round}</span>
          <h2>{tied ? '¡Empate perfecto!' : `Turno de ${room.oralTeam}`}</h2>
        </div>
        <span className="oral-badge">🎤</span>
      </div>

      <RevealCard reveal={reveal} />

      {reveal?.counts && (
        <div className="round-stats">
          {TEAM_IDS.map(id => {
            const data = reveal.counts[id];
            if (!data || data.total === 0) return null;
            return (
              <span key={id} style={{ '--team': TEAMS[id].color }}>
                {TEAMS[id].icon} {data.correct}/{data.total} correctas
              </span>
            );
          })}
        </div>
      )}

      {tied ? (
        <>
          <p className="deck-copy">Ningún equipo pierde corazón en esta ronda. Continúen a la siguiente.</p>
          <button className="btn btn-primary btn-lg" onClick={() => act('oral:judge', { success: true })}>Continuar →</button>
        </>
      ) : (
        <>
          <div className="challenge">
            <span className="eyebrow">PREGUNTA PARA {room.oralTeam?.toUpperCase()}</span>
            <h3>{challenge?.question}</h3>
            <p>{challenge?.task}</p>
            <div className="example">
              <small>EJEMPLO</small>
              <b>“{challenge?.example}”</b>
            </div>
          </div>
          <p className="deck-copy">
            Escucha a todos los integrantes de <b>{room.oralTeam}</b>. Si cumplen el reto, conservan sus corazones;
            si no, pierden uno. Puedes ajustar corazones manualmente en el panel lateral.
          </p>
          <div className="judge-actions">
            <button className="btn btn-primary btn-lg" onClick={() => act('oral:judge', { success: true })}>
              ✓ Lo lograron
            </button>
            <button className="btn btn-danger btn-lg" onClick={() => act('oral:judge', { success: false })}>
              ✕ Pierden un corazón
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function HostRoom({ room, act, onLeave, connected, muted, toggleMute }) {
  const countdown = useCountdown(room);
  const topTeams = [...TEAM_IDS].sort((a, b) => room.teams[b].score - room.teams[a].score);
  const leader = topTeams[0];
  const leaderData = room.teams[leader];

  return (
    <main className="host">
      <Topbar code={room.code} connected={connected} muted={muted} toggleMute={toggleMute} onLeave={onLeave} />

      <div className="host-summary">
        <div>
          <span className="eyebrow">CONTROL DE BATALLA</span>
          {room.round === 0
            ? <h1>Sala de <em>espera</em></h1>
            : <h1>Ronda <em>{Math.min(room.round, room.maxRounds)}</em> de {room.maxRounds}</h1>}
        </div>
        <div className="summary-chips">
          <span>👑 Líder: <b style={{ color: TEAMS[leader].color }}>{TEAMS[leader].icon} {TEAMS[leader].label}</b> · {leaderData.score} XP</span>
          <span>⏱ {Math.round(room.durationMs / 1000)}s por ronda</span>
          <span>♥ {leaderData.hearts} corazones del líder</span>
        </div>
      </div>

      <div className="host-grid">
        <section className="host-main">
          <RaceTrack teams={room.teams} />

          {room.phase === 'lobby' && <LobbyDeck room={room} act={act} />}
          {room.phase === 'race' && <RaceDeck room={room} act={act} countdown={countdown} />}
          {room.phase === 'oral' && <OralDeck room={room} act={act} />}
        </section>

        <aside className="host-side">
          <QrPanel room={room} />
          <RoundDots room={room} />
          <TeamList room={room} onHeart={(team, delta) => act('host:heart', { team, delta })} />
          <PlayersPanel room={room} />
          <button
            className="btn btn-ghost btn-sm finish-btn"
            onClick={() => {
              if (window.confirm('¿Terminar la partida y mostrar el podio?')) act('host:end');
            }}
          >
            Terminar partida
          </button>
        </aside>
      </div>
    </main>
  );
}

/* ---------- pantalla del jugador ---------- */

function PlayerRoom({ room, profile, clientId, act, play, onLeave, connected, muted, toggleMute }) {
  const countdown = useCountdown(room);
  const me = room.players.find(player => player.clientId === clientId);
  const myTeam = me?.team || profile.team;
  const team = TEAMS[myTeam] || TEAMS.Nova;
  const data = room.teams[myTeam] || room.teams.Nova;
  const [result, setResult] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    setResult(null);
    setPending(null);
  }, [room.round, room.phase]);

  const answer = choice => {
    if (pending || me?.answered || result || countdown.sec === 0) return;
    setPending(choice);
    act('round:answer', { answer: choice }, response => {
      setPending(null);
      if (!response?.ok) return;
      setResult({ choice, correct: response.correct, note: response.note });
      play(response.correct ? 'correct' : 'wrong');
      try { navigator.vibrate?.(response.correct ? [35, 50, 70] : 120); } catch { /* sin vibración */ }
    });
  };

  const showAnswer = me?.answered || Boolean(result);

  return (
    <main className="player-shell" style={{ '--team': team.color }}>
      <Topbar code={room.code} connected={connected} muted={muted} toggleMute={toggleMute} onLeave={onLeave} />

      <section className="player-card">
        <div className="player-head">
          <span className="team-icon big">{team.icon}</span>
          <div className="player-team">
            <small>ESCUADRÓN</small>
            <b>{team.label}</b>
          </div>
          <div className="player-vitals">
            <Hearts hearts={data.hearts} />
            <div className="xp-badge">{data.score}<small>XP</small></div>
          </div>
        </div>

        {room.phase === 'lobby' && (
          <div className="player-body">
            <span className="eyebrow">SALA DE ESPERA</span>
            <h2>Hola, {me?.name || profile.name}. Prepárate.</h2>
            <p className="muted">
              El anfitrión iniciará la ronda. Responde rápido: cada acierto da <b>100 XP</b> a tu equipo.
            </p>
            <ul className="tips">
              <li>Lee la oración y elige la opción correcta.</li>
              <li>Solo tienes una respuesta por ronda.</li>
              <li>Si tu equipo queda último, enfrenta un reto oral.</li>
            </ul>
            <div className="roster">
              <span className="eyebrow">TU EQUIPO</span>
              <div>
                {room.players.filter(player => player.team === myTeam).map(player => (
                  <span className="player-chip" key={player.clientId}>{player.name}</span>
                ))}
                {room.players.filter(player => player.team === myTeam).length === 0 && <span className="muted small">Aún no hay otros jugadores.</span>}
              </div>
            </div>
          </div>
        )}

        {room.phase === 'race' && (
          <div className="player-body">
            <div className="player-race-head">
              <span className="eyebrow">RONDA {room.round}/{room.maxRounds}</span>
              <span className={`mini-timer ${countdown.sec <= 5 ? 'urgent' : ''}`}>{countdown.sec}s</span>
            </div>
            <div className="timebar"><span style={{ width: `${countdown.progress * 100}%` }} /></div>

            <h2 className="question-text">{room.prompt?.text}</h2>

            <div className="answers">
              {room.prompt?.answers.map((choice, index) => (
                <button
                  key={choice}
                  className={`answer ${result?.choice === choice ? 'chosen' : ''}`}
                  disabled={showAnswer || Boolean(pending) || countdown.sec === 0}
                  onClick={() => answer(choice)}
                >
                  <span className="option-key">{'ABCD'[index]}</span>
                  <span>{choice}</span>
                </button>
              ))}
            </div>

            {result && (
              <div className={`result ${result.correct ? 'good' : 'bad'}`} role="status">
                <b>{result.correct ? '✓ ¡Correcto! +100 XP para tu equipo' : '✕ No es la opción correcta'}</b>
                <p>{result.note}</p>
              </div>
            )}

            {!result && (me?.answered || pending) && (
              <div className="result neutral" role="status">
                <b>{pending ? 'Enviando respuesta…' : 'Respuesta enviada'}</b>
                <p>Espera el cierre de la ronda. Mira la pantalla principal para ver avanzar tu nave.</p>
              </div>
            )}
          </div>
        )}

        {room.phase === 'oral' && (
          <div className="player-body">
            <span className="eyebrow">RONDA TERMINADA · RETO ORAL</span>
            {room.oralTeam === myTeam ? (
              <>
                <h2>¡Defiendan sus corazones!</h2>
                <p className="muted">Todo el equipo debe participar. El profe decide si conservan sus vidas.</p>
                <div className="challenge compact">
                  <h3>{room.reveal?.oralChallenge?.question}</h3>
                  <p>{room.reveal?.oralChallenge?.task}</p>
                  <div className="example">
                    <small>EJEMPLO</small>
                    <b>“{room.reveal?.oralChallenge?.example}”</b>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2>{room.oralTeam ? `Reto de ${room.oralTeam}` : '¡Empate perfecto!'}</h2>
                <p className="muted">
                  {room.oralTeam
                    ? `Mira la pantalla principal: ${room.oralTeam} está defendiendo sus corazones.`
                    : 'Ningún equipo pierde corazón en esta ronda. Ya viene la siguiente.'}
                </p>
              </>
            )}
            <RevealCard reveal={room.reveal} />
          </div>
        )}
      </section>

      <p className="player-footer">
        {connected ? 'Conexión estable · tus respuestas se guardan al instante' : 'Reconectando con la sala…'}
      </p>
    </main>
  );
}

/* ---------- final ---------- */

function EndScreen({ room, onLeave }) {
  const ranked = useMemo(
    () => Object.entries(room.teams).sort((a, b) => b[1].score - a[1].score || b[1].hearts - a[1].hearts),
    [room.teams]
  );
  const champion = ranked[0];
  const championTeam = TEAMS[champion[0]];
  const totals = room.history.reduce((acc, item) => {
    Object.values(item.counts || {}).forEach(count => {
      acc.correct += count.correct;
      acc.total += count.total;
    });
    return acc;
  }, { correct: 0, total: 0 });

  return (
    <main className="end">
      <Confetti />
      <header className="end-nav">
        <button className="btn btn-ghost btn-sm" onClick={onLeave}>← Salir</button>
        <Logo compact />
      </header>

      <p className="eyebrow">TORNEO TERMINADO</p>
      <h1>Portal Rush<br /><em>Champions</em></h1>
      <p className="end-sub">
        {room.closedByHost
          ? 'El anfitrión cerró la sala.'
          : `${room.round} ${room.round === 1 ? 'ronda completada' : 'rondas completadas'} · ${totals.correct} ${totals.correct === 1 ? 'respuesta correcta' : 'respuestas correctas'} de ${totals.total}`}
      </p>

      <div className="champion" style={{ '--team': championTeam.color }}>
        <span className="champion-icon">{championTeam.icon}</span>
        <div>
          <small>CAMPEÓN</small>
          <strong>{championTeam.label}</strong>
          <span>{champion[1].score} XP · {champion[1].hearts} corazones</span>
        </div>
        <span className="champion-crown">♛</span>
      </div>

      <div className="ranking">
        {ranked.map(([id, data], index) => (
          <div className="rank-row" key={id} style={{ '--team': TEAMS[id].color }}>
            <span className="rank-pos">{['🥇', '🥈', '🥉'][index] || `#${index + 1}`}</span>
            <span className="team-icon">{TEAMS[id].icon}</span>
            <b>{TEAMS[id].label}</b>
            <div className="rank-bar">
              <span style={{ width: `${Math.max(4, (data.score / Math.max(1, champion[1].score)) * 100)}%` }} />
            </div>
            <strong>{data.score} XP</strong>
            <Hearts hearts={data.hearts} small />
          </div>
        ))}
      </div>

      <button className="btn btn-primary btn-lg" onClick={onLeave}>
        Volver al inicio
      </button>
    </main>
  );
}

/* ---------- app ---------- */

function App() {
  const [connected, setConnected] = useState(false);
  const [offline, setOffline] = useState(false);
  const [screen, setScreen] = useState(() => (new URLSearchParams(location.search).get('join') ? 'join' : 'home'));
  const [role, setRole] = useState(null);
  const [room, setRoom] = useState(null);
  const [profile, setProfile] = useState(() => readJSON(PROFILE_KEY, { name: '', team: 'Nova' }));
  const [muted, setMuted] = useState(() => readJSON(MUTE_KEY, false) === true);
  const [toasts, setToasts] = useState([]);
  const clientIdRef = useRef(getClientId());
  const toastId = useRef(0);
  const previousPhase = useRef(null);
  const leavingRef = useRef(false);
  const play = useSound(muted);

  const toast = useCallback(text => {
    const id = ++toastId.current;
    setToasts(items => [...items, { id, text }]);
    setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 4200);
  }, []);

  useEffect(() => {
    writeJSON(PROFILE_KEY, profile);
  }, [profile]);

  useEffect(() => {
    writeJSON(MUTE_KEY, muted);
  }, [muted]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  useEffect(() => {
    if (connected) {
      setOffline(false);
      return undefined;
    }
    const timer = setTimeout(() => setOffline(true), 4000);
    return () => clearTimeout(timer);
  }, [connected]);

  useEffect(() => {
    const retry = () => socket.connect();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, []);

  useEffect(() => {
    const onUpdate = snapshot => {
      if (leavingRef.current) return;
      setRoom(snapshot);
      setRole(current => current || (snapshot.host ? 'host' : 'player'));
      setScreen('room');
    };
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:update', onUpdate);
    socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:update', onUpdate);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!connected) return;
    const saved = readJSON(SESSION_KEY);
    if (!saved?.code) return;
    socket.timeout(8000).emit('room:resume', {
      code: saved.code,
      hostToken: saved.hostToken,
      clientId: clientIdRef.current,
      name: saved.name,
      team: saved.team
    }, (error, response) => {
      if (error || !response?.ok) {
        writeJSON(SESSION_KEY, null);
        setRoom(null);
        setRole(null);
        setScreen('home');
        toast('La sala anterior ya no está disponible.');
        return;
      }
      leavingRef.current = false;
      clearJoinParam();
      setRole(response.host ? 'host' : 'player');
      setRoom(response.room);
      setScreen('room');
    });
  }, [connected]);

  useEffect(() => {
    if (!room) { previousPhase.current = null; return; }
    const key = `${room.phase}:${room.round}`;
    if (previousPhase.current !== key) {
      if (previousPhase.current && room.phase === 'race') play('start');
      if (previousPhase.current && room.phase === 'ended') play('win');
      previousPhase.current = key;
    }
  }, [room, play]);

  const ensureOnline = () => {
    if (socket.connected) return true;
    toast('No hay conexión con el servidor. Comprueba que siga encendido y reintenta.');
    socket.connect();
    return false;
  };

  const createRoom = (options, done) => {
    if (!ensureOnline()) {
      done?.();
      return;
    }
    socket.timeout(9000).emit('room:create', { hostName: profile.name, ...options }, (error, response) => {
      done?.();
      if (error) {
        toast('El servidor tardó demasiado en responder. Revisa que siga encendido e inténtalo otra vez.');
        return;
      }
      if (!response?.ok) {
        toast(response?.error || 'No se pudo crear la sala. Revisa tu conexión.');
        return;
      }
      writeJSON(SESSION_KEY, { role: 'host', code: response.room.code, hostToken: response.hostToken });
      leavingRef.current = false;
      clearJoinParam();
      setRole('host');
      setRoom(response.room);
      setScreen('room');
    });
  };

  const joinRoom = (code, done) => {
    if (!ensureOnline()) {
      done?.();
      return;
    }
    socket.timeout(9000).emit('room:join', {
      code,
      name: profile.name,
      team: profile.team,
      clientId: clientIdRef.current
    }, (error, response) => {
      done?.();
      if (error) {
        toast('El servidor tardó demasiado en responder. Revisa que siga encendido e inténtalo otra vez.');
        return;
      }
      if (!response?.ok) {
        toast(response?.error || 'No pudimos unirte a la sala.');
        return;
      }
      writeJSON(SESSION_KEY, {
        role: 'player',
        code: response.room.code,
        name: profile.name,
        team: profile.team,
        clientId: clientIdRef.current
      });
      leavingRef.current = false;
      clearJoinParam();
      setRole('player');
      setRoom(response.room);
      setScreen('room');
    });
  };

  const act = (event, data = {}, done) => {
    if (!room) return;
    if (!ensureOnline()) {
      done?.({ ok: false });
      return;
    }
    socket.timeout(9000).emit(event, { code: room.code, ...data }, (error, response) => {
      if (error) {
        toast('El servidor no respondió. Intenta de nuevo.');
        done?.({ ok: false });
        return;
      }
      if (response?.error) toast(response.error);
      done?.(response);
    });
  };

  const leave = () => {
    if (room) socket.emit('room:leave', { code: room.code });
    leavingRef.current = true;
    writeJSON(SESSION_KEY, null);
    setRoom(null);
    setRole(null);
    setScreen('home');
  };

  let content;
  if (room && room.phase === 'ended') {
    content = <EndScreen room={room} onLeave={leave} />;
  } else if (room && role === 'host') {
    content = (
      <HostRoom
        room={room}
        act={act}
        onLeave={leave}
        connected={connected}
        muted={muted}
        toggleMute={() => setMuted(value => !value)}
      />
    );
  } else if (room && role === 'player') {
    content = (
      <PlayerRoom
        room={room}
        profile={profile}
        clientId={clientIdRef.current}
        act={act}
        play={play}
        onLeave={leave}
        connected={connected}
        muted={muted}
        toggleMute={() => setMuted(value => !value)}
      />
    );
  } else if (screen === 'host') {
    content = (
      <HostSetup
        profile={profile}
        setProfile={setProfile}
        onCreate={createRoom}
        onBack={() => setScreen('home')}
      />
    );
  } else if (screen === 'join') {
    content = (
      <JoinSetup
        profile={profile}
        setProfile={setProfile}
        onJoin={joinRoom}
        onBack={() => setScreen('home')}
      />
    );
  } else {
    content = (
      <Home
        connected={connected}
        muted={muted}
        toggleMute={() => setMuted(value => !value)}
        onCreate={() => setScreen('host')}
        onJoin={() => setScreen('join')}
      />
    );
  }

  return (
    <>
      <Starfield />
      {offline && (
        <div className="offline-bar" role="alert">
          <span>⚠ Sin conexión con el servidor. Comprueba que siga encendido.</span>
          <button className="btn btn-ghost btn-sm" onClick={() => { setOffline(false); socket.connect(); }}>
            Reintentar
          </button>
        </div>
      )}
      {content}
      <Toasts items={toasts} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);
