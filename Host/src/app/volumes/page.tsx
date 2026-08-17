'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../../components/Navbar';
import Sidebar from '../../components/Sidebar';
import ConfirmModal from '../../components/ConfirmModal';
import VolumeTable from '../../components/VolumeTable';
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

  const [appTitle, setAppTitle] = useState<string>('DockWatch');

  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.appTitle) {
          setAppTitle(data.appTitle);
          document.title = `${data.appTitle} - Volumes`;
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        appTitle={appTitle}
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

          {/* Volume Table Component */}
          <VolumeTable
            volumes={volumes}
            agents={agents}
            isLoading={isLoading}
            onDeleteVolume={(volume, agent) => setDeleteTarget({ volume, agent })}
          />
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
