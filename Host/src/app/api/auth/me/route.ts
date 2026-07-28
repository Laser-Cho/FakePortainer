import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET(request: Request) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWD || 'admin123';

  const expectedToken = crypto
    .createHash('sha256')
    .update(`${expectedUser}:${expectedPassword}:fakeportainer-secret`)
    .digest('hex');

  const authCookie = request.headers.get('cookie') || '';
  const tokenMatch = authCookie.includes(`fakeportainer_session=${expectedToken}`);

  const authHeader = request.headers.get('authorization') || '';
  const bearerMatch = authHeader === `Bearer ${expectedToken}`;

  if (tokenMatch || bearerMatch) {
    return NextResponse.json({ authenticated: true, username: expectedUser });
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
