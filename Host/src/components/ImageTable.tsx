'use client';

import React from 'react';
import { ImageInfo } from '../lib/types';
import { Layers, Trash2 } from 'lucide-react';

interface ImageTableProps {
  images: ImageInfo[];
  isLoading: boolean;
  onPrune: () => void;
}

export default function ImageTable({ images, isLoading, onPrune }: ImageTableProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-3" />
        <p className="text-slate-400 text-sm">Fetching images from agent engine...</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center space-x-2">
          <Layers className="w-5 h-5 text-purple-400" />
          <h3 className="font-bold text-slate-200">Local Docker Images</h3>
          <span className="text-xs bg-purple-950/80 text-purple-300 border border-purple-800/50 px-2 py-0.5 rounded">
            {images.length}
          </span>
        </div>

        <button
          onClick={onPrune}
          className="flex items-center space-x-1.5 text-xs text-rose-300 hover:text-rose-200 bg-rose-950/50 border border-rose-900/80 px-3 py-1.5 rounded-lg hover:bg-rose-900/60 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Prune Dangling Images</span>
        </button>
      </div>

      {images.length === 0 ? (
        <div className="p-12 text-center">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-slate-200 font-semibold text-base">No Local Images</h3>
          <p className="text-slate-400 text-xs mt-1">There are no Docker images found on this agent.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Image ID</th>
                <th className="px-6 py-4">Repository / Tag</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {images.map((img) => (
                <tr key={img.id} className="hover:bg-slate-800/50 transition">
                  <td className="px-6 py-4 font-mono text-xs text-purple-300">{img.id}</td>
                  <td className="px-6 py-4 font-semibold text-slate-100 font-mono text-xs">
                    {img.repoTags.join(', ')}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">{formatBytes(img.size)}</td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {new Date(img.created * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
