import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const appTitle = process.env.APP_TITLE || process.env.NEXT_PUBLIC_APP_TITLE || 'DockWatch';
  return NextResponse.json(
    { appTitle },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    }
  );
}
