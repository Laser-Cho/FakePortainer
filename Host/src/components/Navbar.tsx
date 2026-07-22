'use client';

import React from 'react';
import { AgentConfig } from '../lib/types';
import { Server, Plus, Lock, LogOut, CheckCircle2, XCircle } from 'lucide-react';

interface NavbarProps {
  agents: AgentConfig[];
  selectedAgentId: string;
  onSelectAgent: (id: string) => void;
  onOpenAddAgent: () => void;
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export default function Navbar({
  agents,
  selectedAgentId,
  onSelectAgent,
  onOpenAddAgent,
  isAuthenticated,
  onOpenLogin,
  onLogout,
}: NavbarProps) {
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between shadow-lg">
      <div className="flex items-center space-x-3">
        <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
          <Server className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <span className="font-bold text-lg text-slate-100 tracking-wide">FakePortainer</span>
          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/50">
            Control Plane
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 space-x-2">
          <Server className="w-4 h-4 text-slate-400" />
          <select
            value={selectedAgentId}
            onChange={(e) => onSelectAgent(e.target.value)}
            className="bg-transparent text-sm text-slate-200 focus:outline-none cursor-pointer pr-2"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id} className="bg-slate-900 text-slate-200">
                {agent.name} ({agent.url})
              </option>
            ))}
          </select>
          {selectedAgent && (
            <span className="flex items-center text-xs ml-1">
              {selectedAgent.isOnline ? (
                <span className="flex items-center text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Online
                </span>
              ) : (
                <span className="flex items-center text-rose-400 font-medium">
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Offline
                </span>
              )}
            </span>
          )}
        </div>

        <button
          onClick={onOpenAddAgent}
          className="flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-1.5 rounded-lg border border-slate-700 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Agent</span>
        </button>

        <div className="h-5 w-px bg-slate-800" />

        {isAuthenticated ? (
          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        ) : (
          <button
            onClick={onOpenLogin}
            className="flex items-center space-x-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/40 border border-blue-900/50 px-3 py-1.5 rounded-lg transition"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
        )}
      </div>
    </nav>
  );
}
