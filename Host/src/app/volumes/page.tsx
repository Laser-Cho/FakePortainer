'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import ConfirmModal from '../../components/ConfirmModal';
import { AgentConfig, VolumeInfo } from '../../lib/types';
import { checkAgentHealth, fetchVolumes, deleteVolume } from '../../lib/api';
import { HardDrive, RefreshCw, Search, Server, Box, Trash2, Database, ShieldAlert, Layers } from 'lucide-react';

export default function VolumesPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<{ volume: VolumeInfo; agent: AgentConfig } | null>(null);

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
      console.error('Failed to fetch watch list agents', e);
    }
  }, []);

  useEffect(() => {
    fetchWatchListAgents();
  }, [fetchWatchListAgents]);

  // Periodic agent health check
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

  // Check Auth
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

  const recordHistory = async (
    agentName: string,
    agentUrl: string,
    actionType: string,
    detail: string
  ) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          agentUrl,
          actionType,
          detail,
          user: currentUser || 'Admin',
        }),
      });
    } catch (e) {
      console.error('Failed to record history', e);
    }
  };

  const loadVolumes = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      if (selectedAgentId === 'all') {
        const targetAgents = agents.filter((a) => a.isOnline);
        if (targetAgents.length === 0 && agents.length > 0) {
          setErrorMsg('All registered agent nodes are currently offline.');
          setVolumes([]);
          setIsLoading(false);
          return;
        }

        const volumeResults = await Promise.all(
          targetAgents.map(async (ag) => {
            try {
              const vList = await fetchVolumes(ag);
              return vList.map((v) => ({
                ...v,
                agentName: ag.name,
                agentUrl: ag.url,
              }));
            } catch (err: any) {
              console.error(`Error fetching volumes from ${ag.name}:`, err.message);
              return [];
            }
          })
        );

        const allVols = volumeResults.flat();
        setVolumes(allVols);
      } else {
        const targetAgent = agents.find((a) => a.id === selectedAgentId);
        if (!targetAgent) {
          setVolumes([]);
          setIsLoading(false);
          return;
        }
        if (!targetAgent.isOnline) {
          setErrorMsg(`Agent node '${targetAgent.name}' is currently offline.`);
          setVolumes([]);
          setIsLoading(false);
          return;
        }

        const vList = await fetchVolumes(targetAgent);
        setVolumes(vList.map((v) => ({ ...v, agentName: targetAgent.name, agentUrl: targetAgent.url })));
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load volume list');
    } finally {
      setIsLoading(false);
    }
  }, [agents, selectedAgentId]);

  useEffect(() => {
    if (agents.length > 0) {
      loadVolumes();
    }
  }, [agents, selectedAgentId, loadVolumes]);

  const handleDeleteVolumeConfirm = async () => {
    if (!deleteTarget) return;
    const { volume, agent } = deleteTarget;

    try {
      await deleteVolume(agent, volume.name);
      await recordHistory(agent.name, agent.url, 'DELETE_VOLUME', `Deleted volume '${volume.name}'`);
      await loadVolumes();
    } catch (err: any) {
      alert(`볼륨 삭제 실패: ${err.message}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setAuthToken(null);
    setCurrentUser(null);
  };

  const filteredVolumes = volumes.filter((v) => {
    const query = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(query) ||
      v.driver.toLowerCase().includes(query) ||
      (v.agentName && v.agentName.toLowerCase().includes(query)) ||
      v.attachedContainers.some((c) => c.name.toLowerCase().includes(query))
    );
  });

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
                <HardDrive className="w-6 h-6 text-purple-400" />
                <span>도커 볼륨 관리 (Docker Volumes)</span>
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                등록된 각 서버 노드의 영구 데이터 볼륨 및 연결된 컨테이너(Attached Containers) 관제
              </p>
            </div>

            <button
              onClick={loadVolumes}
              disabled={isLoading}
              className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl hover:bg-slate-800 transition shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>볼륨 목록 새로고침</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Search Bar */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 mb-6 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="볼륨명, 드라이버, 연결 컨테이너, 서버 검색..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition"
              />
            </div>

            <div className="text-xs text-slate-400 font-mono">
              조회된 볼륨: <strong className="text-purple-400">{filteredVolumes.length}</strong> 개
            </div>
          </div>

          {/* Volume Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-3" />
                <p className="text-slate-400 text-xs">도커 데몬으로부터 볼륨 정보를 조회하는 중...</p>
              </div>
            ) : filteredVolumes.length === 0 ? (
              <div className="p-12 text-center">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-slate-300 font-semibold text-sm">등록되거나 검색된 도커 볼륨이 없습니다</h3>
                <p className="text-slate-500 text-xs mt-1">컨테이너가 볼륨을 생성하거나 사용하면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">볼륨 이름 (Volume Name)</th>
                      <th className="px-6 py-3.5">서버 노드 (Node)</th>
                      <th className="px-6 py-3.5">드라이버 (Driver)</th>
                      <th className="px-6 py-3.5">연결된 컨테이너 (Attached Containers)</th>
                      <th className="px-6 py-3.5">호스트 마운트 지점 (Mountpoint)</th>
                      <th className="px-6 py-3.5 text-right">제어 (Actions)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredVolumes.map((vol, idx) => {
                      const agent = agents.find((a) => a.name === vol.agentName) || {
                        id: 'unknown',
                        name: vol.agentName || 'Unknown',
                        url: vol.agentUrl || '',
                        token: '1',
                      };

                      return (
                        <tr key={`${vol.name}-${idx}`} className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-4 font-mono font-bold text-slate-100 break-all">
                            <div className="flex items-center space-x-2">
                              <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
                              <span>{vol.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center text-xs text-blue-300 bg-blue-950/50 border border-blue-800/50 px-2 py-0.5 rounded">
                              <Server className="w-3 h-3 mr-1 text-blue-400" />
                              {vol.agentName}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-slate-400">
                            <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                              {vol.driver}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {vol.attachedContainers.length === 0 ? (
                              <span className="text-slate-500 italic text-[11px]">연결된 컨테이너 없음 (Unused)</span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {vol.attachedContainers.map((ac) => (
                                  <span
                                    key={ac.id}
                                    className={`inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                                      ac.state === 'running'
                                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                        : 'bg-slate-950 text-slate-400 border-slate-800'
                                    }`}
                                  >
                                    <Box className="w-3 h-3 mr-1 shrink-0" />
                                    <span>{ac.name}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-slate-400 break-all max-w-xs">
                            {vol.mountpoint}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setDeleteTarget({ volume: vol, agent })}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 hover:text-rose-300 transition"
                              title="볼륨 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Delete Volume Confirm Modal with Strict Name Matching */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteVolumeConfirm}
          actionType="delete_volume"
          title="도커 볼륨 영구 삭제 확인"
          description={`볼륨 '${deleteTarget.volume.name}'을(를) 삭제하시겠습니까? 볼륨 내부 데이터가 완전히 제거됩니다.`}
          confirmText="볼륨 영구 삭제"
          requireMatchText={deleteTarget.volume.name}
        />
      )}
    </div>
  );
}
