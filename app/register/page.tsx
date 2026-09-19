'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand } from '@/components/brand';
import { api, getToken, setToken } from '@/lib/voter-api';

const allowed = new Set(['/', '/quiz', '/game']);

export default function RegisterPage() {
  const router = useRouter();
  const [cnic, setCnic] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [next, setNext] = useState('/');
  useEffect(() => { const requested = new URLSearchParams(location.search).get('next') ?? '/'; const destination = allowed.has(requested) ? requested : '/'; setNext(destination); if (getToken()) router.replace(destination); }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (cnic.length < 5 || cnic.length > 13) { setError('Enter a valid CNIC number.'); return; }
    setSaving(true); setError('');
    try { const data = await api<{ token: string }>('/register', { method: 'POST', body: JSON.stringify({ cnic }) }); setToken(data.token); router.replace(next); }
    catch (error) { setError(error instanceof Error ? error.message : 'Registration failed.'); setSaving(false); }
  }

  return <main className="register-shell register-page"><form className="register-card" onSubmit={submit}><Brand subtitle="Participant registration" /><p className="eyebrow">Start your awareness journey</p><h1>Enter your CNIC</h1><p className="lead" style={{ marginBottom: 23 }}>New and returning participants use the same number. Your existing progress is restored automatically.</p><label htmlFor="cnic">CNIC number</label><div className="input-wrap"><input className="field" id="cnic" inputMode="numeric" autoComplete="off" maxLength={13} value={cnic} onChange={event => { setCnic(event.target.value.replace(/\D/g, '').slice(0, 13)); setError(''); }} placeholder="XXXXX-XXXXXXX-X" aria-describedby="register-error" autoFocus /></div><div className="error" id="register-error" role="alert">{error}</div><button className="btn" disabled={saving} type="submit">{saving ? <><span className="spinner" /> Please wait…</> : 'Continue'}</button></form></main>;
}
