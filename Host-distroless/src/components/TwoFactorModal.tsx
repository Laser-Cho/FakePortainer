'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, X, Copy } from 'lucide-react';

interface TwoFactorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (enabled: boolean) => void;
}

export default function TwoFactorModal({ isOpen, onClose, onStatusChange }: TwoFactorModalProps) {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [otpAuthUri, setOtpAuthUri] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setSuccessMsg('');
    setCurrentPassword('');
    setTotpCode('');
    fetch('/api/auth/2fa', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setEnabled(!!data.enabled);
        setSecret(data.pendingSecret || '');
        setOtpAuthUri(data.otpAuthUri || '');
      })
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: enabled ? 'disable' : 'enable',
          currentPassword,
          secret,
          totpCode,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEnabled(!!data.enabled);
        setSuccessMsg(data.message);
        if (onStatusChange) onStatusChange(!!data.enabled);
        setTimeout(() => onClose(), 1200);
      } else {
        setError(data.error || '2단계 인증 설정 실패');
      }
    } catch (err: any) {
      setError(err.message || '요청 오류');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-200">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 border-b border-slate-800 pb-4 mb-4">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">2단계 인증 (M-OTP / TOTP) 설정</h3>
            <p className="text-xs text-slate-400">
              상태: {enabled ? '활성화됨 (로그인 시 6자리 OTP 필수)' : '비활성화됨'}
            </p>
          </div>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          {!enabled && secret && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <p className="text-slate-300 font-semibold">1. OTP 앱(Google/Microsoft Authenticator 등)에 아래 키를 등록하세요:</p>
              <div className="flex items-center justify-between bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg font-mono text-emerald-300">
                <span className="truncate">{secret}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(secret)}
                  className="text-slate-400 hover:text-white ml-2"
                  title="시크릿 키 복사"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              {otpAuthUri && (
                <p className="text-[10px] text-slate-500 break-all font-mono">{otpAuthUri}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">현재 비밀번호 확인</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="현재 비밀번호 입력"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {!enabled && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">OTP 앱 6자리 인증 코드</label>
              <input
                type="text"
                required
                maxLength={6}
                pattern="\d{6}"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono tracking-widest text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2.5 text-xs font-semibold text-white rounded-xl transition ${
              enabled ? 'bg-rose-600 hover:bg-rose-500' : 'bg-emerald-600 hover:bg-emerald-500'
            }`}
          >
            {isLoading ? '처리 중...' : enabled ? '2단계 인증 비활성화' : '2단계 인증 활성화'}
          </button>
        </form>
      </div>
    </div>
  );
}
