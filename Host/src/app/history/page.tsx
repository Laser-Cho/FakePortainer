'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import { AgentConfig, HistoryLogItem } from '../../lib/types';
import { checkAgentHealth } from '../../lib/api';
import { History, RefreshCw, Search, Server, Box, Filter, ShieldAlert } from 'lucide-react';

export default function HistoryPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [logs, setLogs] = useState<HistoryLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('ALL');

  // Modals & Auth State
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  const fetchWatchListAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (e) {
      console.error('Failed to fetch agents', e);
    }
  }, []);

  const fetchHistoryLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/history', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.history || []);
      }
    } catch (e) {
      console.error('Failed to fetch history logs', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWatchListAgents();
    fetchHistoryLogs();
  }, [fetchWatchListAgents, fetchHistoryLogs]);

  // Health checks: Polling agent status periodically in History page
  useEffect(() => {
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
            const changed = latest.some(
              (item, i) => updated[i] && item.isOnline !== updated[i].isOnline
            );
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
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setAuthToken('authenticated');
            setCurrentUser(data.username || 'Admin');
          }
        }
      } catch (e) {}
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setAuthToken(null);
    setCurrentUser(null);
  };

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !searchQuery ||
      log.agentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.containerName && log.containerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.detail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actionType.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAction = filterAction === 'ALL' || log.actionType === filterAction;
    const matchesAgent = !selectedAgentId || selectedAgentId === 'all' || agents.find((a) => a.id === selectedAgentId)?.name === log.agentName;

    return matchesSearch && matchesAction && matchesAgent;
  });

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'START':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">START</span>;
      case 'STOP':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-800">STOP</span>;
      case 'RESTART':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-950 text-blue-300 border border-blue-800">RESTART</span>;
      case 'DELETE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-950 text-red-400 border border-red-800">DELETE</span>;
      case 'PRUNE_IMAGES':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800 font-mono">PRUNE</span>;
      case 'ADD_AGENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">ADD NODE</span>;
      case 'REMOVE_AGENT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800">REMOVE NODE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">{action}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        isAuthenticated={!!authToken}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex w-full max-w-[1920px] mx-auto min-h-[calc(100vh-61px)]">
        <Sidebar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onOpenAddAgent={() => setIsAddAgentOpen(true)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2.5">
                <History className="w-6 h-6 text-blue-400" />
                <span>컨테이너 & 서버 이력 추적 (Audit History)</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                모든 등록 서버의 컨테이너 제어 액션(시작/정지/재시작/삭제) 및 서버 노드 변경 기록
              </p>
            </div>

            <button
              onClick={fetchHistoryLogs}
              disabled={isLoading}
              className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl hover:bg-slate-800 transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>이력 새로고침</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="컨테이너명, 머신명, 상세 검색..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <div className="flex items-center space-x-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-400">
                <Filter className="w-3.5 h-3.5" />
                <span>액션 필터:</span>
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value="ALL" className="bg-slate-900">전체 액션</option>
                  <option value="START" className="bg-slate-900">START</option>
                  <option value="STOP" className="bg-slate-900">STOP</option>
                  <option value="RESTART" className="bg-slate-900">RESTART</option>
                  <option value="DELETE" className="bg-slate-900">DELETE</option>
                  <option value="PRUNE_IMAGES" className="bg-slate-900">PRUNE</option>
                  <option value="ADD_AGENT" className="bg-slate-900">ADD NODE</option>
                  <option value="REMOVE_AGENT" className="bg-slate-900">REMOVE NODE</option>
                </select>
              </div>

              <span className="text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg font-mono">
                조회: <strong className="text-blue-400">{filteredLogs.length}</strong> 건
              </span>
            </div>
          </div>

          {/* History Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
                <p className="text-slate-400 text-xs">이력 데이터를 불러오는 중...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center">
                <History className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-slate-300 font-semibold text-sm">기록된 이력이 없습니다</h3>
                <p className="text-slate-500 text-xs mt-1">컨테이너 제어 명령이나 이벤트를 실행하면 여기에 실시간으로 기록됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">발생 일시 (Timestamp)</th>
                      <th className="px-6 py-3.5">서버 노드 (Node)</th>
                      <th className="px-6 py-3.5">액션 구분</th>
                      <th className="px-6 py-3.5">컨테이너/대상</th>
                      <th className="px-6 py-3.5">상세 내용 (Detail)</th>
                      <th className="px-6 py-3.5">실행 사용자</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-6 py-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-200">
                          <span className="inline-flex items-center text-xs text-blue-300 bg-blue-950/50 border border-blue-800/50 px-2 py-0.5 rounded">
                            <Server className="w-3 h-3 mr-1 text-blue-400" />
                            {log.agentName}
                          </span>
                        </td>
                        <td className="px-6 py-4">{getActionBadge(log.actionType)}</td>
                        <td className="px-6 py-4 font-mono text-slate-100 font-semibold">
                          {log.containerName ? (
                            <div className="flex items-center space-x-1.5">
                              <Box className="w-3.5 h-3.5 text-slate-400" />
                              <span>{log.containerName}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-300">{log.detail}</td>
                        <td className="px-6 py-4 font-mono text-slate-400 text-[11px]">
                          <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                            {log.user || 'Admin'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
