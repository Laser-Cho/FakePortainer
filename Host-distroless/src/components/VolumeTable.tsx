'use client';

import React, { useState } from 'react';
import { AgentConfig, VolumeInfo } from '../lib/types';
import { HardDrive, Search, Server, Box, Trash2, Database } from 'lucide-react';

interface VolumeTableProps {
  volumes: VolumeInfo[];
  agents: AgentConfig[];
  isLoading: boolean;
  onDeleteVolume?: (volume: VolumeInfo, agent: AgentConfig) => void;
}

export default function VolumeTable({
  volumes,
  agents,
  isLoading,
  onDeleteVolume,
}: VolumeTableProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredVolumes = volumes.filter((v) => {
    const query = searchQuery.toLowerCase();
    return (
      v.name.toLowerCase().includes(query) ||
      v.driver.toLowerCase().includes(query) ||
      (v.agentName && v.agentName.toLowerCase().includes(query)) ||
      v.attachedContainers.some((c) => c.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-4">
      {/* Search & Counter Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="볼륨명, 드라이버, 연결 컨테이너, 서버 검색..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="text-xs text-slate-400 font-mono">
          조회된 볼륨: <strong className="text-purple-400">{filteredVolumes.length}</strong> 개
        </div>
      </div>

      {/* Volume Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-3" />
            <p className="text-slate-400 text-xs">도커 데몬으로부터 볼륨 정보를 조회하는 중...</p>
          </div>
        ) : filteredVolumes.length === 0 ? (
          <div className="p-12 text-center">
            <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-slate-300 font-semibold text-sm">등록되거나 검색된 도커 볼륨이 없습니다</h3>
            <p className="text-slate-500 text-xs mt-1">컨테이너가 볼륨을 생성하거나 사용하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">볼륨 이름 (Volume Name)</th>
                  <th className="px-6 py-3.5">서버 노드 (Node)</th>
                  <th className="px-6 py-3.5">드라이버 (Driver)</th>
                  <th className="px-6 py-3.5">연결된 컨테이너 (Attached Containers)</th>
                  <th className="px-6 py-3.5">호스트 마운트 지점 (Mountpoint)</th>
                  {onDeleteVolume && <th className="px-6 py-3.5 text-right">제어 (Actions)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredVolumes.map((vol, idx) => {
                  const agent = agents.find((a) => a.name === vol.agentName) || {
                    id: 'unknown',
                    name: vol.agentName || 'Unknown',
                    url: vol.agentUrl || '',
                    token: '1',
                  };

                  return (
                    <tr key={`${vol.name}-${idx}`} className="hover:bg-slate-800/40 transition">
                      <td className="px-6 py-4 font-mono font-bold text-slate-100 break-all">
                        <div className="flex items-center space-x-2">
                          <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>{vol.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs text-blue-300 bg-blue-950/50 border border-blue-800/50 px-2 py-0.5 rounded">
                          <Server className="w-3 h-3 mr-1 text-blue-400" />
                          {vol.agentName || 'Local Node'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-400">
                        <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300">
                          {vol.driver}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {vol.attachedContainers.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">연결된 컨테이너 없음 (Unused)</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {vol.attachedContainers.map((ac) => (
                              <span
                                key={ac.id}
                                className={`inline-flex items-center text-[11px] font-mono px-2 py-0.5 rounded-md border ${
                                  ac.state === 'running'
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                }`}
                              >
                                <Box className="w-3 h-3 mr-1 shrink-0" />
                                <span>{ac.name}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px] text-slate-400 break-all max-w-xs">
                        {vol.mountpoint}
                      </td>
                      {onDeleteVolume && (
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => onDeleteVolume(vol, agent)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-400 hover:text-rose-300 transition"
                            title="볼륨 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
