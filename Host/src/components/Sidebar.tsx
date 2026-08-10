'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AgentConfig } from '../lib/types';
import { Globe, Plus, ChevronRight, Server, History, Terminal, HardDrive } from 'lucide-react';

interface SidebarProps {
  agents: AgentConfig[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenAddAgent: () => void;
  onOpenServerLogs?: (agent: AgentConfig) => void;
}

export default function Sidebar({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenAddAgent,
  onOpenServerLogs,
}: SidebarProps) {
  const pathname = usePathname();
  const onlineCount = agents.filter((a) => a.isOnline).length;
  const isHistoryActive = pathname === '/history';
  const isVolumesActive = pathname === '/volumes';

  return (
    <aside className="w-64 md:w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-4 flex-1 space-y-6">
        {/* Navigation Section */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-2">
            Navigation
          </p>
          <div className="space-y-1">
            <Link
              href="/"
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                !isHistoryActive && !isVolumesActive && selectedAgentId === 'all'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500'
                  : 'text-slate-300 hover:bg-slate-800/80 border border-slate-800/50'
              }`}
              onClick={() => onSelectAgent('all')}
            >
              <div className="flex items-center space-x-2.5">
                <Globe className={`w-4 h-4 ${!isHistoryActive && !isVolumesActive && selectedAgentId === 'all' ? 'text-white' : 'text-blue-400'}`} />
                <span>All Nodes Cluster</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                !isHistoryActive && !isVolumesActive && selectedAgentId === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {agents.length} Nodes
              </span>
            </Link>

            <Link
              href="/volumes"
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                isVolumesActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500'
                  : 'text-slate-300 hover:bg-slate-800/80 border border-slate-800/50'
              }`}
            >
              <HardDrive className={`w-4 h-4 ${isVolumesActive ? 'text-white' : 'text-purple-400'}`} />
              <span>볼륨 관리 (Volumes)</span>
            </Link>

            <Link
              href="/history"
              className={`w-full flex items-center space-x-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                isHistoryActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500'
                  : 'text-slate-300 hover:bg-slate-800/80 border border-slate-800/50'
              }`}
            >
              <History className={`w-4 h-4 ${isHistoryActive ? 'text-white' : 'text-amber-400'}`} />
              <span>이력 추적 (History Log)</span>
            </Link>
          </div>
        </div>

        {/* Individual Nodes Section */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Agent Nodes ({onlineCount}/{agents.length})
            </p>
            <button
              onClick={onOpenAddAgent}
              className="text-slate-400 hover:text-blue-400 p-1 rounded hover:bg-slate-800 transition"
              title="Add New Node"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            {agents.length === 0 ? (
              <p className="text-xs text-slate-500 italic px-2 py-2">No nodes registered</p>
            ) : (
              agents.map((ag) => {
                const isSelected = !isHistoryActive && !isVolumesActive && selectedAgentId === ag.id;
                return (
                  <div
                    key={ag.id}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition group ${
                      isSelected
                        ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => onSelectAgent(ag.id)}
                      className="flex items-center space-x-2.5 truncate flex-1 text-left min-w-0"
                    >
                      <span className="shrink-0">
                        {ag.isOnline ? (
                          <span className="block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
                        ) : (
                          <span className="block w-2 h-2 rounded-full bg-rose-500" title="Offline" />
                        )}
                      </span>
                      <div className="flex flex-col truncate">
                        <span className="truncate text-slate-200 font-medium">{ag.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">{ag.url}</span>
                      </div>
                    </button>

                    {onOpenServerLogs && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenServerLogs(ag);
                        }}
                        className="p-1 text-slate-400 hover:text-blue-300 hover:bg-slate-700/60 rounded transition shrink-0 ml-1"
                        title="서버 도커 로그 보기"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onOpenAddAgent}
          className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-2.5 px-3 rounded-xl border border-slate-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4 text-blue-400" />
          <span>Register New Node</span>
        </button>
      </div>
    </aside>
  );
}

