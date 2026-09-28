'use client';

import React, { useState } from 'react';
import { X, KeyRound, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  isExpiredPrompt?: boolean;
  onSuccess?: () => void;
}

export default function PasswordChangeModal({
  isOpen,
  onClose,
  username = '',
  isExpiredPrompt = false,
  onSuccess,
}: PasswordChangeModalProps) {
  const [targetUsername, setTargetUsername] = useState(username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  const isComplexityMet = validateComplexityClient(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (!isComplexityMet) {
      setError('비밀번호는 영대문자, 영소문자, 숫자, 특수문자 중 3가지 이상을 조합하여 8자 이상이어야 합니다.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername || username,
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || '비밀번호가 성공적으로 변경되었습니다. (90일 유효기간 갱신)');
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(data.error || '비밀번호 변경에 실패했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '비밀번호 변경 요청 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">비밀번호 재설정 (Password Reset)</h2>
              <p className="text-xs text-slate-400">
                {isExpiredPrompt ? '비밀번호 유효기간(90일)이 만료되어 변경이 필요합니다.' : '계정 비밀번호를 안전하게 변경합니다.'}
              </p>
            </div>
          </div>
          {!isExpiredPrompt && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {isExpiredPrompt && (
          <div className="mb-4 bg-amber-950/50 border border-amber-800/80 text-amber-200 text-xs p-3 rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              보안 정책상 비밀번호 유효기간(90일)이 초과되었습니다. 계속 이용하시려면 새 비밀번호로 재설정해야 합니다.
            </span>
          </div>
        )}

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
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">사용자 아이디</label>
            <input
              type="text"
              required
              disabled={!!username}
              value={targetUsername || username}
              onChange={(e) => setTargetUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 disabled:opacity-60 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">현재 비밀번호</label>
            <input
              type="password"
              required
              placeholder="현재 비밀번호 입력"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-400">새 비밀번호</label>
              <span className={`text-[10px] font-semibold ${isComplexityMet ? 'text-emerald-400' : 'text-slate-500'}`}>
                {isComplexityMet ? '✓ 복잡도 충족' : '영대/소문자, 숫자, 특수문자 중 3가지 이상 8자'}
              </span>
            </div>
            <input
              type="password"
              required
              placeholder="새 비밀번호 (8자 이상, 3종류 조합)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none transition ${
                newPassword ? (isComplexityMet ? 'border-emerald-600 focus:border-emerald-500' : 'border-amber-600 focus:border-amber-500') : 'border-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              required
              placeholder="새 비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none transition ${
                confirmPassword && confirmPassword === newPassword ? 'border-emerald-600' : 'border-slate-800 focus:border-blue-500'
              }`}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading || !isComplexityMet}
              className="w-full flex items-center justify-center space-x-2 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl shadow-lg transition"
            >
              <KeyRound className="w-4 h-4" />
              <span>{isLoading ? '변경 처리 중...' : '비밀번호 재설정 및 90일 갱신'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
