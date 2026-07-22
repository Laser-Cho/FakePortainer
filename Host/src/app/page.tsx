'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
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
import { Server, Box, Layers, PlayCircle, StopCircle, RefreshCw, ShieldAlert } from 'lucide-react';

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'local-agent',
    name: 'Local Host Engine',
    url: 'http://localhost:9000',
    token: 'your_secure_agent_token',
    isOnline: false,
  },
];

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('local-agent');
  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'agents'>('containers');

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [selectedLogContainer, setSelectedLogContainer] = useState<ContainerInfo | null>(null);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Health checks
  const pingAgents = useCallback(async () => {
    const updated = await Promise.all(
      agents.map(async (ag) => {
        const isOnline = await checkAgentHealth(ag);
        return { ...ag, isOnline };
      })
    );
    setAgents(updated);
  }, [agents]);

  useEffect(() => {
    pingAgents();
    const interval = setInterval(pingAgents, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load container & image data
  const loadAgentData = useCallback(async () => {
    if (!selectedAgent) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
      const [cList, iList] = await Promise.all([
        fetchContainers(selectedAgent).catch((e) => {
          setErrorMsg(e.message);
          return [];
        }),
        fetchImages(selectedAgent).catch(() => []),
      ]);

      setContainers(cList);
      setImages(iList);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with Agent');
    } finally {
      setIsLoading(false);
    }
  }, [selectedAgent]);

  useEffect(() => {
    loadAgentData();
  }, [selectedAgentId, loadAgentData]);

  // Container Actions
  const handleControlContainer = async (
    containerId: string,
    action: 'start' | 'stop' | 'restart' | 'remove'
  ) => {
    if (!selectedAgent) return;
    try {
      await controlContainer(selectedAgent, containerId, action);
      await loadAgentData();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    }
  };

  // Prune Images
  const handlePruneImages = async () => {
    if (!selectedAgent) return;
    if (!confirm('Are you sure you want to delete all dangling (unused) images?')) return;
    try {
      const res = await pruneImages(selectedAgent);
      alert(`Pruned successfully! Reclaimed ${Math.round((res.spaceReclaimed || 0) / 1024 / 1024)} MB`);
      await loadAgentData();
    } catch (err: any) {
      alert(`Prune error: ${err.message}`);
    }
  };

  const handleAddAgent = (newAgent: AgentConfig) => {
    setAgents((prev) => [...prev, newAgent]);
    setSelectedAgentId(newAgent.id);
  };

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state !== 'running').length;
  const onlineAgentsCount = agents.filter((a) => a.isOnline).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        isAuthenticated={!!authToken}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={() => setAuthToken(null)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
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
            <div className="p-4 border-b border-slate-800 bg-slate-950/40 font-semibold text-slate-200">
              Registered Agent Engine Nodes
            </div>
            <div className="divide-y divide-slate-800">
              {agents.map((ag) => (
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
                  <button
                    onClick={() => setSelectedAgentId(ag.id)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700"
                  >
                    Select Node
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <AgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAddAgent={handleAddAgent}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(token) => setAuthToken(token)}
      />

      <LogViewerModal
        container={selectedLogContainer}
        agent={selectedAgent}
        onClose={() => setSelectedLogContainer(null)}
      />
    </div>
  );
}
