'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Info, Trash2, Play, Square, RotateCw, ShieldAlert, X } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options?: { removeVolumes?: boolean }) => void;
  title: string;
  description: string;
  confirmText?: string;
  actionType: 'start' | 'stop' | 'restart' | 'remove' | 'prune' | 'general' | 'delete_volume';
  requireMatchText?: string; // If provided, user must type this exact string to confirm
  showRemoveVolumesOption?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText,
  actionType,
  requireMatchText,
  showRemoveVolumesOption,
}: ConfirmModalProps) {
  const [typedInput, setTypedInput] = useState('');
  const [removeVolumes, setRemoveVolumes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTypedInput('');
      setRemoveVolumes(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatchRequired = !!requireMatchText;
  const isMatchValid = !isMatchRequired || typedInput.trim() === requireMatchText;

  const getHeaderIcon = () => {
    switch (actionType) {
      case 'remove':
      case 'prune':
      case 'delete_volume':
        return (
          <div className="bg-rose-500/20 p-3 rounded-xl border border-rose-500/30 text-rose-400">
            <Trash2 className="w-6 h-6" />
          </div>
        );
      case 'start':
        return (
          <div className="bg-emerald-500/20 p-3 rounded-xl border border-emerald-500/30 text-emerald-400">
            <Play className="w-6 h-6" />
          </div>
        );
      case 'stop':
        return (
          <div className="bg-rose-500/20 p-3 rounded-xl border border-rose-500/30 text-rose-400">
            <Square className="w-6 h-6" />
          </div>
        );
      case 'restart':
        return (
          <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-500/30 text-blue-400">
            <RotateCw className="w-6 h-6" />
          </div>
        );
      default:
        return (
          <div className="bg-amber-500/20 p-3 rounded-xl border border-amber-500/30 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
    }
  };

  const getConfirmBtnColor = () => {
    switch (actionType) {
      case 'remove':
      case 'prune':
      case 'delete_volume':
      case 'stop':
        return 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25';
      case 'start':
        return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25';
      case 'restart':
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25';
      default:
        return 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4 mb-4">
          {getHeaderIcon()}
          <div>
            <h3 className="text-lg font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {showRemoveVolumesOption && (
          <div className="mt-3 mb-2 bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
            <label className="flex items-center space-x-2.5 text-xs text-rose-300 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={removeVolumes}
                onChange={(e) => setRemoveVolumes(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900"
              />
              <span>연관된 도커 볼륨(Volumes)도 같이 삭제할까요?</span>
            </label>
          </div>
        )}

        {isMatchRequired && (
          <div className="mt-3 mb-6 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              확인을 위해 아래 이름을 정확히 입력하세요:
            </label>
            <div className="bg-slate-900 border border-slate-700/60 px-3 py-1.5 rounded text-xs font-mono font-bold text-rose-300 select-all">
              {requireMatchText}
            </div>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder="위의 이름을 입력하세요"
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-rose-500 transition"
            />
            {typedInput && !isMatchValid && (
              <p className="text-[11px] text-rose-400 font-medium">입력한 이름이 일치하지 않습니다.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
          >
            취소
          </button>

          <button
            type="button"
            disabled={!isMatchValid}
            onClick={() => {
              if (isMatchValid) {
                onConfirm({ removeVolumes });
                onClose();
              }
            }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl shadow-lg transition flex items-center space-x-1.5 ${
              isMatchValid
                ? getConfirmBtnColor()
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
          >
            <span>{confirmText || '확인'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
