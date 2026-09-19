'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGate } from '@/components/auth-gate';
import { api, loadProgress } from '@/lib/voter-api';

const questions = [
  { question: 'Who can vote in an election?', options: ['Only government employees', 'Registered citizens who meet the legal voting age', 'Only people with a driving licence'] },
  { question: 'Which document should you take to vote?', options: ['Your original CNIC', 'A student card', 'A utility bill'] },
  { question: 'Where should you cast your vote?', options: ['At any nearby station', 'At your assigned polling station', 'At a government office'] },
  { question: 'What should you do after receiving your ballot paper?', options: ['Mark your choice privately', 'Show it to other voters', 'Take it home'] },
  { question: 'What happens after you mark the ballot?', options: ['Give it to another voter', 'Place it in the correct ballot box', 'Photograph and share it'] },
];

export default function QuizPage() {
  const router = useRouter(); const [current, setCurrent] = useState(0); const [answers, setAnswers] = useState<(number | null)[]>(Array(5).fill(null)); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => { Promise.all([loadProgress(), api('/activity', { method: 'POST', body: JSON.stringify({ type: 'QUIZ_STARTED' }) })]).then(() => setReady(true)).catch(error => setError(error.message)); }, []);
  const select = (answer: number) => setAnswers(existing => existing.map((value, index) => index === current ? answer : value));
  const next = async () => { if (answers[current] === null) return; if (current < 4) { setCurrent(value => value + 1); scrollTo(0, 0); return; } setSaving(true); setError(''); try { await api('/quiz/submit', { method: 'POST', body: JSON.stringify({ answers }) }); router.push('/completion'); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to submit the quiz.'); setSaving(false); } };
  const item = questions[current];
  return <AuthGate><main className="app app-shell"><header className="topbar"><Link className="link" href="/">← Home</Link><span className="topbar-title">Awareness Quiz</span><span /></header><section><div className="quiz-banner"><p className="eyebrow">Awareness Quiz</p><h1>Test your knowledge</h1></div><div className="quiz-head"><div className="progress-row"><span>Question {current + 1} of 5</span><span>{(current + 1) * 20}%</span></div><div className="progress"><span style={{ width: `${(current + 1) * 20}%` }} /></div></div><div className="question-card">{!ready && !error ? <div className="state-card"><span className="spinner dark-spinner" /></div> : <><p className="eyebrow">Choose one answer</p><h1 className="question">{item.question}</h1><div className="options">{item.options.map((label, index) => <button type="button" className={`option ${answers[current] === index ? 'selected' : ''}`} onClick={() => select(index)} aria-pressed={answers[current] === index} key={label}>{label}</button>)}</div><div className="quiz-actions"><button className="btn secondary" disabled={current === 0 || saving} onClick={() => setCurrent(value => value - 1)}>Previous</button><button className="btn" disabled={answers[current] === null || saving} onClick={next}>{saving ? <><span className="spinner" /> Submitting…</> : current === 4 ? 'Submit quiz' : 'Next'}</button></div></>}<div className="error center" role="alert">{error}</div></div></section></main></AuthGate>;
}
