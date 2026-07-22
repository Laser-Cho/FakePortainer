'use client';

import React from 'react';
import { ContainerInfo } from '../lib/types';
import { Play, Square, RotateCw, Trash2, FileText, Box } from 'lucide-react';

interface ContainerTableProps {
  containers: ContainerInfo[];
  isLoading: boolean;
  onControl: (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove') => void;
  onOpenLogs: (container: ContainerInfo) => void;
}

export default function ContainerTable({
  containers,
  isLoading,
  onControl,
  onOpenLogs,
}: ContainerTableProps) {
  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3" />
        <p className="text-slate-400 text-sm">Fetching containers from agent...</p>
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <Box className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <h3 className="text-slate-200 font-semibold text-base">No Containers Found</h3>
        <p className="text-slate-400 text-xs mt-1">There are no Docker containers on this agent engine.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Image</th>
              <th className="px-6 py-4">Ports</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {containers.map((container) => {
              const isRunning = container.state === 'running';

              return (
                <tr key={container.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        isRunning
                          ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                          isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                        }`}
                      />
                      {container.state}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-semibold text-slate-100">
                    <div className="flex flex-col">
                      <span>{container.name}</span>
                      <span className="text-[11px] font-mono text-slate-400">{container.id}</span>
                    </div>
                  </td>

                  <td className="px-6 py-4 max-w-xs truncate text-slate-300 font-mono text-xs">
                    {container.image}
                  </td>

                  <td className="px-6 py-4 text-xs font-mono text-slate-400">
                    {container.ports.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {container.ports.map((p, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-[11px] text-blue-300"
                          >
                            {p.publicPort ? `${p.publicPort}:` : ''}
                            {p.privatePort}/{p.type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-1">
                      {isRunning ? (
                        <button
                          onClick={() => onControl(container.id, 'stop')}
                          title="Stop Container"
                          className="p-1.5 rounded-md hover:bg-rose-950/50 text-rose-400 hover:text-rose-300 transition"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onControl(container.id, 'start')}
                          title="Start Container"
                          className="p-1.5 rounded-md hover:bg-emerald-950/50 text-emerald-400 hover:text-emerald-300 transition"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onControl(container.id, 'restart')}
                        title="Restart Container"
                        className="p-1.5 rounded-md hover:bg-blue-950/50 text-blue-400 hover:text-blue-300 transition"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onOpenLogs(container)}
                        title="View Realtime Logs"
                        className="p-1.5 rounded-md hover:bg-slate-800 text-amber-400 hover:text-amber-300 transition"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onControl(container.id, 'remove')}
                        title="Remove Container"
                        className="p-1.5 rounded-md hover:bg-rose-950/50 text-rose-500 hover:text-rose-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
