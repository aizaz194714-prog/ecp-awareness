'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGate } from '@/components/auth-gate';
import { api } from '@/lib/voter-api';

export default function GeneralKnowledgePage() {
  const router = useRouter(); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { api('/activity', { method: 'POST', body: JSON.stringify({ type: 'GENERAL_KNOWLEDGE_STARTED' }) }).catch(error => setError(error.message)); }, []);
  const complete = async () => { setSaving(true); try { await api('/progress/learn', { method: 'POST' }); router.push('/'); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save progress.'); setSaving(false); } };
  return <AuthGate><main className="app art-page" dir="rtl"><header className="topbar"><Link className="link" href="/">مرکزی صفحہ ←</Link><span className="topbar-title">ووٹر آگاہی</span><span /></header><section className="art-frame"><img src="/assets/official-page-4.png" alt="ووٹ آگاہی — آسان سوالات اور جوابات" /></section><div className="sticky-action"><button className="btn" onClick={complete} disabled={saving}>{saving ? 'محفوظ ہو رہا ہے…' : 'میں نے معلومات پڑھ لی ہیں'}</button><div className="error center">{error}</div></div></main></AuthGate>;
}
