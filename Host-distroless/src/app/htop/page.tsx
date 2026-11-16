'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import PasswordChangeModal from '../../components/PasswordChangeModal';
import TwoFactorModal from '../../components/TwoFactorModal';
import IdleTimeoutGuard from '../../components/IdleTimeoutGuard';
import { AgentConfig } from '../../lib/types';
import { checkAgentHealth } from '../../lib/api';
import { Activity, Server, RefreshCw, HardDrive, AlertCircle, Lock } from 'lucide-react';

interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  user: string;
  state: string;
}

interface SystemRes {
  cpu: { load: number; user: number; sys: number };
  mem: { total: number; used: number; free: number };
  processes: ProcessInfo[];
}

export default function HtopPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  const [sysData, setSysData] = useState<SystemRes | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [sortBy, setSortBy] = useState<'cpu' | 'mem'>('cpu');
  const [sortDesc, setSortDesc] = useState(true);

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRealName, setCurrentUserRealName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);

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
      } catch {}
      finally {
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
    } catch (e) {
      console.error('Failed to fetch watch list agents', e);
    }
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchWatchListAgents();
    }
  }, [authToken, fetchWatchListAgents]);

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
          if (isMounted) setAgents(updated);
        });
        return currentAgents;
      });
    };
    checkHealth();
    const intervalId = setInterval(checkHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [authToken]);

  const fetchHtopData = useCallback(async () => {
    if (!authToken || selectedAgentId === 'all') {
      setSysData(null);
      return;
    }
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) return;

    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Background-Poll': 'true',
        },
        body: JSON.stringify({
          agentUrl: agent.url,
          endpoint: '/api/system/htop',
          method: 'GET',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSysData(data);
      } else {
        setErrorMsg(data.error || 'Failed to fetch server status');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with proxy');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, selectedAgentId, agents]);

  useEffect(() => {
    if (!authToken) return;
    fetchHtopData();
    const interval = setInterval(fetchHtopData, 5000);
    return () => clearInterval(interval);
  }, [authToken, fetchHtopData]);

  const handleSort = (field: 'cpu' | 'mem') => {
    if (sortBy === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  };

  const sortedProcesses = React.useMemo(() => {
    if (!sysData || !sysData.processes) return [];
    return [...sysData.processes].sort((a, b) => {
      const valA = a[sortBy] || 0;
      const valB = b[sortBy] || 0;
      return sortDesc ? valB - valA : valA - valB;
    });
  }, [sysData, sortBy, sortDesc]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

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
        <p className="text-xs text-slate-400 mb-4">서버 상황 조회(htop) 페이지에 접근하려면 먼저 로그인해야 합니다.</p>
        <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl">
          로그인 화면으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100">
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
        onLogout={async () => {
          await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
          window.location.href = '/';
        }}
        onOpenChangePassword={() => setIsPasswordChangeOpen(true)}
        onOpenTwoFactor={() => setIsTwoFactorOpen(true)}
      />

      <div className="flex flex-1">
        <Sidebar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onOpenAddAgent={() => {
            window.location.href = '/';
          }}
          currentUserRole={currentUserRole}
        />

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6">
            <h1 className="text-xl font-bold flex items-center space-x-2">
              <Activity className="w-6 h-6 text-emerald-400" />
              <span>서버 상황 조회 (htop)</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              에이전트 노드의 실시간 프로세스 및 리소스 점유율을 확인합니다.
            </p>
          </div>

          {selectedAgentId === 'all' ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-900/50 border border-slate-800 rounded-2xl">
              <Server className="w-12 h-12 text-slate-600 mb-4" />
              <p className="text-slate-400 font-medium">좌측 사이드바에서 관제할 특정 노드를 선택해 주세요.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="px-3 py-1.5 bg-blue-900/40 text-blue-300 rounded-lg border border-blue-800/50 flex items-center space-x-2">
                    <Server className="w-4 h-4" />
                    <span className="text-sm font-semibold">{selectedAgent?.name || 'Unknown'}</span>
                  </div>
                  {isLoading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleSort('cpu')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 border ${
                      sortBy === 'cpu'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>CPU 점유율 순</span>
                  </button>
                  <button
                    onClick={() => handleSort('mem')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-1 border ${
                      sortBy === 'mem'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>메모리 점유율 순</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 bg-rose-950/40 border border-rose-900/50 text-rose-400 px-4 py-3 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{errorMsg}</span>
                </div>
              )}

              {sysData && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                      <div className="flex items-center space-x-2 mb-2 text-slate-400">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">CPU Usage</span>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-100">{sysData.cpu.load.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
                      <div className="flex items-center space-x-2 mb-2 text-slate-400">
                        <HardDrive className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Memory Usage</span>
                      </div>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-3xl font-bold text-slate-100">
                          {((sysData.mem.used / sysData.mem.total) * 100).toFixed(1)}%
                        </span>
                        <span className="text-xs text-slate-500">
                          / {(sysData.mem.total / 1024 / 1024 / 1024).toFixed(1)} GB
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                            <th className="px-4 py-3 font-semibold">PID</th>
                            <th className="px-4 py-3 font-semibold">User</th>
                            <th className="px-4 py-3 font-semibold">Command</th>
                            <th className="px-4 py-3 font-semibold w-24">CPU %</th>
                            <th className="px-4 py-3 font-semibold w-24">MEM %</th>
                            <th className="px-4 py-3 font-semibold w-24">State</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-800/50">
                          {sortedProcesses.slice(0, 100).map((proc, idx) => (
                            <tr key={`${proc.pid}-${idx}`} className="hover:bg-slate-800/30 transition">
                              <td className="px-4 py-2 text-slate-300 font-mono text-xs">{proc.pid}</td>
                              <td className="px-4 py-2 text-slate-400 text-xs">{proc.user}</td>
                              <td className="px-4 py-2 font-medium text-slate-200 truncate max-w-[200px]" title={proc.name}>
                                {proc.name}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-emerald-400">{proc.cpu.toFixed(1)}%</td>
                              <td className="px-4 py-2 font-mono text-xs text-purple-400">{proc.mem.toFixed(1)}%</td>
                              <td className="px-4 py-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 uppercase tracking-wide">
                                  {proc.state || 'UNK'}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {sortedProcesses.length === 0 && (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">
                                프로세스 정보가 없습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {isPasswordChangeOpen && (
        <PasswordChangeModal
          isOpen={isPasswordChangeOpen}
          onClose={() => setIsPasswordChangeOpen(false)}
          username={currentUser || ''}
        />
      )}

      <TwoFactorModal
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
        onStatusChange={(enabled) => setTwoFactorEnabled(enabled)}
      />
    </div>
  );
}
