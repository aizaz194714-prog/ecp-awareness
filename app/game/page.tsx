'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { api, loadProgress } from '@/lib/voter-api';
import styles from './game.module.css';

const WIDTH = 1102, HEIGHT = 1426, PLAYER_RADIUS = 8, SPEED = 215, TRIGGER_RADIUS = 35;
const START = { x: 235, y: 362 };
const CHECKPOINTS = [
  { name: 'Home / CNIC', x: 450, y: 320, text: 'Your CNIC helps polling staff verify your identity.', next: 'Next: Reach your assigned polling station.' },
  { name: 'Polling Station', x: 785, y: 575, text: 'You have reached your assigned polling station.', next: 'Next: Find the Presiding Officer.' },
  { name: 'Presiding Officer', x: 790, y: 720, text: 'Polling staff verify your CNIC and voter-list entry.', next: 'Next: Receive your ballot paper.' },
  { name: 'Ballot Paper', x: 800, y: 872, text: 'Mark your choice privately on the official ballot.', next: 'Next: Place it in the ballot box.' },
  { name: 'Cast Vote', x: 790, y: 1005, text: 'You placed the ballot in the box and completed the voting journey.', next: 'Continue to the awareness quiz.' },
];
type Direction = 'up' | 'down' | 'left' | 'right';
type Overlay = { type: 'reached'; stage: number } | { type: 'completed' } | null;

export default function GamePage() {
  const router = useRouter();
  const playerRef = useRef<HTMLDivElement>(null);
  const collisionRef = useRef<Uint8ClampedArray | null>(null);
  const keysRef = useRef(new Set<Direction>());
  const engineRef = useRef({ ...START, index: 0, done: false, paused: true, ready: false });
  const [stage, setStage] = useState(0);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const positionPlayer = useCallback(() => {
    const player = playerRef.current, state = engineRef.current;
    if (player) { player.style.left = `${state.x / WIDTH * 100}%`; player.style.top = `${state.y / HEIGHT * 100}%`; }
  }, []);

  const restart = useCallback(() => {
    keysRef.current.clear();
    Object.assign(engineRef.current, { ...START, index: 0, done: false, paused: false });
    setStage(0); setOverlay(null); setError(''); positionPlayer();
  }, [positionPlayer]);

  const reachCheckpoint = useCallback(() => {
    const state = engineRef.current;
    if (state.paused || state.done || state.index >= CHECKPOINTS.length) return;
    const reachedStage = state.index + 1;
    keysRef.current.clear(); state.index = reachedStage; state.done = reachedStage === CHECKPOINTS.length; state.paused = true;
    setStage(reachedStage); setOverlay({ type: 'reached', stage: reachedStage }); setError('');
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const [{ participant }] = await Promise.all([
          loadProgress(),
          api('/activity', { method: 'POST', body: JSON.stringify({ type: 'GAME_STARTED' }) }),
        ]);
        if (cancelled) return;
        const savedStage = Math.min(5, participant.progress.gameStage ?? 0);
        const start = savedStage ? CHECKPOINTS[savedStage - 1] : START;
        Object.assign(engineRef.current, { x: start.x, y: start.y, index: savedStage, done: participant.progress.gameCompleted, paused: participant.progress.gameCompleted });
        setStage(savedStage);
        if (participant.progress.gameCompleted) setOverlay({ type: 'completed' });
        positionPlayer();
        const image = new Image();
        image.onload = () => {
          if (cancelled) return;
          const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          if (!context) { setError('Your browser could not initialize the maze.'); return; }
          context.drawImage(image, 0, 0, WIDTH, HEIGHT);
          collisionRef.current = context.getImageData(0, 0, WIDTH, HEIGHT).data;
          engineRef.current.ready = true; setLoading(false);
        };
        image.onerror = () => { if (!cancelled) setError('The maze collision map could not be loaded. Refresh to try again.'); };
        image.src = '/assets/maze-collision.png';
      } catch (error) { if (!cancelled) { setError(error instanceof Error ? error.message : 'Unable to start the maze.'); setLoading(false); } }
    }
    initialize();
    return () => { cancelled = true; };
  }, [positionPlayer]);

  useEffect(() => {
    let frame = 0, previous = performance.now();
    const wall = (x: number, y: number) => {
      const pixels = collisionRef.current;
      if (!pixels || x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return true;
      return pixels[((y | 0) * WIDTH + (x | 0)) * 4] > 180;
    };
    const canMove = (x: number, y: number) => {
      const r = PLAYER_RADIUS;
      return [[x,y],[x+r,y],[x-r,y],[x,y+r],[x,y-r],[x+r*.7,y+r*.7],[x-r*.7,y+r*.7],[x+r*.7,y-r*.7],[x-r*.7,y-r*.7]].every(([px,py]) => !wall(px,py));
    };
    const tick = (time: number) => {
      const dt = Math.min(0.035, (time - previous) / 1000); previous = time;
      const state = engineRef.current, keys = keysRef.current;
      if (state.ready && !state.paused && !state.done && keys.size) {
        let dx = 0, dy = 0; if (keys.has('left')) dx--; if (keys.has('right')) dx++; if (keys.has('up')) dy--; if (keys.has('down')) dy++;
        const length = Math.hypot(dx, dy) || 1, nx = state.x + dx / length * SPEED * dt, ny = state.y + dy / length * SPEED * dt;
        if (canMove(nx, ny)) { state.x = nx; state.y = ny; }
        else { if (canMove(nx, state.y)) state.x = nx; if (canMove(state.x, ny)) state.y = ny; }
        positionPlayer();
        const target = CHECKPOINTS[state.index];
        if (target && Math.hypot(state.x - target.x, state.y - target.y) <= TRIGGER_RADIUS) reachCheckpoint();
      }
      playerRef.current?.classList.toggle(styles.running, keys.size > 0 && !state.paused);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [positionPlayer, reachCheckpoint]);

  useEffect(() => {
    const map: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', a: 'left', s: 'down', d: 'right' };
    const key = (event: KeyboardEvent, down: boolean) => { const direction = map[event.key.length === 1 ? event.key.toLowerCase() : event.key]; if (direction) { event.preventDefault(); down ? keysRef.current.add(direction) : keysRef.current.delete(direction); } };
    const down = (event: KeyboardEvent) => key(event, true), up = (event: KeyboardEvent) => key(event, false), clear = () => keysRef.current.clear();
    addEventListener('keydown', down); addEventListener('keyup', up); addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { removeEventListener('keydown', down); removeEventListener('keyup', up); removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, []);

  const setDirection = (direction: Direction, pressed: boolean, event?: PointerEvent<HTMLButtonElement>) => { if (pressed) { event?.currentTarget.setPointerCapture(event.pointerId); keysRef.current.add(direction); } else keysRef.current.delete(direction); };
  const continueGame = async () => {
    if (!overlay || saving) return;
    if (overlay.type === 'completed') { router.push('/quiz'); return; }
    setSaving(true); setError('');
    try {
      await api('/progress/game-stage', { method: 'POST', body: JSON.stringify({ stage: overlay.stage }) });
      if (overlay.stage === 5) { await api('/progress/game', { method: 'POST' }); router.push('/quiz'); return; }
      engineRef.current.paused = false; setOverlay(null);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save this checkpoint.'); }
    finally { setSaving(false); }
  };
  const current = CHECKPOINTS[Math.min(stage, 4)];

  return <AuthGate><main className={styles.gameApp}>
    <header className={styles.header}><div className={styles.headerRow}><Link className="link" href="/">← Journey</Link><h1>Voting Journey</h1><button className="link" onClick={restart}>Restart</button></div><div className={styles.stagePanel}><span className="eyebrow">{stage === 5 ? 'Journey complete' : `Stage ${stage + 1} of 5`}</span><strong>{stage === 5 ? 'ALL FIVE STAGES REACHED' : current.name.toUpperCase()}</strong><div className={styles.dots} aria-label={`${stage} of 5 checkpoints complete`}>{CHECKPOINTS.map((_, index) => <span className={`${styles.dot} ${index < stage ? styles.dotDone : index === stage ? styles.dotCurrent : ''}`} key={index} />)}</div></div></header>
    <section className={styles.boardSpace}><div className={styles.maze}><img className={styles.background} src="/assets/official-page-7.png" alt="Election Commission of Pakistan voting maze" draggable={false} />{CHECKPOINTS.map((checkpoint, index) => <div className={`${styles.checkpointMarker} ${index < stage ? styles.markerDone : index === stage && stage < 5 ? styles.markerCurrent : styles.markerLocked}`} style={{ left: `${checkpoint.x / WIDTH * 100}%`, top: `${checkpoint.y / HEIGHT * 100}%` }} aria-hidden="true" key={checkpoint.name}>{index < stage ? '✓' : index + 1}</div>)}<div ref={playerRef} className={styles.player} aria-label="Your position in the maze" />
      {loading && <div className={styles.loading}><span className="spinner dark-spinner" /><strong>Preparing maze…</strong></div>}
      {overlay && <aside className={styles.card} aria-live="polite">{overlay.type === 'completed' ? <><h2>Journey already completed</h2><p>You can replay the maze or continue to the awareness quiz.</p><div className="status-actions"><button className="btn secondary no-arrow" onClick={restart}>Replay maze</button><button className="btn" onClick={continueGame}>Continue to quiz</button></div></> : <><h2>✓ {CHECKPOINTS[overlay.stage - 1].name.toUpperCase()} REACHED</h2><p>{CHECKPOINTS[overlay.stage - 1].text} {CHECKPOINTS[overlay.stage - 1].next}</p><button className="btn" onClick={continueGame} disabled={saving}>{saving ? <><span className="spinner" /> Saving…</> : overlay.stage === 5 ? 'Continue to quiz' : 'Continue'}</button></>} {error && <p className="error" role="alert">{error}</p>}</aside>}
      {!overlay && error && <div className={styles.gameError} role="alert">{error}<button className="btn small no-arrow" onClick={() => location.reload()}>Retry</button></div>}
    </div></section>
    <section className={styles.controls}><div className={styles.dpad} aria-label="Movement controls">{([['up','▲'],['left','◀'],['down','▼'],['right','▶']] as [Direction,string][]).map(([direction,label]) => <button className={`${styles.move} ${styles[direction]}`} key={direction} aria-label={`Move ${direction}`} onPointerDown={event => setDirection(direction, true, event)} onPointerUp={event => setDirection(direction, false, event)} onPointerCancel={event => setDirection(direction, false, event)} onLostPointerCapture={event => setDirection(direction, false, event)}>{label}</button>)}</div><p>Press and hold to move · Arrow keys or WASD also work</p></section>
  </main></AuthGate>;
}
