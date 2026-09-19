import { NextRequest } from 'next/server';
import { handleApi } from '@/lib/server/api-handler';

export const runtime = 'nodejs';
export const maxDuration = 15;

type Context = { params: Promise<{ path: string[] }> };
const dispatch = async (request: NextRequest, context: Context) => handleApi(request, (await context.params).path.join('/'));

export const GET = dispatch;
export const POST = dispatch;
