'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { Brand } from '@/components/brand';
import { loadProgress, Progress, setToken } from '@/lib/voter-api';

export default function CompletionPage() {
  const router = useRouter(); const [progress, setProgress] = useState<Progress | null>(null); const [error, setError] = useState('');
  useEffect(() => { loadProgress().then(({ participant }) => { const p = participant.progress; if (!(p.learned && p.gameCompleted && p.quizCompleted)) router.replace('/'); else setProgress(p); }).catch(error => setError(error.message)); }, [router]);
  const finish = () => { setToken(null); router.replace('/register'); };
  return <AuthGate><main className="app app-shell"><header className="topbar"><Brand subtitle="Journey summary" /><button className="link" onClick={finish}>Finish</button></header><section className="complete-screen">{error ? <div className="state-card surface"><div className="state-icon">!</div><h2>Unable to confirm completion</h2><p className="error center">{error}</p><button className="btn no-arrow" onClick={() => location.reload()}>Try again</button></div> : !progress ? <div className="state-card"><span className="spinner dark-spinner" /><p className="hint loading-copy">Confirming completion…</p></div> : <><div className="success-mark">✓</div><div className="center"><p className="eyebrow">All activities complete</p><h1>Awareness Journey Completed</h1><p className="lead">Thank you for completing the Voter Awareness Activity.</p></div><div className="summary"><div className="summary-row"><strong>Voting Guide</strong><span>✓ Complete</span></div><div className="summary-row"><strong>Voting Game</strong><span>✓ Complete</span></div><div className="summary-row"><strong>Awareness Quiz</strong><span>✓ Complete</span></div><div className="summary-row"><strong>Quiz score</strong><span>{progress.quizScore} / {progress.quizTotal}</span></div></div><Link className="btn" href="/">View journey summary</Link></>}</section></main></AuthGate>;
}
