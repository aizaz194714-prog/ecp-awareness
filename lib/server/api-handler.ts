import 'server-only';
import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { all, completeIfReady, count, ensureDatabase, log, now, one, participantProgress, query, transaction, verifyPassword } from './database';
import { AdminSession, adminToken, participantToken, verifySession } from './sessions';

declare global {
  // eslint-disable-next-line no-var
  var __ecpLoginAttempts: Map<string, { count: number; blockedUntil: number }> | undefined;
}
const loginAttempts = globalThis.__ecpLoginAttempts ??= new Map();

const json = (data: object, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const failure = (status: number, message: string) => json({ error: message }, status);
const hashId = (id: string) => crypto.createHash('sha256').update(`voter-awareness:${id}`).digest('hex');
const maskId = (id: string) => id.length > 8 ? `${id.slice(0, 5)}-*****-${id.slice(-1)}` : `***${id.slice(-2)}`;

async function body(request: NextRequest) {
  try { return await request.json() as Record<string, unknown>; }
  catch { throw new Error('Invalid request body.'); }
}

function participant(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return verifySession(token, 'participant');
}

function admin(request: NextRequest) {
  return verifySession(request.cookies.get('admin_session')?.value, 'admin');
}

function requireAdmin(request: NextRequest, mutating = false): AdminSession | NextResponse {
  const session = admin(request);
  if (!session) return failure(401, 'Admin authentication required.');
  if (mutating && request.headers.get('x-csrf-token') !== session.csrf) return failure(403, 'Invalid security token.');
  return session;
}

function isResponse(value: AdminSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

async function publicProgress(id: number, returning = false) {
  const progress = await participantProgress(id);
  if (!progress) throw new Error('Participant not found.');
  const gameStage = [progress.stage_1_at, progress.stage_2_at, progress.stage_3_at, progress.stage_4_at, progress.stage_5_at].filter(Boolean).length;
  return { returning, progress: { registered: true, learned: !!progress.general_knowledge_completed_at, gameStage, gameCompleted: !!progress.game_completed_at, quizCompleted: !!progress.quiz_completed_at, quizScore: progress.quiz_score ?? null, quizTotal: progress.quiz_total ?? null } };
}

async function handlePublic(request: NextRequest, path: string) {
  if (request.method === 'POST' && path === 'register') {
    const data = await body(request), cnic = String(data.cnic || '').replace(/\D/g, '');
    if (cnic.length < 5 || cnic.length > 13) return failure(400, 'Enter a valid CAC / CNIC number.');
    const hash = hashId(cnic), timestamp = now(); let returning = false;
    const id = await transaction(async client => {
      let record = (await client.query("INSERT INTO participants(identifier_hash,identifier_mask,registered_at,last_activity_at,awareness_started_at,status) VALUES($1,$2,$3,$3,$3,'IN_PROGRESS') ON CONFLICT (identifier_hash) DO NOTHING RETURNING id", [hash, maskId(cnic), timestamp])).rows[0];
      if (record) {
        await client.query('INSERT INTO awareness_progress(participant_id,updated_at) VALUES($1,$2)', [record.id, timestamp]);
        await client.query('INSERT INTO game_progress(participant_id,updated_at) VALUES($1,$2)', [record.id, timestamp]);
        await log(record.id, 'REGISTERED', 'REGISTERED', null, timestamp, client);
      } else {
        returning = true;
        record = (await client.query('UPDATE participants SET visits=visits+1,last_activity_at=$1 WHERE identifier_hash=$2 RETURNING id', [timestamp, hash])).rows[0];
      }
      return Number(record.id);
    });
    return json({ token: participantToken(id), participant: await publicProgress(id, returning) });
  }

  const session = participant(request);
  if (!session) return failure(401, 'Your session has ended. Enter your CAC / CNIC again.');
  const id = session.sub, timestamp = now();
  if (request.method === 'GET' && path === 'progress') return json({ participant: await publicProgress(id) });
  if (request.method === 'POST' && path === 'activity') {
    const data = await body(request), type = String(data.type || '');
    const columns: Record<string, string> = { GENERAL_KNOWLEDGE_STARTED: 'general_knowledge_started_at', SURVEY_STARTED: 'survey_started_at', SURVEY_COMPLETED: 'survey_completed_at', GAME_STARTED: 'game_started_at', QUIZ_STARTED: 'quiz_started_at' };
    const column = columns[type]; if (!column) return failure(400, 'Invalid activity.');
    await query(`UPDATE awareness_progress SET ${column}=COALESCE(${column},$1),updated_at=$1 WHERE participant_id=$2`, [timestamp, id]);
    if (type === 'GAME_STARTED') await query('UPDATE game_progress SET started_at=COALESCE(started_at,$1),updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await log(id, type, type); return json({ ok: true });
  }
  if (request.method === 'POST' && path === 'progress/learn') {
    await query('UPDATE awareness_progress SET general_knowledge_started_at=COALESCE(general_knowledge_started_at,$1),general_knowledge_completed_at=COALESCE(general_knowledge_completed_at,$1),updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await log(id, 'GENERAL_KNOWLEDGE_COMPLETED', 'GENERAL_KNOWLEDGE_COMPLETED'); await completeIfReady(id);
    return json({ progress: (await publicProgress(id)).progress });
  }
  if (request.method === 'POST' && path === 'progress/game-stage') {
    const data = await body(request), stage = Number(data.stage);
    if (!Number.isInteger(stage) || stage < 1 || stage > 5) return failure(400, 'Invalid game stage.');
    const game = await one<Record<string, unknown>>('SELECT * FROM game_progress WHERE participant_id=$1', [id]);
    if (stage > 1 && !game?.[`stage_${stage - 1}_at`]) return failure(409, 'Complete checkpoints in order.');
    await query(`UPDATE game_progress SET started_at=COALESCE(started_at,$1),stage_${stage}_at=COALESCE(stage_${stage}_at,$1),updated_at=$1 WHERE participant_id=$2`, [timestamp, id]);
    await query('UPDATE awareness_progress SET game_started_at=COALESCE(game_started_at,$1),updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await log(id, `GAME_STAGE_${stage}_COMPLETED`, `GAME_STAGE_${stage}_COMPLETED`); return json({ ok: true });
  }
  if (request.method === 'POST' && path === 'progress/game') {
    const game = await one<{ stage_5_at: string | null }>('SELECT stage_5_at FROM game_progress WHERE participant_id=$1', [id]);
    if (!game?.stage_5_at) return failure(409, 'Reach all five checkpoints first.');
    await query('UPDATE game_progress SET completed_at=COALESCE(completed_at,$1),updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await query('UPDATE awareness_progress SET game_started_at=COALESCE(game_started_at,$1),game_completed_at=COALESCE(game_completed_at,$1),updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await log(id, 'GAME_COMPLETED', 'GAME_COMPLETED'); await completeIfReady(id);
    return json({ progress: (await publicProgress(id)).progress });
  }
  if (request.method === 'POST' && path === 'quiz/submit') {
    const data = await body(request), answers = data.answers, correct = [1, 0, 1, 0, 1];
    if (!Array.isArray(answers) || answers.length !== 5 || answers.some(answer => !Number.isInteger(answer) || answer < 0 || answer > 2)) return failure(400, 'Answer every question before submitting.');
    const score = answers.reduce((total: number, answer, index) => total + (answer === correct[index] ? 1 : 0), 0);
    await query('INSERT INTO quiz_attempts(participant_id,answers_json,score,total,started_at,completed_at) VALUES($1,$2,$3,$4,$5,$5)', [id, JSON.stringify(answers), score, 5, timestamp]);
    await query('UPDATE awareness_progress SET quiz_started_at=COALESCE(quiz_started_at,$1),quiz_completed_at=$1,updated_at=$1 WHERE participant_id=$2', [timestamp, id]);
    await log(id, 'QUIZ_COMPLETED', 'QUIZ_COMPLETED', { score, total: 5 }); await completeIfReady(id);
    return json({ score, total: 5, complete: true });
  }
  return failure(404, 'Not found.');
}

async function handleAdmin(request: NextRequest, path: string) {
  if (request.method === 'POST' && path === 'admin/login') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local', attempts = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
    if (attempts.blockedUntil > Date.now()) return failure(429, 'Too many attempts. Try again later.');
    const data = await body(request), name = String(data.username || ''), user = await one<{ id: number; username: string; password_hash: string }>('SELECT * FROM admins WHERE username=$1 OR email=$1', [name]);
    if (!user || !verifyPassword(String(data.password || ''), user.password_hash)) {
      attempts.count++; if (attempts.count >= 5) { attempts.blockedUntil = Date.now() + 5 * 60 * 1000; attempts.count = 0; } loginAttempts.set(ip, attempts);
      return failure(401, 'Invalid username or password.');
    }
    loginAttempts.delete(ip); const signed = adminToken(user.id, user.username); await query('UPDATE admins SET last_login_at=$1 WHERE id=$2', [now(), user.id]);
    const response = json({ username: user.username, csrf: signed.csrf });
    response.cookies.set('admin_session', signed.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 1800 }); return response;
  }
  if (request.method === 'GET' && path === 'admin/session') { const session = requireAdmin(request); return isResponse(session) ? session : json({ username: session.username, csrf: session.csrf }); }
  if (request.method === 'POST' && path === 'admin/logout') { const session = requireAdmin(request, true); if (isResponse(session)) return session; const response = json({ ok: true }); response.cookies.set('admin_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 }); return response; }
  const session = requireAdmin(request); if (isResponse(session)) return session;

  if (request.method === 'GET' && path === 'admin/dashboard') {
    const today = new Date().toISOString().slice(0, 10);
    const [total, todayCount, awarenessStarted, awarenessCompleted, surveyCompleted, gameStarted, gameCompleted, quizCompleted, averageRow, recent, generalKnowledge] = await Promise.all([count('SELECT COUNT(*) n FROM participants'), count('SELECT COUNT(*) n FROM participants WHERE registered_at::date=$1::date', [today]), count('SELECT COUNT(*) n FROM participants WHERE awareness_started_at IS NOT NULL'), count('SELECT COUNT(*) n FROM participants WHERE awareness_completed_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE survey_completed_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE game_started_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE game_completed_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE quiz_completed_at IS NOT NULL'), one<{ n: number }>('SELECT ROUND(AVG(score*100.0/total),1) n FROM quiz_attempts'), all('SELECT l.event_type,l.details_json,l.created_at,p.identifier_mask FROM activity_logs l LEFT JOIN participants p ON p.id=l.participant_id ORDER BY l.id DESC LIMIT 10'), count('SELECT COUNT(*) n FROM awareness_progress WHERE general_knowledge_completed_at IS NOT NULL')]);
    const kpis = { total, today: todayCount, awarenessStarted, awarenessCompleted, surveyCompleted, gameStarted, gameCompleted, quizCompleted, averageQuiz: Number(averageRow?.n || 0), completionRate: total ? Math.round(awarenessCompleted * 1000 / total) / 10 : 0 };
    return json({ kpis, recent, funnel: { registered: total, generalKnowledge, survey: surveyCompleted, game: gameCompleted, quiz: quizCompleted, completed: awarenessCompleted } });
  }
  if (request.method === 'GET' && path === 'admin/participants') {
    const page = Math.max(1, Number(request.nextUrl.searchParams.get('page')) || 1), size = 20, search = String(request.nextUrl.searchParams.get('search') || '').slice(0, 40), status = String(request.nextUrl.searchParams.get('status') || ''), where: string[] = [], params: unknown[] = [];
    if (search) { params.push(`%${search}%`); where.push(`p.identifier_mask LIKE $${params.length}`); } if (['IN_PROGRESS', 'COMPLETED'].includes(status)) { params.push(status); where.push(`p.status=$${params.length}`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '', total = await count(`SELECT COUNT(*) n FROM participants p ${clause}`, params), pageParams = [...params, size, (page - 1) * size];
    const rows = await all(`SELECT p.id,p.identifier_mask,p.registered_at,p.last_activity_at,p.status,a.general_knowledge_completed_at,a.survey_completed_at,a.game_completed_at,a.quiz_completed_at,(SELECT score::text||'/'||total::text FROM quiz_attempts q WHERE q.participant_id=p.id ORDER BY id DESC LIMIT 1) quiz_score FROM participants p LEFT JOIN awareness_progress a ON a.participant_id=p.id ${clause} ORDER BY p.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, pageParams);
    return json({ rows, total, page, pages: Math.max(1, Math.ceil(total / size)) });
  }
  const detail = path.match(/^admin\/participants\/(\d+)$/);
  if (request.method === 'GET' && detail) {
    const id = Number(detail[1]), record = await participantProgress(id); if (!record) return failure(404, 'Participant not found.');
    const [activity, attempts] = await Promise.all([all('SELECT event_type,details_json,created_at FROM activity_logs WHERE participant_id=$1 ORDER BY id', [id]), all('SELECT score,total,completed_at FROM quiz_attempts WHERE participant_id=$1 ORDER BY id DESC', [id])]);
    return json({ participant: { id: record.id, identifier: record.identifier_mask, registeredAt: record.registered_at, lastActivity: record.last_activity_at, status: record.status, completedAt: record.awareness_completed_at }, progress: record, activity, attempts });
  }
  if (request.method === 'GET' && path === 'admin/game') { const [started, completed, ...stages] = await Promise.all([count('SELECT COUNT(*) n FROM game_progress WHERE started_at IS NOT NULL'), count('SELECT COUNT(*) n FROM game_progress WHERE completed_at IS NOT NULL'), ...[1,2,3,4,5].map(index => count(`SELECT COUNT(*) n FROM game_progress WHERE stage_${index}_at IS NOT NULL`))]); return json({ started, completed, rate: started ? Math.round(completed * 1000 / started) / 10 : 0, stages }); }
  if (request.method === 'GET' && path === 'admin/quiz') { const [started, completed, stats, rows] = await Promise.all([count('SELECT COUNT(*) n FROM awareness_progress WHERE quiz_started_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE quiz_completed_at IS NOT NULL'), one('SELECT ROUND(AVG(score),2) average,MAX(score) highest FROM quiz_attempts'), all('SELECT p.identifier_mask participant,q.score,q.total,q.completed_at FROM quiz_attempts q JOIN participants p ON p.id=q.participant_id ORDER BY q.id DESC LIMIT 100')]); return json({ started, completed, rate: started ? Math.round(completed * 1000 / started) / 10 : 0, ...stats, rows }); }
  if (request.method === 'GET' && path === 'admin/survey') { const [started, completed, answers] = await Promise.all([count('SELECT COUNT(*) n FROM awareness_progress WHERE survey_started_at IS NOT NULL'), count('SELECT COUNT(*) n FROM awareness_progress WHERE survey_completed_at IS NOT NULL'), all('SELECT question_key,answer_value,COUNT(*)::int count FROM survey_responses GROUP BY question_key,answer_value ORDER BY question_key,count DESC')]); return json({ started, completed, rate: started ? Math.round(completed * 1000 / started) / 10 : 0, answers }); }
  if (request.method === 'GET' && path === 'admin/report') {
    const from = request.nextUrl.searchParams.get('from') || '0001-01-01', toDate = request.nextUrl.searchParams.get('to') || '9999-12-31', to = `${toDate}T23:59:59.999Z`, range = [from, to];
    const [registrations, surveyCompleted, gameStarted, gameCompleted, quizCompleted, awarenessCompleted, averageRow] = await Promise.all([count('SELECT COUNT(*) n FROM participants WHERE registered_at BETWEEN $1 AND $2', range), count('SELECT COUNT(*) n FROM awareness_progress WHERE survey_completed_at BETWEEN $1 AND $2', range), count('SELECT COUNT(*) n FROM awareness_progress WHERE game_started_at BETWEEN $1 AND $2', range), count('SELECT COUNT(*) n FROM awareness_progress WHERE game_completed_at BETWEEN $1 AND $2', range), count('SELECT COUNT(*) n FROM awareness_progress WHERE quiz_completed_at BETWEEN $1 AND $2', range), count('SELECT COUNT(*) n FROM participants WHERE awareness_completed_at BETWEEN $1 AND $2', range), one<{ n: number }>('SELECT ROUND(AVG(score*100.0/total),1) n FROM quiz_attempts WHERE completed_at BETWEEN $1 AND $2', range)]);
    const data = { registrations, surveyCompleted, gameStarted, gameCompleted, quizCompleted, awarenessCompleted, averageQuiz: Number(averageRow?.n || 0) };
    if (request.nextUrl.searchParams.get('format') === 'csv') return new NextResponse(`Metric,Value\n${Object.entries(data).map(([key, value]) => `${key},${value}`).join('\n')}`, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="voter-awareness-report.csv"' } });
    return json({ from, to: toDate, data });
  }
  return failure(404, 'Not found.');
}

export async function handleApi(request: NextRequest, path: string) {
  try { await ensureDatabase(); return path.startsWith('admin/') ? await handleAdmin(request, path) : await handlePublic(request, path); }
  catch (error) { console.error('API request failed:', error); return failure(error instanceof Error && error.message === 'Invalid request body.' ? 400 : 500, error instanceof Error && error.message === 'Invalid request body.' ? error.message : 'The service is unavailable. Please try again.'); }
}
