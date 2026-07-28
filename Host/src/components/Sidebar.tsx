'use client';

import React from 'react';
import { AgentConfig } from '../lib/types';
import { Globe, Plus, ChevronRight, Server } from 'lucide-react';

interface SidebarProps {
  agents: AgentConfig[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenAddAgent: () => void;
}

export default function Sidebar({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenAddAgent,
}: SidebarProps) {
  const onlineCount = agents.filter((a) => a.isOnline).length;

  return (
    <aside className="w-64 md:w-72 bg-slate-900/80 border-r border-slate-800 flex flex-col shrink-0 min-h-[calc(100vh-61px)]">
      <div className="p-4 flex-1 space-y-6">
        {/* Cluster View Section */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 px-2">
            Overview Mode
          </p>
          <button
            onClick={() => onSelectAgent('all')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
              selectedAgentId === 'all'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border border-blue-500'
                : 'text-slate-300 hover:bg-slate-800/80 border border-slate-800/50'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <Globe className={`w-4 h-4 ${selectedAgentId === 'all' ? 'text-white' : 'text-blue-400'}`} />
              <span>All Nodes Cluster</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              selectedAgentId === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {agents.length} Nodes
            </span>
          </button>
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
                const isSelected = selectedAgentId === ag.id;
                return (
                  <button
                    key={ag.id}
                    onClick={() => onSelectAgent(ag.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition group ${
                      isSelected
                        ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold shadow'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 truncate">
                      <span className="shrink-0">
                        {ag.isOnline ? (
                          <span className="block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Online" />
                        ) : (
                          <span className="block w-2 h-2 rounded-full bg-rose-500" title="Offline" />
                        )}
                      </span>
                      <div className="flex flex-col text-left truncate">
                        <span className="truncate text-slate-200 font-medium">{ag.name}</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">{ag.url}</span>
                      </div>
                    </div>
                    <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition shrink-0 ${isSelected ? 'opacity-100 text-blue-400' : ''}`} />
                  </button>
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
