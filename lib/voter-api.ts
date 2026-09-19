'use client';

export type Progress = {
  registered: boolean;
  learned: boolean;
  gameStage: number;
  gameCompleted: boolean;
  quizCompleted: boolean;
  quizScore: number | null;
  quizTotal: number | null;
};

export type ParticipantResponse = {
  returning: boolean;
  progress: Progress;
};

const TOKEN_KEY = 'voterToken';

export function getToken() {
  return typeof window === 'undefined' ? null : sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    throw new Error('You appear to be offline. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'The service is unavailable. Please try again.');
  return data as T;
}

export async function loadProgress() {
  return api<{ participant: ParticipantResponse }>('/progress');
}

export function progressPercent(progress: Progress) {
  return [progress.registered, progress.learned, progress.gameCompleted, progress.quizCompleted].filter(Boolean).length * 25;
}
