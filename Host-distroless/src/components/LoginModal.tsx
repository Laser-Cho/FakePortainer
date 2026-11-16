'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck, UserPlus, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import PasswordChangeModal from './PasswordChangeModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (
    username: string,
    name?: string,
    role?: string,
    extras?: { twoFactorEnabled?: boolean; adminAlertInfo?: any }
  ) => void;
}

export default function LoginModal({ isOpen, onClose, onLoginSuccess }: LoginModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);

  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regRole, setRegRole] = useState<'user' | 'monitor'>('user');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showExpiredModal, setShowExpiredModal] = useState(false);
  const [expiredUsername, setExpiredUsername] = useState('');

  if (!isOpen) return null;

  const validateComplexityClient = (pw: string) => {
    if (pw.length < 8) return false;
    let count = 0;
    if (/[a-z]/.test(pw)) count++;
    if (/[A-Z]/.test(pw)) count++;
    if (/[0-9]/.test(pw)) count++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw)) count++;
    return count >= 3;
  };

  const isRegComplexityMet = validateComplexityClient(regPassword);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          password: loginPassword,
          totpCode: requiresTwoFactor ? totpCode : undefined,
        }),
      });

      const data = await res.json();
      if (data.requiresTwoFactor && !data.authenticated) {
        setRequiresTwoFactor(true);
        if (data.error) setError(data.error);
        return;
      }

      if (res.ok && data.success) {
        if (data.requirePasswordChange) {
          setExpiredUsername(data.username || loginUsername);
          setShowExpiredModal(true);
          return;
        }
        setRequiresTwoFactor(false);
        setTotpCode('');
        onLoginSuccess(data.username || loginUsername, data.name, data.role, {
          twoFactorEnabled: data.twoFactorEnabled,
          adminAlertInfo: data.adminAlertInfo,
        });
        onClose();
      } else {
        setError(data.error || '아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    } catch (err: any) {
      setError(err.message || '로그인 요청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (regPassword !== regConfirmPassword) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (!isRegComplexityMet) {
      setError('비밀번호는 영대문자, 영소문자, 숫자, 특수문자 중 3가지 이상을 조합하여 8자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          name: regName,
          email: regEmail,
          role: regRole,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || '회원가입이 완료되었습니다! 생성한 계정으로 로그인해 주세요.');
        setLoginUsername(regUsername);
        setLoginPassword('');
        setRegPassword('');
        setRegConfirmPassword('');
        setTimeout(() => {
          setActiveTab('login');
          setSuccessMsg('');
        }, 1800);
      } else {
        setError(data.error || '회원가입에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '회원가입 요청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100">Control Plane Portal</h2>
                <p className="text-[11px] text-slate-400">사용자 인증 및 계정 관리</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-4">
            <button
              onClick={() => {
                setActiveTab('login');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              로그인 (Sign In)
            </button>
            <button
              onClick={() => {
                setActiveTab('register');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeTab === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              회원가입 (Sign Up)
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs p-3 rounded-xl flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs p-3 rounded-xl flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">사용자 아이디 (ID)</label>
                <input
                  type="text"
                  required
                  placeholder="아이디 입력"
                  value={loginUsername}
                  onChange={(e) => {
                    setLoginUsername(e.target.value);
                    setRequiresTwoFactor(false);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">비밀번호 (Password)</label>
                <input
                  type="password"
                  required
                  placeholder="비밀번호 입력 (5회 연속 실패 시 계정 잠금)"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              {requiresTwoFactor && (
                <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3 space-y-2">
                  <label className="block text-xs font-semibold text-emerald-300">
                    2단계 인증(OTP) 6자리 코드
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-emerald-700 rounded-xl px-3.5 py-2 text-sm font-mono tracking-widest text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isLoading ? '인증 중...' : requiresTwoFactor ? 'OTP 인증 후 로그인' : '로그인 (Sign In)'}</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setExpiredUsername(loginUsername);
                    setShowExpiredModal(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-blue-400 underline transition"
                >
                  비밀번호 재설정이 필요하신가요?
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">사용자 아이디 (ID)</label>
                <input
                  type="text"
                  required
                  placeholder="개별 고유 아이디 (admin/root 등 예약어 불가)"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">실명 (Full Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="홍길동"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">이메일 (Email)</label>
                  <input
                    type="email"
                    required
                    placeholder="user@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">계정 유형 (Role)</label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as 'user' | 'monitor')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="monitor">모니터링 (Read-only)</option>
                  <option value="user">일반 계정 (도커 제어, 관리자 승격 별도)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400">비밀번호</label>
                  <span className={`text-[10px] font-semibold ${isRegComplexityMet ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {isRegComplexityMet ? '✓ 복잡도 만족' : '영대/소문자, 숫자, 특수문자 중 3종류 8자'}
                  </span>
                </div>
                <input
                  type="password"
                  required
                  placeholder="8자 이상 복잡도 조합"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none transition ${
                    regPassword
                      ? isRegComplexityMet
                        ? 'border-emerald-600 focus:border-emerald-500'
                        : 'border-amber-600 focus:border-amber-500'
                      : 'border-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  required
                  placeholder="비밀번호 다시 입력"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-1.5 text-sm text-slate-100 focus:outline-none transition ${
                    regConfirmPassword && regConfirmPassword === regPassword ? 'border-emerald-600' : 'border-slate-800 focus:border-blue-500'
                  }`}
                />
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-xl text-[11px] text-slate-400 flex items-start space-x-2">
                <AlertCircle className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  1인 1계정 원칙 및 90일 비밀번호 주기·10분 무활동 자동 잠금이 적용됩니다. 관리자 권한은 승인 후 관리자가 부여합니다.
                </span>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isLoading || !isRegComplexityMet}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isLoading ? '등록 처리 중...' : '회원가입 (Create Account)'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {showExpiredModal && (
        <PasswordChangeModal
          isOpen={showExpiredModal}
          onClose={() => setShowExpiredModal(false)}
          username={expiredUsername}
          isExpiredPrompt={true}
          onSuccess={() => {
            setShowExpiredModal(false);
            setError('');
            setSuccessMsg('비밀번호가 재설정되었습니다. 새 비밀번호로 로그인해 주세요.');
            setActiveTab('login');
          }}
        />
      )}
    </>
  );
}
