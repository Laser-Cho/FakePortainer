import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWD || 'admin123';

    if (username === expectedUser && password === expectedPassword) {
      const sessionToken = crypto
        .createHash('sha256')
        .update(`${expectedUser}:${expectedPassword}:fakeportainer-secret`)
        .digest('hex');

      const response = NextResponse.json({
        success: true,
        token: sessionToken,
        username: expectedUser,
      });

      response.cookies.set('fakeportainer_session', sessionToken, {
        httpOnly: false,
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid ID or Password' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Login failed' }, { status: 500 });
  }
}
