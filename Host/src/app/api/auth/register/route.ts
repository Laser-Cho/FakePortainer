import { NextResponse } from 'next/server';
import { createUser } from '../../../../lib/server/userStore';
import { addSystemLog, getClientIp } from '../../../../lib/server/systemLogStore';

export async function POST(request: Request) {
  const clientIp = getClientIp(request);
  try {
    const body = await request.json();
    const { username, password, name, email } = body;

    if (!username || !password || !name || !email) {
      return NextResponse.json(
        { error: '아이디, 비밀번호, 실명, 이메일을 모두 입력해 주세요.' },
        { status: 400 }
      );
    }

    const result = createUser({
      username,
      password,
      name,
      email,
      role: 'user', // Default role for public registration
    });

    if (result.error) {
      addSystemLog({
        clientIp,
        user: username || 'anonymous',
        category: 'USER_MGMT',
        level: 'WARN',
        action: 'USER_REGISTER_FAILED',
        detail: `회원가입 실패 (아이디: ${username}, 실명: ${name}, 사유: ${result.error})`,
      });
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const created = result.user!;

    addSystemLog({
      clientIp,
      user: created.username,
      userRealName: created.name,
      category: 'USER_MGMT',
      level: 'INFO',
      action: 'USER_REGISTER',
      detail: `신규 사용자 회원가입 완료: '${created.username}' (실명: ${created.name}, 이메일: ${created.email}, IP: ${clientIp})`,
    });

    return NextResponse.json(
      {
        success: true,
        message: '회원가입이 완료되었습니다. 생성한 계정으로 로그인해 주세요.',
        user: {
          username: created.username,
          name: created.name,
          email: created.email,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
