'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/auth-gate';
import { api } from '@/lib/voter-api';

const stages = [
  ['Prepare your CNIC', 'Take your original CNIC and confirm your assigned polling station before leaving home.'],
  ['Reach the polling station', 'Go to your assigned station and follow the signs for your polling booth.'],
  ['Verify your identity', 'Present your CNIC to polling staff for voter-list verification.'],
  ['Receive the ballot paper', 'Receive your official ballot and move to the private voting area.'],
  ['Cast your vote', 'Mark your choice privately, fold the paper, and place it in the ballot box.'],
];

export default function LearnPage() {
  const router = useRouter(); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  useEffect(() => { api('/activity', { method: 'POST', body: JSON.stringify({ type: 'GENERAL_KNOWLEDGE_STARTED' }) }).catch(error => setError(error.message)); }, []);
  const complete = async () => { setSaving(true); setError(''); try { await api('/progress/learn', { method: 'POST' }); router.push('/'); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save progress.'); setSaving(false); } };
  return <AuthGate><main className="app app-shell guide-app"><header className="topbar"><Link className="link" href="/">← Home</Link><span className="topbar-title">Voting Guide</span><span /></header><section className="guide-hero"><div className="guide-copy"><p className="eyebrow">General Knowledge · Voting Guide</p><h1>How voting works</h1><p className="lead">Follow five clear stages—from preparing your original CNIC to placing your marked ballot in the box.</p></div><div className="guide-visual"><img src="/assets/official-page-3.png" alt="Official ECP voter awareness information" /></div></section><section className="guide-content"><div className="guide-heading"><h2>Your voting journey</h2></div><div className="guide-grid">{stages.map(([title, copy], index) => <article className="learn-card" key={title}><span className="num">{String(index + 1).padStart(2, '0')}</span><h2>{title}</h2><p>{copy}</p></article>)}</div></section><div className="sticky-action"><button className="btn" onClick={complete} disabled={saving}>{saving ? <><span className="spinner" /> Saving…</> : 'I understand — return home'}</button><div className="error center" role="alert">{error}</div></div></main></AuthGate>;
}
