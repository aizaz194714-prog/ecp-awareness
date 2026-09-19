'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { Brand } from '@/components/brand';
import { OfflineNotice } from '@/components/offline-notice';
import { loadProgress, ParticipantResponse, progressPercent, setToken } from '@/lib/voter-api';

export default function JourneyPage() {
  const router = useRouter();
  const [participant, setParticipant] = useState<ParticipantResponse | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { setError(''); loadProgress().then(({ participant }) => setParticipant(participant)).catch(error => setError(error.message)); }, []);
  useEffect(load, [load]);
  const signOut = () => { setToken(null); router.replace('/register'); };

  return <AuthGate><main className="app app-shell">
    <header className="topbar"><Brand /><button className="link" onClick={signOut}>Sign out</button></header>
    <OfflineNotice />
    <section className="journey-hero"><p className="eyebrow">{participant?.returning ? 'Welcome back' : 'Welcome'}</p><h1>Your Awareness Journey</h1><p className="lead">Complete each activity in order. Your progress is saved automatically.</p>{participant && <><div className="progress-row"><span>Overall progress</span><span>{progressPercent(participant.progress)}%</span></div><div className="progress"><span style={{ width: `${progressPercent(participant.progress)}%` }} /></div></>}</section>
    <section className="journey" aria-busy={!participant && !error}>
      {error && <div className="state-card surface"><div className="state-icon">!</div><h2>Unable to load progress</h2><p className="error center">{error}</p><button className="btn no-arrow" onClick={load}>Try again</button></div>}
      {!participant && !error && <article className="step"><div className="step-icon"><span className="spinner dark-spinner" /></div><div><span className="status">Loading</span><h2>Preparing your journey</h2><p>Please wait a moment…</p></div></article>}
      {participant && <JourneySteps participant={participant} />}
    </section>
  </main></AuthGate>;
}

function JourneySteps({ participant }: { participant: ParticipantResponse }) {
  const p = participant.progress;
  const items = [
    { number: '✓', title: 'Registration', description: 'Your identity has been accepted', done: true },
    { number: '01', title: 'Learn how voting works', description: 'A clear guide to the five voting stages', done: p.learned, href: '/learn', action: p.learned ? 'Review guide' : 'Start learning' },
    { number: '02', title: 'Voting Maze Game', description: 'Navigate each stage of the voting journey', done: p.gameCompleted, locked: !p.learned, href: '/game', action: p.gameCompleted ? 'Play again' : p.gameStage ? `Resume at stage ${p.gameStage + 1}` : 'Play game' },
    { number: '03', title: 'Voter Awareness Quiz', description: 'Check your knowledge with five questions', done: p.quizCompleted, locked: !p.gameCompleted, href: '/quiz', action: p.quizCompleted ? 'Review quiz' : 'Start quiz' },
  ];
  return <>{items.map(item => <article className={`step ${item.done ? 'complete' : ''} ${item.locked ? 'locked' : ''}`} key={item.title}><div className="step-icon">{item.done ? '✓' : item.number}</div><div><span className="status">{item.done ? 'Complete' : item.locked ? 'Locked' : 'Ready'}</span><h2>{item.title}</h2><p>{item.description}</p>{item.href && (item.locked ? <span className="btn small" aria-disabled="true">{item.action}</span> : <Link className="btn small" href={item.href}>{item.action}</Link>)}</div></article>)}{progressPercent(p) === 100 && <Link className="btn" href="/completion">View completion</Link>}</>;
}
