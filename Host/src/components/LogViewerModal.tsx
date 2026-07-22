'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ContainerInfo, AgentConfig } from '../lib/types';
import { X, Terminal, Trash2, Pause, Play } from 'lucide-react';

interface LogViewerModalProps {
  container: ContainerInfo | null;
  agent: AgentConfig | null;
  onClose: () => void;
}

export default function LogViewerModal({ container, agent, onClose }: LogViewerModalProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const logEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!container || !agent) return;

    setLogs([]);
    setIsStreaming(true);

    // Convert http/https URL to ws/wss
    const wsBaseUrl = agent.url.replace(/^http/, 'ws');
    const wsUrl = `${wsBaseUrl}/api/containers/${container.id}/logs?token=${encodeURIComponent(agent.token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.data) {
          setLogs((prev) => [...prev, payload.data]);
        }
      } catch {
        setLogs((prev) => [...prev, event.data]);
      }
    };

    ws.onerror = () => {
      setLogs((prev) => [...prev, '\n[ERR] WebSocket connection error']);
    };

    ws.onclose = () => {
      setIsStreaming(false);
      setLogs((prev) => [...prev, '\n[INFO] WebSocket stream closed']);
    };

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [container, agent]);

  useEffect(() => {
    if (isStreaming) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isStreaming]);

  if (!container || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-950 border border-slate-800 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-slate-900 border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <span>{container.name}</span>
                <span className="text-xs text-slate-400 font-mono">({container.id})</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Agent: <span className="text-slate-300 font-medium">{agent.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className="flex items-center space-x-1 text-xs text-slate-300 bg-slate-800 px-3 py-1.5 rounded border border-slate-700 hover:bg-slate-700"
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-400" />
                  <span>Pause Scroll</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto Scroll</span>
                </>
              )}
            </button>

            <button
              onClick={() => setLogs([])}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-800"
              title="Clear Logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Log Stream Content */}
        <div className="flex-1 bg-black p-4 font-mono text-xs text-slate-200 overflow-y-auto whitespace-pre-wrap leading-relaxed select-text">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">Waiting for log stream output...</div>
          ) : (
            logs.map((logLine, idx) => <span key={idx}>{logLine}</span>)
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
