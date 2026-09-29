'use client';

import React, { useState, useEffect } from 'react';
import { AgentConfig } from '../lib/types';
import { Server, RefreshCw, X, ShieldAlert, Terminal, Activity, Cpu, HardDrive } from 'lucide-react';

interface ServerLogModalProps {
  agent: AgentConfig | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ServerLogModal({ agent, isOpen, onClose }: ServerLogModalProps) {
  const [logsData, setLogsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchServerLogs = async () => {
    if (!agent) return;
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentUrl: agent.url,
          token: agent.token,
          path: '/api/system/logs',
          method: 'GET',
        }),
      });

      if (!res.ok) {
        throw new Error(`Agent server logs error: HTTP ${res.status}`);
      }

      const data = await res.json();
      setLogsData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch server logs from agent');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && agent) {
      fetchServerLogs();
    } else {
      setLogsData(null);
    }
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  const sysInfo = logsData?.systemInfo;
  const events: any[] = logsData?.events || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30 text-blue-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base flex items-center space-x-2">
                <span>{agent.name} - Docker Engine & Server System Logs</span>
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{agent.url}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchServerLogs}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh Logs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* System Summary Banner */}
        {sysInfo && (
          <div className="p-4 bg-slate-950/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">OS / Engine</span>
              <span className="text-slate-200 font-mono font-bold truncate block">{sysInfo.operatingSystem}</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Docker Version</span>
              <span className="text-blue-400 font-mono font-bold block">{sysInfo.serverVersion}</span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Containers (Running/Total)</span>
              <span className="text-emerald-400 font-mono font-bold block">
                {sysInfo.containersRunning} / {sysInfo.containersTotal}
              </span>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">CPU / Images</span>
              <span className="text-purple-400 font-mono font-bold block">
                {sysInfo.ncpu} Cores | {sysInfo.images} Images
              </span>
            </div>
          </div>
        )}

        {/* Main Log Area */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-950 font-mono text-xs text-slate-300 space-y-2">
          {isLoading && !logsData ? (
            <div className="h-full flex items-center justify-center text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              <span>Fetching server logs from agent docker engine...</span>
            </div>
          ) : errorMsg ? (
            <div className="bg-rose-950/60 border border-rose-800 text-rose-300 p-4 rounded-xl flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Terminal className="w-8 h-8 opacity-40" />
              <p>No recent Docker daemon events recorded in past 24 hours.</p>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="text-slate-500 text-[11px] mb-3 pb-1 border-b border-slate-800 flex items-center justify-between">
                <span>[DOCKER DAEMON EVENTS & LOG STREAM]</span>
                <span>Total: {events.length} Events</span>
              </div>
              {events.map((ev, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-blue-400 font-bold uppercase text-[10px] bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800/60">
                      {ev.Type || 'event'} : {ev.Action || 'action'}
                    </span>
                    <span className="text-[10px]">
                      {ev.time ? new Date(ev.time * 1000).toLocaleString('ko-KR') : ''}
                    </span>
                  </div>
                  <div className="text-slate-200">
                    {ev.Actor?.Attributes?.name && (
                      <span className="text-amber-300 font-bold mr-2">
                        [{ev.Actor.Attributes.name}]
                      </span>
                    )}
                    <span className="text-slate-300">
                      {JSON.stringify(ev.Actor?.Attributes || {})}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
