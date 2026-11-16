'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import PasswordChangeModal from '../../components/PasswordChangeModal';
import PasswordReauthModal from '../../components/PasswordReauthModal';
import TwoFactorModal from '../../components/TwoFactorModal';
import IdleTimeoutGuard from '../../components/IdleTimeoutGuard';
import { AgentConfig, HistoryLogItem, SystemLogItem, UserProfile } from '../../lib/types';
import { checkAgentHealth } from '../../lib/api';
import {
  RefreshCw,
  Search,
  Server,
  Filter,
  ShieldAlert,
  ShieldCheck,
  Users,
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  KeyRound,
  FileText,
  Activity,
  CheckCircle2,
  Download,
  ClipboardCheck,
  Archive,
  Network,
} from 'lucide-react';

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'activity' | 'system' | 'users'>('activity');

  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  const [activityLogs, setActivityLogs] = useState<HistoryLogItem[]>([]);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  const [systemLogs, setSystemLogs] = useState<SystemLogItem[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterLevel, setFilterLevel] = useState<string>('ALL');

  const [userList, setUserList] = useState<UserProfile[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [isReauthOpen, setIsReauthOpen] = useState(false);
  const [pendingReauthAction, setPendingReauthAction] = useState<'users' | 'backup' | null>(null);

  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRealName, setCurrentUserRealName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  const [integrityReport, setIntegrityReport] = useState<{
    valid: boolean;
    totalLogs: number;
    verifiedCount: number;
    legacyUnchainedCount: number;
    tamperedIds: string[];
  } | null>(null);
  const [reviewReport, setReviewReport] = useState<any>(null);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user && !data.user.requirePasswordChange) {
            setAuthToken('authenticated');
            setCurrentUser(data.user.username);
            setCurrentUserRealName(data.user.name);
            setCurrentUserRole(data.user.role);
            setTwoFactorEnabled(!!data.user.twoFactorEnabled);
          }
        }
      } catch (e) {
        console.error('Auth check error', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const fetchWatchListAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch {}
  }, []);

  const fetchActivityLogs = useCallback(async (verify = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/history${verify ? '?verify=true' : ''}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setActivityLogs(data.history || []);
        if (verify && data.integrity) {
          setIntegrityReport(data.integrity);
          showNotification(
            data.integrity.valid ? 'success' : 'error',
            data.integrity.valid
              ? `작업 내역 해시 체인 무결성 검증 통과 (검증: ${data.integrity.verifiedCount}건)`
              : `무결성 경고! 변조 의심 항목 ${data.integrity.tamperedIds.length}건 발견`
          );
        }
      }
    } catch (e) {
      console.error('Failed to fetch activity logs', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSystemLogs = useCallback(async (verify = false) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/system-logs${verify ? '?verify=true' : ''}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSystemLogs(data.logs || []);
        if (verify && data.integrity) {
          setIntegrityReport(data.integrity);
          showNotification(
            data.integrity.valid ? 'success' : 'error',
            data.integrity.valid
              ? `시스템 보안 로그 해시 체인 무결성 검증 통과 (검증: ${data.integrity.verifiedCount}건)`
              : `무결성 경고! 변조 의심 로그 ${data.integrity.tamperedIds.length}건 발견`
          );
        }
      }
    } catch (e) {
      console.error('Failed to fetch system logs', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setUserList(data.users || []);
      } else if (data.requireReauth) {
        setPendingReauthAction('users');
        setIsReauthOpen(true);
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  }, []);

  const refreshCurrentData = () => {
    if (activeTab === 'activity') fetchActivityLogs();
    else if (activeTab === 'system') fetchSystemLogs();
    else if (activeTab === 'users') fetchUsers();
  };

  useEffect(() => {
    if (!authToken) return;
    fetchWatchListAgents();
    fetchActivityLogs();
    if (currentUserRole === 'admin') {
      fetchSystemLogs();
    }
  }, [authToken, currentUserRole, fetchWatchListAgents, fetchActivityLogs, fetchSystemLogs]);

  useEffect(() => {
    if (!authToken) return;
    let isMounted = true;
    const checkHealth = async () => {
      setAgents((currentAgents) => {
        if (currentAgents.length === 0) return currentAgents;
        Promise.all(
          currentAgents.map(async (ag) => {
            const isOnline = await checkAgentHealth(ag);
            return { ...ag, isOnline };
          })
        ).then((updated) => {
          if (!isMounted) return;
          setAgents((latest) => {
            const changed = latest.some((item, i) => updated[i] && item.isOnline !== updated[i].isOnline);
            if (!changed) return latest;
            return latest.map((item, i) => ({
              ...item,
              isOnline: updated[i] ? updated[i].isOnline : item.isOnline,
            }));
          });
        });
        return currentAgents;
      });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authToken]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    window.location.href = '/';
  };

  const handlePeriodicLogReview = async () => {
    const note = window.prompt('접속기록 정기점검 소견/조치사항을 입력하세요:', '이상 징후 없음 - 정기 점검 완료');
    if (note === null) return;
    try {
      const res = await fetch('/api/system-logs/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReviewReport(data.report);
        showNotification('success', '접속기록 정기점검 리포트가 생성 및 감사 로그에 기록되었습니다.');
        fetchSystemLogs();
      } else {
        showNotification('error', data.error || '점검 보고서 생성 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/backup', { cache: 'no-store' });
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}));
        if (errData.requireReauth) {
          setPendingReauthAction('backup');
          setIsReauthOpen(true);
          return;
        }
        showNotification('error', errData.error || '백업 권한이 없습니다.');
        return;
      }
      if (!res.ok) {
        showNotification('error', '백업 생성 실패');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dockwatch-encrypted-backup-${new Date().toISOString().slice(0, 10)}.dwbackup`;
      a.click();
      URL.revokeObjectURL(url);
      showNotification('success', 'AES-256-GCM 암호화 백업 파일이 다운로드되었습니다.');
      fetchSystemLogs();
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleUnlockUser = async (userId: string, username: string) => {
    const tempPassword = window.prompt(
      `'${username}' 계정의 잠금을 해제합니다.\n임시 비밀번호로 초기화하려면 새 비밀번호(8자 이상, 3종 조합)를 입력하고, 기존 비밀번호 유지 시 비워두고 확인을 누르세요:`
    );
    if (tempPassword === null) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'unlock',
          tempPassword: tempPassword.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message || `'${username}' 계정 잠금이 해제되었습니다.`);
        fetchUsers();
        fetchSystemLogs();
      } else if (data.requireReauth) {
        setPendingReauthAction('users');
        setIsReauthOpen(true);
      } else {
        showNotification('error', data.error || '잠금 해제 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleRoleChange = async (userId: string, username: string, newRole: 'admin' | 'user' | 'monitor') => {
    const approvalNote = window.prompt(`'${username}'의 권한을 [${newRole}]로 변경하는 승인 근거/사유를 입력하세요:`);
    if (approvalNote === null) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'update_role', role: newRole, approvalNote }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', `'${username}' 권한이 ${newRole}(으)로 변경되었습니다.`);
        fetchUsers();
        fetchSystemLogs();
      } else if (data.requireReauth) {
        setPendingReauthAction('users');
        setIsReauthOpen(true);
      } else {
        showNotification('error', data.error || '권한 변경 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleAllowedIpsChange = async (userId: string, username: string, currentIps?: string[]) => {
    const input = window.prompt(
      `'${username}' 계정의 접속 허용 IP/CIDR 목록을 쉼표(,)로 구분해 입력하세요 (비우면 제한 없음):\n예: 192.168.1.0/24, 10.0.0.5`,
      (currentIps || []).join(', ')
    );
    if (input === null) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'update_allowed_ips', allowedIps: input }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message);
        fetchUsers();
        fetchSystemLogs();
      } else if (data.requireReauth) {
        setPendingReauthAction('users');
        setIsReauthOpen(true);
      } else {
        showNotification('error', data.error || 'IP 설정 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleReset2FA = async (userId: string, username: string) => {
    if (!window.confirm(`'${username}' 계정의 2단계 인증(OTP)을 초기화하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'reset_2fa' }),
      });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', data.message);
        fetchUsers();
        fetchSystemLogs();
      } else {
        showNotification('error', data.error || 'OTP 초기화 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!window.confirm(`정말로 사용자 '${username}' 계정을 영구 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch(`/api/users?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showNotification('success', `'${username}' 사용자가 삭제되었습니다.`);
        fetchUsers();
        fetchSystemLogs();
      } else if (data.requireReauth) {
        setPendingReauthAction('users');
        setIsReauthOpen(true);
      } else {
        showNotification('error', data.error || '사용자 삭제 실패');
      }
    } catch (e: any) {
      showNotification('error', e.message);
    }
  };

  const filteredActivityLogs = activityLogs.filter((log) => {
    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      log.agentName.toLowerCase().includes(q) ||
      log.detail.toLowerCase().includes(q) ||
      (log.user && log.user.toLowerCase().includes(q)) ||
      (log.userRealName && log.userRealName.toLowerCase().includes(q)) ||
      (log.clientIp && log.clientIp.toLowerCase().includes(q)) ||
      (log.containerName && log.containerName.toLowerCase().includes(q));

    return matchesAction && matchesSearch;
  });

  const filteredSystemLogs = systemLogs.filter((log) => {
    const matchesCat = filterCategory === 'ALL' || log.category === filterCategory;
    const matchesLvl = filterLevel === 'ALL' || log.level === filterLevel;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      log.action.toLowerCase().includes(q) ||
      log.detail.toLowerCase().includes(q) ||
      log.clientIp.toLowerCase().includes(q) ||
      log.user.toLowerCase().includes(q) ||
      (log.userRealName && log.userRealName.toLowerCase().includes(q));

    return matchesCat && matchesLvl && matchesSearch;
  });

  const filteredUsers = userList.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      !searchQuery ||
      u.username.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'START':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
      case 'STOP':
        return 'bg-amber-950/60 text-amber-300 border-amber-800/80';
      case 'RESTART':
        return 'bg-blue-950/60 text-blue-300 border-blue-800/80';
      case 'DELETE':
      case 'VOLUME_DELETE':
      case 'DELETE_VOLUME':
        return 'bg-rose-950/60 text-rose-300 border-rose-800/80';
      case 'PRUNE_IMAGES':
        return 'bg-purple-950/60 text-purple-300 border-purple-800/80';
      case 'ADD_AGENT':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'LOGIN_SUCCESS':
        return 'bg-emerald-950/60 text-emerald-300 border-emerald-800';
      case 'LOGIN_FAILURE':
        return 'bg-rose-950/60 text-rose-300 border-rose-800';
      case 'ACCESS_DENIED':
        return 'bg-red-950 text-red-200 border-red-700 font-bold';
      case 'SECURITY_ALERT':
        return 'bg-amber-950 text-amber-200 border-amber-700 font-bold';
      case 'LOG_REVIEW':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-700';
      case 'ROLE_CHANGE':
        return 'bg-amber-950/60 text-amber-300 border-amber-800';
      case 'USER_MGMT':
        return 'bg-cyan-950/60 text-cyan-300 border-cyan-800';
      case 'OPERATION':
        return 'bg-blue-950/60 text-blue-300 border-blue-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        <span>Verifying Authentication...</span>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <Lock className="w-10 h-10 text-blue-400 mb-3" />
        <h2 className="text-lg font-bold mb-1">인증이 필요합니다</h2>
        <p className="text-xs text-slate-400 mb-4">작업 내역 및 보안 로그 페이지에 접근하려면 먼저 로그인해야 합니다.</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl">
          로그인 화면으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <IdleTimeoutGuard
        isAuthenticated={!!authToken}
        onSessionTerminated={() => {
          window.location.href = '/';
        }}
      />

      <Navbar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onOpenAddAgent={() => {
          window.location.href = '/';
        }}
        isAuthenticated={!!authToken}
        currentUser={currentUser}
        currentUserRealName={currentUserRealName}
        currentUserRole={currentUserRole}
        twoFactorEnabled={twoFactorEnabled}
        onOpenLogin={() => {
          window.location.href = '/';
        }}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsPasswordChangeOpen(true)}
        onOpenTwoFactor={() => setIsTwoFactorOpen(true)}
      />

      <div className="flex-1 flex w-full max-w-[1920px] mx-auto min-h-[calc(100vh-61px)]">
        <Sidebar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onOpenAddAgent={() => {
            window.location.href = '/';
          }}
          currentUserRole={currentUserRole}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          {notification && (
            <div
              className={`mb-6 p-4 rounded-xl border flex items-center space-x-2 text-sm shadow-lg ${
                notification.type === 'success'
                  ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/80 border-rose-800 text-rose-200'
              }`}
            >
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
              )}
              <span>{notification.message}</span>
            </div>
          )}

          {/* Header Title */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 mb-6 border-b border-slate-800 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">
                  사용자 작업 내역 & 시스템 보안 로그
                </h1>
                <p className="text-xs text-slate-400">
                  무결성 해시 체인 기반 감사 로그 추적, 정기 점검 리포트, 암호화 백업 및 계정 보안 통제
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {currentUserRole === 'admin' && (
                <>
                  <button
                    onClick={handlePeriodicLogReview}
                    className="flex items-center space-x-1.5 bg-indigo-950/70 hover:bg-indigo-900/70 border border-indigo-700/70 text-indigo-200 px-3 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>접속기록 정기점검</span>
                  </button>
                  <button
                    onClick={handleDownloadBackup}
                    className="flex items-center space-x-1.5 bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-700/70 text-emerald-200 px-3 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>암호화 백업(.dwbackup)</span>
                  </button>
                </>
              )}

              <button
                onClick={refreshCurrentData}
                disabled={isLoading}
                className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 px-4 py-2 rounded-xl text-xs font-semibold shadow transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
                <span>새로고침</span>
              </button>
            </div>
          </div>

          {/* Security Policy Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">AES-256-GCM + 해시 체인</p>
                <p className="text-sm font-bold text-slate-200">로그 위변조 검증 및 장기 보관(1~5년)</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">강화 인증 & 비밀번호 정책</p>
                <p className="text-sm font-bold text-slate-200">2FA(OTP) / IP 제한 / 90일 만료</p>
              </div>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center space-x-3.5">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400">접근 & 세션 통제</p>
                <p className="text-sm font-bold text-slate-200">5회 실패·90일 미접속 잠금 / 10분 타임아웃</p>
              </div>
            </div>
          </div>

          {reviewReport && (
            <div className="mb-6 bg-indigo-950/40 border border-indigo-800/80 rounded-xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-indigo-200">
                  접속기록 정기점검 리포트 ({new Date(reviewReport.reviewedAt).toLocaleString()}) - 점검자: {reviewReport.reviewer}
                </span>
                <button onClick={() => setReviewReport(null)} className="text-slate-400 hover:text-white">
                  닫기
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300 font-mono">
                <div>최근 30일 이벤트: {reviewReport.summaryLast30Days.totalEvents}건</div>
                <div>로그인 실패: {reviewReport.summaryLast30Days.loginFailures}건</div>
                <div>접근 차단: {reviewReport.summaryLast30Days.accessDenied}건</div>
                <div>
                  해시 무결성:{' '}
                  {reviewReport.integrity.systemLogs.valid && reviewReport.integrity.historyLogs.valid ? '정상' : '이상'}
                </div>
              </div>
            </div>
          )}

          {/* Tab Selector */}
          <div className="flex border-b border-slate-800 mb-6 space-x-2">
            <button
              onClick={() => {
                setActiveTab('activity');
                setSearchQuery('');
                setIntegrityReport(null);
              }}
              className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold rounded-t-xl transition border-b-2 ${
                activeTab === 'activity'
                  ? 'bg-slate-900 text-blue-400 border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>사용자 작업 내역 ({activityLogs.length})</span>
            </button>

            {currentUserRole === 'admin' && (
              <>
                <button
                  onClick={() => {
                    setActiveTab('system');
                    setSearchQuery('');
                    setIntegrityReport(null);
                  }}
                  className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold rounded-t-xl transition border-b-2 ${
                    activeTab === 'system'
                      ? 'bg-slate-900 text-blue-400 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>시스템 보안 로그 ({systemLogs.length})</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab('users');
                    setSearchQuery('');
                    setIntegrityReport(null);
                    fetchUsers();
                  }}
                  className={`flex items-center space-x-2 px-5 py-3 text-xs font-bold rounded-t-xl transition border-b-2 ${
                    activeTab === 'users'
                      ? 'bg-slate-900 text-blue-400 border-blue-500'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>사용자 계정 관리 ({userList.length})</span>
                </button>
              </>
            )}
          </div>

          {/* Search, Filters & Actions */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 bg-slate-900/70 p-3.5 rounded-xl border border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  activeTab === 'activity'
                    ? '사용자, IP, 노드, 컨테이너, 작업 내용 검색...'
                    : activeTab === 'system'
                    ? '액션, 상세 내용, IP, 사용자 검색...'
                    : '아이디, 실명, 이메일 검색...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === 'activity' && (
                <>
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-400">작업:</span>
                    <select
                      value={filterAction}
                      onChange={(e) => setFilterAction(e.target.value)}
                      className="bg-transparent focus:outline-none cursor-pointer text-slate-200 text-xs"
                    >
                      <option value="ALL" className="bg-slate-900">전체 작업</option>
                      <option value="START" className="bg-slate-900">START (시작)</option>
                      <option value="STOP" className="bg-slate-900">STOP (중지)</option>
                      <option value="RESTART" className="bg-slate-900">RESTART (재시작)</option>
                      <option value="DELETE" className="bg-slate-900">DELETE (컨테이너 삭제)</option>
                      <option value="VOLUME_DELETE" className="bg-slate-900">VOLUME_DELETE (볼륨 삭제)</option>
                      <option value="PRUNE_IMAGES" className="bg-slate-900">PRUNE_IMAGES (이미지 정리)</option>
                      <option value="ADD_AGENT" className="bg-slate-900">ADD_AGENT (노드 추가)</option>
                    </select>
                  </div>
                  <button
                    onClick={() => fetchActivityLogs(true)}
                    className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-emerald-300"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>무결성 검증</span>
                  </button>
                  <a
                    href="/api/history?format=csv"
                    className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV 다운로드</span>
                  </a>
                </>
              )}

              {activeTab === 'system' && (
                <>
                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[11px] text-slate-400">카테고리:</span>
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="bg-transparent focus:outline-none cursor-pointer text-slate-200 text-xs"
                    >
                      <option value="ALL" className="bg-slate-900">전체 분류</option>
                      <option value="LOGIN_SUCCESS" className="bg-slate-900">LOGIN_SUCCESS</option>
                      <option value="LOGIN_FAILURE" className="bg-slate-900">LOGIN_FAILURE</option>
                      <option value="ACCESS_DENIED" className="bg-slate-900">ACCESS_DENIED</option>
                      <option value="SECURITY_ALERT" className="bg-slate-900">SECURITY_ALERT</option>
                      <option value="LOG_REVIEW" className="bg-slate-900">LOG_REVIEW</option>
                      <option value="ROLE_CHANGE" className="bg-slate-900">ROLE_CHANGE</option>
                      <option value="USER_MGMT" className="bg-slate-900">USER_MGMT</option>
                      <option value="OPERATION" className="bg-slate-900">OPERATION</option>
                      <option value="EVENT" className="bg-slate-900">EVENT</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300">
                    <span className="text-[11px] text-slate-400">심각도:</span>
                    <select
                      value={filterLevel}
                      onChange={(e) => setFilterLevel(e.target.value)}
                      className="bg-transparent focus:outline-none cursor-pointer text-slate-200 text-xs"
                    >
                      <option value="ALL" className="bg-slate-900">전체 레벨</option>
                      <option value="INFO" className="bg-slate-900">INFO</option>
                      <option value="WARN" className="bg-slate-900">WARN</option>
                      <option value="ERROR" className="bg-slate-900">ERROR</option>
                    </select>
                  </div>

                  <button
                    onClick={() => fetchSystemLogs(true)}
                    className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-emerald-300"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>무결성 검증</span>
                  </button>
                  <a
                    href="/api/system-logs?format=csv"
                    className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>CSV 다운로드</span>
                  </a>
                </>
              )}
            </div>
          </div>

          {integrityReport && (
            <div
              className={`mb-4 p-3 rounded-xl border text-xs flex items-center justify-between ${
                integrityReport.valid
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-800 text-rose-200'
              }`}
            >
              <span>
                무결성 점검 결과: 전체 {integrityReport.totalLogs}건 중 해시 체인 검증 {integrityReport.verifiedCount}건, 레거시(미서명) {integrityReport.legacyUnchainedCount}건, 변조 의심 {integrityReport.tamperedIds.length}건
              </span>
              <button onClick={() => setIntegrityReport(null)} className="underline ml-2">
                닫기
              </button>
            </div>
          )}

          {/* TAB 1: User Activity History */}
          {activeTab === 'activity' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">작업 시간</th>
                      <th className="py-3 px-4">사용자 (ID / 실명)</th>
                      <th className="py-3 px-4">접속 IP</th>
                      <th className="py-3 px-4">대상 노드</th>
                      <th className="py-3 px-4">작업 유형</th>
                      <th className="py-3 px-4">상세 내역</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredActivityLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          기록된 사용자 작업 내역이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredActivityLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-blue-400 font-mono">{log.user || 'Operator'}</span>
                              {log.userRealName && (
                                <span className="text-[11px] text-slate-400 font-normal">({log.userRealName})</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap text-[11px]">
                            {log.clientIp || '127.0.0.1'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px]">
                              <Server className="w-3 h-3 mr-1 text-slate-400" />
                              {log.agentName}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getActionBadgeColor(
                                log.actionType
                              )}`}
                            >
                              {log.actionType}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {log.containerName && (
                              <span className="font-semibold text-amber-300 mr-1.5">[{log.containerName}]</span>
                            )}
                            <span>{log.detail}</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: System Security Logs (Admin only) */}
          {activeTab === 'system' && currentUserRole === 'admin' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">로그 시간</th>
                      <th className="py-3 px-4">분류 (Category)</th>
                      <th className="py-3 px-4">레벨</th>
                      <th className="py-3 px-4">접속 IP</th>
                      <th className="py-3 px-4">사용자</th>
                      <th className="py-3 px-4">액션</th>
                      <th className="py-3 px-4">상세 감사 로그 내용</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredSystemLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          기록된 시스템 보안 로그가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      filteredSystemLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap font-mono text-[11px]">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getCategoryBadgeColor(
                                log.category
                              )}`}
                            >
                              {log.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.level === 'ERROR'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : log.level === 'WARN'
                                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {log.level}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-cyan-400 whitespace-nowrap text-[11px]">
                            {log.clientIp}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-200 whitespace-nowrap">
                            <span>{log.user}</span>
                            {log.userRealName && (
                              <span className="text-[11px] text-slate-400 font-normal ml-1">({log.userRealName})</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-blue-300 whitespace-nowrap">
                            {log.action}
                          </td>
                          <td className="py-3 px-4 text-slate-300">{log.detail}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: User Accounts Management (Admin only) */}
          {activeTab === 'users' && currentUserRole === 'admin' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-200">등록된 사용자 계정 목록</h3>
                  <p className="text-xs text-slate-400">
                    사용자 권한 변경(승인 사유 기록), 허용 IP 제한, 2FA OTP 관리, 잠금 해제 및 비밀번호 초기화
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
                      <th className="py-3 px-4">사용자 아이디</th>
                      <th className="py-3 px-4">실명 / 이메일</th>
                      <th className="py-3 px-4">역할 (Role)</th>
                      <th className="py-3 px-4">접속 허용 IP / 2FA</th>
                      <th className="py-3 px-4">비밀번호 (90일)</th>
                      <th className="py-3 px-4">계정 상태</th>
                      <th className="py-3 px-4 text-right">관리 액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-bold text-blue-400 font-mono">
                          <div>{u.username}</div>
                          {u.isReservedUsername && (
                            <span className="text-[10px] text-amber-400 font-normal">⚠ 예약 기본 계정명</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-200">{u.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{u.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={u.role}
                            disabled={u.username === currentUser}
                            onChange={(e) =>
                              handleRoleChange(u.id, u.username, e.target.value as 'admin' | 'user' | 'monitor')
                            }
                            className={`text-xs font-semibold px-2 py-1 rounded border focus:outline-none cursor-pointer ${
                              u.role === 'admin'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                                : u.role === 'monitor'
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            <option value="monitor" className="bg-slate-900 text-slate-200">
                              MONITOR (모니터링 계정)
                            </option>
                            <option value="user" className="bg-slate-900 text-slate-200">
                              USER (일반 사용자)
                            </option>
                            <option value="admin" className="bg-slate-900 text-slate-200">
                              ADMIN (시스템 관리자)
                            </option>
                          </select>
                        </td>
                        <td className="py-3 px-4 space-y-1">
                          <button
                            onClick={() => handleAllowedIpsChange(u.id, u.username, u.allowedIps)}
                            className="inline-flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300"
                          >
                            <Network className="w-3 h-3" />
                            <span>
                              {u.allowedIps && u.allowedIps.length > 0
                                ? `${u.allowedIps.length}개 IP 제한`
                                : '전체 IP 허용'}
                            </span>
                          </button>
                          <div>
                            {u.twoFactorEnabled ? (
                              <button
                                onClick={() => handleReset2FA(u.id, u.username)}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-rose-950 hover:text-rose-300"
                                title="클릭 시 2FA OTP 초기화"
                              >
                                OTP 활성 (초기화)
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-500">OTP 미설정</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-mono text-slate-300 text-[11px]">
                            {new Date(u.passwordChangedAt).toLocaleDateString()}
                          </p>
                          {u.requirePasswordChange ? (
                            <span className="inline-flex items-center text-[10px] text-rose-400 font-bold">
                              <AlertTriangle className="w-3 h-3 mr-1" /> 재설정 필요
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[10px] text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> 정상 (90일 이내)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {u.isLocked ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              <Lock className="w-3 h-3 mr-1" /> {u.lockReason || '잠김'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/80">
                              <Unlock className="w-3 h-3 mr-1" /> 정상
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                          {u.isLocked && (
                            <button
                              onClick={() => handleUnlockUser(u.id, u.username)}
                              className="px-2.5 py-1 text-xs font-semibold bg-emerald-900/50 hover:bg-emerald-800 border border-emerald-700/60 text-emerald-200 rounded-lg transition"
                            >
                              잠금 해제/초기화
                            </button>
                          )}
                          {u.username !== currentUser && (
                            <button
                              onClick={() => handleDeleteUser(u.id, u.username)}
                              className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/60 border border-rose-900/60 rounded-lg transition"
                              title="계정 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {isPasswordChangeOpen && (
        <PasswordChangeModal
          isOpen={isPasswordChangeOpen}
          onClose={() => setIsPasswordChangeOpen(false)}
          username={currentUser || ''}
          onSuccess={() => {
            showNotification('success', '비밀번호가 안전하게 변경되었습니다.');
          }}
        />
      )}

      <PasswordReauthModal
        isOpen={isReauthOpen}
        onClose={() => {
          setIsReauthOpen(false);
          setPendingReauthAction(null);
        }}
        onVerified={() => {
          if (pendingReauthAction === 'users') fetchUsers();
          if (pendingReauthAction === 'backup') handleDownloadBackup();
          setPendingReauthAction(null);
        }}
      />

      <TwoFactorModal
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
        onStatusChange={(enabled) => setTwoFactorEnabled(enabled)}
      />
    </div>
  );
}
