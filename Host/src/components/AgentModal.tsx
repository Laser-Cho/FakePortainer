'use client';

import React, { useState } from 'react';
import { AgentConfig } from '../lib/types';
import { X, Server, Key } from 'lucide-react';

interface AgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddAgent: (agent: AgentConfig) => void;
}

export default function AgentModal({ isOpen, onClose, onAddAgent }: AgentModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('http://localhost:9000');
  const [token, setToken] = useState('your_secure_agent_token');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !token) return;

    const newAgent: AgentConfig = {
      id: `agent-${Date.now()}`,
      name,
      url: url.replace(/\/$/, ''),
      token,
      isOnline: false,
    };

    onAddAgent(newAgent);
    setName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center space-x-2">
            <Server className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-slate-100">Register Docker Agent</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Agent Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Worker Node 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Agent Endpoint URL</label>
            <input
              type="text"
              required
              placeholder="http://192.168.1.100:9000"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center">
              <Key className="w-3.5 h-3.5 mr-1 text-slate-400" /> Secret Token / Bearer Key
            </label>
            <input
              type="password"
              required
              placeholder="AGENT_SECRET_TOKEN"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow"
            >
              Register Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
