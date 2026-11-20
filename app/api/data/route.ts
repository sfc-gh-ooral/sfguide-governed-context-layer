import { NextResponse } from 'next/server';
import { OPS, type ContextData } from '@/lib/context-data';
import { isSnowflakeConfigured } from '@/lib/snowflake';

// Live-mode entry point for every screen. Sample mode never calls this: it runs in the browser on
// bundled data. Live failures are returned as errors, never replaced with sample data.
export async function POST(request: Request) {
  const { op, args } = await request.json();
  if (!OPS.includes(op) || !Array.isArray(args) || args.some((a) => typeof a !== 'string')) {
    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  }
  if (!isSnowflakeConfigured()) return NextResponse.json({ error: 'No Snowflake connection is configured on this server.' }, { status: 503 });
  const { liveData } = await import('@/lib/live-data');
  try {
    const result = await (liveData[op as keyof ContextData] as (...a: string[]) => Promise<unknown>)(...args);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`${op} failed:`, error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
