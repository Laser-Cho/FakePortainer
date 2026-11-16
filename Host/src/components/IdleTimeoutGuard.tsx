'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface IdleTimeoutGuardProps {
  isAuthenticated: boolean;
  onSessionTerminated: (reason: 'idle_timeout' | 'concurrent_session') => void;
  idleLimitSeconds?: number;
}

export default function IdleTimeoutGuard({
  isAuthenticated,
  onSessionTerminated,
  idleLimitSeconds = 600,
}: IdleTimeoutGuardProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(idleLimitSeconds);
  const lastActivityRef = useRef<number>(Date.now());
  const lastServerPingRef = useRef<number>(Date.now());
  const terminatedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      terminatedRef.current = false;
      setRemainingSeconds(idleLimitSeconds);
      return;
    }

    lastActivityRef.current = Date.now();
    lastServerPingRef.current = Date.now();
    terminatedRef.current = false;

    const handleUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      // Sync user activity to server at most once per 30 seconds
      if (now - lastServerPingRef.current >= 30000) {
        lastServerPingRef.current = now;
        fetch('/api/auth/activity', { method: 'POST' })
          .then(async (res) => {
            if (res.status === 401 && !terminatedRef.current) {
              const data = await res.json().catch(() => ({}));
              terminatedRef.current = true;
              onSessionTerminated(data.concurrentSessionBlocked ? 'concurrent_session' : 'idle_timeout');
            }
          })
          .catch(() => {});
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    const timer = setInterval(async () => {
      const elapsedSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const left = Math.max(0, idleLimitSeconds - elapsedSec);
      setRemainingSeconds(left);

      if (left <= 0 && !terminatedRef.current) {
        terminatedRef.current = true;
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'idle_timeout' }),
          });
        } catch {}
        onSessionTerminated('idle_timeout');
        return;
      }

      // Background session check every 15s (marked as X-Background-Poll so it does NOT reset idle timer)
      if (elapsedSec % 15 === 0) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { 'X-Background-Poll': 'true' },
            cache: 'no-store',
          });
          if (res.status === 401 && !terminatedRef.current) {
            const data = await res.json().catch(() => ({}));
            terminatedRef.current = true;
            onSessionTerminated(data.concurrentSessionBlocked ? 'concurrent_session' : 'idle_timeout');
          }
        } catch {}
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      clearInterval(timer);
    };
  }, [isAuthenticated, idleLimitSeconds, onSessionTerminated]);

  if (!isAuthenticated) return null;

  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const isWarning = remainingSeconds <= 60;

  return (
    <div
      className={`fixed bottom-4 right-4 z-40 px-3 py-1.5 rounded-xl border text-[11px] font-mono shadow-lg backdrop-blur-md flex items-center space-x-2 transition ${
        isWarning
          ? 'bg-amber-950/90 border-amber-700 text-amber-200 animate-pulse'
          : 'bg-slate-900/85 border-slate-800 text-slate-400'
      }`}
      title="10분 이상 미활동 시 보안 정책에 의해 자동 로그아웃됩니다."
    >
      {isWarning ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Clock className="w-3.5 h-3.5 text-blue-400" />
      )}
      <span>
        세션 자동잠금: {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
}
