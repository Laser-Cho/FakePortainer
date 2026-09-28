import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../lib/server/session';
import { isPasswordExpired } from '../../../../lib/server/userStore';

export async function GET(request: Request) {
  const { session, user } = getSessionUser(request);

  if (!session || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const requirePasswordChange = isPasswordExpired(user.passwordChangedAt);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      requirePasswordChange,
      createdAt: user.createdAt,
      passwordChangedAt: user.passwordChangedAt,
    },
  });
}
