'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ContainerTable from '../components/ContainerTable';
import ImageTable from '../components/ImageTable';
import LogViewerModal from '../components/LogViewerModal';
import AgentModal from '../components/AgentModal';
import LoginModal from '../components/LoginModal';
import { AgentConfig, ContainerInfo, ImageInfo } from '../lib/types';
import {
  fetchContainers,
  controlContainer,
  fetchImages,
  pruneImages,
  checkAgentHealth,
} from '../lib/api';
import { Server, Box, Layers, PlayCircle, StopCircle, RefreshCw, ShieldAlert, Trash2, PlusCircle } from 'lucide-react';

const DEFAULT_AGENTS: AgentConfig[] = [];

import ServerLogModal from '../components/ServerLogModal';

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  // Fetch agents dynamically from watch_list.txt / watch_list.bin API route
  const fetchWatchListAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const watchList: AgentConfig[] = data.agents || [];
        setAgents(watchList);
        if (watchList.length > 0) {
          setSelectedAgentId((prev) => (prev && watchList.some((a) => a.id === prev) ? prev : watchList[0].id));
        } else {
          setSelectedAgentId('');
        }
      }
    } catch (e) {
      console.error('Failed to fetch watch list agents', e);
    }
  }, []);

  useEffect(() => {
    fetchWatchListAgents();
  }, [fetchWatchListAgents]);

  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'agents'>('containers');

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals & Auth State
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedLogContainer, setSelectedLogContainer] = useState<ContainerInfo | null>(null);
  const [serverLogAgent, setServerLogAgent] = useState<AgentConfig | null>(null);

  // Helper to record audit history
  const recordHistory = async (
    agentName: string,
    agentUrl: string,
    actionType: string,
    detail: string,
    containerId?: string,
    containerName?: string
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
          containerId,
          containerName,
          user: currentUser || 'Admin',
        }),
      });
    } catch (e) {
      console.error('Failed to record history', e);
    }
  };

  // Initial Auth Check (/api/auth/me)
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
      } catch (e) {
        console.error('Auth check error', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = (token: string, username: string) => {
    setAuthToken(token);
    setCurrentUser(username);
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setAuthToken(null);
    setCurrentUser(null);
  };

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Health checks: Polling every 10 seconds without infinite re-render loops
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

  // Load container & image data for selected agent (or all nodes)
  const loadAgentData = useCallback(async () => {
    if (!selectedAgentId) {
      setContainers([]);
      setImages([]);
      setErrorMsg('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      if (selectedAgentId === 'all') {
        const targetAgents = agents.filter((a) => a.isOnline);
        if (targetAgents.length === 0 && agents.length > 0) {
          setErrorMsg('All registered agent nodes are currently offline.');
          setContainers([]);
          setImages([]);
          setIsLoading(false);
          return;
        }

        const results = await Promise.all(
          targetAgents.map(async (ag) => {
            const [cList, iList] = await Promise.all([
              fetchContainers(ag).catch(() => []),
              fetchImages(ag).catch(() => []),
            ]);
            const taggedContainers = cList.map((c) => ({
              ...c,
              agentName: ag.name,
              agentUrl: ag.url,
            }));
            return { containers: taggedContainers, images: iList };
          })
        );

        const allContainers = results.flatMap((r) => r.containers);
        const allImages = results.flatMap((r) => r.images);

        setContainers(allContainers);
        setImages(allImages);
      } else {
        const targetAgent = agents.find((a) => a.id === selectedAgentId);
        if (!targetAgent) {
          setContainers([]);
          setImages([]);
          setIsLoading(false);
          return;
        }

        const [cList, iList] = await Promise.all([
          fetchContainers(targetAgent).catch((e) => {
            setErrorMsg(e.message);
            return [];
          }),
          fetchImages(targetAgent).catch(() => []),
        ]);

        const taggedContainers = cList.map((c) => ({
          ...c,
          agentName: targetAgent.name,
          agentUrl: targetAgent.url,
        }));

        setContainers(taggedContainers);
        setImages(iList);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with Agent(s)');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgentId, agents]);

  useEffect(() => {
    if (selectedAgentId) {
      loadAgentData();
    }
  }, [selectedAgentId]);

  // Container Actions with History Recording
  const handleControlContainer = async (
    containerId: string,
    action: 'start' | 'stop' | 'restart' | 'remove'
  ) => {
    const targetContainer = containers.find((c) => c.id === containerId);
    const targetAgent = targetContainer?.agentUrl
      ? agents.find((a) => a.url === targetContainer.agentUrl) || selectedAgent
      : selectedAgent;

    if (!targetAgent) return;
    try {
      await controlContainer(targetAgent, containerId, action);
      
      // Record in history log
      const actionUpper = action.toUpperCase();
      const containerName = targetContainer?.name || containerId;
      await recordHistory(
        targetAgent.name,
        targetAgent.url,
        actionUpper,
        `Container '${containerName}' ${action}ed successfully on ${targetAgent.name}`,
        containerId,
        containerName
      );

      setTimeout(loadAgentData, 1000);
    } catch (e: any) {
      alert(`Action error: ${e.message}`);
    }
  };

  // Prune Images with History Recording
  const handlePruneImages = async () => {
    if (!selectedAgent) return;
    try {
      const res = await pruneImages(selectedAgent);
      const reclaimedMB = Math.round((res.spaceReclaimed || 0) / 1024 / 1024);
      alert(`Pruned successfully! Reclaimed ${reclaimedMB} MB`);

      await recordHistory(
        selectedAgent.name,
        selectedAgent.url,
        'PRUNE_IMAGES',
        `Pruned dangling images on ${selectedAgent.name}, reclaimed ${reclaimedMB} MB`
      );

      await loadAgentData();
    } catch (err: any) {
      alert(`Prune error: ${err.message}`);
    }
  };

  const handleAddAgent = async (newAgent: AgentConfig) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgent.name,
          url: newAgent.url,
          token: newAgent.token,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedList: AgentConfig[] = data.agents || [];
        setAgents(updatedList);
        const added = updatedList.find((a) => a.url === newAgent.url.replace(/\/$/, '')) || updatedList[updatedList.length - 1];
        if (added) {
          setSelectedAgentId(added.id);
        }

        await recordHistory(
          newAgent.name,
          newAgent.url,
          'ADD_AGENT',
          `Added new agent node '${newAgent.name}' (${newAgent.url}) to watch list`
        );
      } else {
        alert('Failed to add agent to watch list');
      }
    } catch (e: any) {
      alert(`Add agent error: ${e.message}`);
    }
  };

  const handleRemoveAgent = async (id: string) => {
    const target = agents.find((a) => a.id === id);
    if (!target) return;

    try {
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url, id }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedList: AgentConfig[] = data.agents || [];
        setAgents(updatedList);
        if (selectedAgentId === id) {
          setSelectedAgentId(updatedList.length > 0 ? updatedList[0].id : '');
        }

        await recordHistory(
          target.name,
          target.url,
          'REMOVE_AGENT',
          `Removed agent node '${target.name}' from watch list`
        );
      } else {
        alert('Failed to remove agent from watch list');
      }
    } catch (e: any) {
      alert(`Delete agent error: ${e.message}`);
    }
  };

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state !== 'running').length;
  const onlineAgentsCount = agents.filter((a) => a.isOnline).length;

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        <span>Verifying Control Plane Authentication...</span>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100 relative overflow-hidden select-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl z-10">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
              <Server className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">FakePortainer</h1>
              <p className="text-xs text-slate-400">Control Plane Dashboard Login</p>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const username = (form.elements.namedItem('username') as HTMLInputElement).value;
              const password = (form.elements.namedItem('password') as HTMLInputElement).value;
              const errorEl = document.getElementById('login-error-msg');
              if (errorEl) errorEl.innerText = '';

              try {
                const res = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password }),
                });
                const data = await res.json();
                if (res.ok && data.token) {
                  handleLoginSuccess(data.token, data.username || username);
                } else {
                  if (errorEl) errorEl.innerText = data.error || 'Invalid ID or Password';
                }
              } catch (err: any) {
                if (errorEl) errorEl.innerText = err.message || 'Login failed';
              }
            }}
            className="space-y-4"
          >
            <div id="login-error-msg" className="text-rose-400 text-xs font-semibold empty:hidden bg-rose-950/60 border border-rose-800/60 p-3 rounded-xl" />

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">ID (Username)</label>
              <input
                name="username"
                type="text"
                required
                placeholder="Enter ADMIN_USER"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
              <input
                name="password"
                type="password"
                required
                placeholder="Enter ADMIN_PASSWORD"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/25 transition mt-2 flex items-center justify-center space-x-2"
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Sign In to Control Plane</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

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
          onOpenServerLogs={(ag) => setServerLogAgent(ag)}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
        {/* Error notification banner */}
        {errorMsg && (
          <div className="mb-6 bg-rose-950/70 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-md">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadAgentData}
              className="text-xs bg-rose-900/50 hover:bg-rose-900 border border-rose-700/50 px-2.5 py-1 rounded-md transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard Stats */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Agents Online</p>
              <h3 className="text-3xl font-bold mt-1 text-emerald-400">
                {onlineAgentsCount} <span className="text-slate-500 text-sm font-normal">/ {agents.length}</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Server className="w-6 h-6 text-emerald-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Running Containers</p>
              <h3 className="text-3xl font-bold mt-1 text-blue-400">{runningCount}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
              <PlayCircle className="w-6 h-6 text-blue-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Stopped Containers</p>
              <h3 className="text-3xl font-bold mt-1 text-rose-400">{stoppedCount}</h3>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
              <StopCircle className="w-6 h-6 text-rose-400" />
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Images</p>
              <h3 className="text-3xl font-bold mt-1 text-purple-400">{images.length}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
              <Layers className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </section>

        {/* Tab Navigation & Refresh */}
        <div className="flex items-center justify-between border-b border-slate-800 mb-6 pb-2">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('containers')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'containers'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Box className="w-4 h-4" />
              <span>Containers ({containers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('images')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'images'
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Images ({images.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('agents')}
              className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                activeTab === 'agents'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Agent Nodes ({agents.length})</span>
            </button>
          </div>

          <button
            onClick={loadAgentData}
            disabled={isLoading}
            className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Tab Views */}
        {activeTab === 'containers' && (
          <ContainerTable
            containers={containers}
            isLoading={isLoading}
            onControl={handleControlContainer}
            onOpenLogs={setSelectedLogContainer}
          />
        )}

        {activeTab === 'images' && (
          <ImageTable images={images} isLoading={isLoading} onPrune={handlePruneImages} />
        )}

        {activeTab === 'agents' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between font-semibold text-slate-200">
              <span>Registered Agent Engine Nodes</span>
              <button
                onClick={() => setIsAddAgentOpen(true)}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center space-x-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add New Agent</span>
              </button>
            </div>
            <div className="divide-y divide-slate-800">
              {agents.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                  <Server className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
                  <p className="font-semibold text-slate-300">No Agent Nodes registered yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Click &apos;Add New Agent&apos; above or in the navigation bar to register your Docker agent.
                  </p>
                </div>
              ) : (
                agents.map((ag) => (
                  <div key={ag.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                    <div>
                      <h4 className="font-bold text-slate-100 text-sm flex items-center space-x-2">
                        <span>{ag.name}</span>
                        {ag.isOnline ? (
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                            Online
                          </span>
                        ) : (
                          <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">
                            Offline
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{ag.url}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setServerLogAgent(ag)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-blue-300 transition flex items-center space-x-1"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>서버 로그</span>
                      </button>
                      <button
                        onClick={() => setSelectedAgentId(ag.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          selectedAgentId === ag.id
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        {selectedAgentId === ag.id ? 'Active Node' : 'Select Node'}
                      </button>
                      <button
                        onClick={() => handleRemoveAgent(ag.id)}
                        className="text-xs p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 rounded-lg transition"
                        title="Remove Agent"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Modals */}
      <AgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAddAgent={handleAddAgent}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <LogViewerModal
        container={selectedLogContainer}
        agent={
          selectedLogContainer?.agentUrl
            ? agents.find((a) => a.url === selectedLogContainer.agentUrl) || selectedAgent
            : selectedAgent
        }
        onClose={() => setSelectedLogContainer(null)}
      />

      <ServerLogModal
        agent={serverLogAgent}
        isOpen={!!serverLogAgent}
        onClose={() => setServerLogAgent(null)}
      />
    </div>
  );
}

