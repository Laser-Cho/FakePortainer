'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ContainerTable from '../components/ContainerTable';
import ImageTable from '../components/ImageTable';
import VolumeTable from '../components/VolumeTable';
import ConfirmModal from '../components/ConfirmModal';
import LogViewerModal from '../components/LogViewerModal';
import AgentModal from '../components/AgentModal';
import LoginModal from '../components/LoginModal';
import PasswordChangeModal from '../components/PasswordChangeModal';
import ServerLogModal from '../components/ServerLogModal';
import IdleTimeoutGuard from '../components/IdleTimeoutGuard';
import TwoFactorModal from '../components/TwoFactorModal';
import { AgentConfig, ContainerInfo, ImageInfo, VolumeInfo } from '../lib/types';
import {
  fetchContainers,
  controlContainer,
  fetchImages,
  pruneImages,
  fetchVolumes,
  deleteVolume,
  checkAgentHealth,
} from '../lib/api';
import { Server, Box, Layers, PlayCircle, StopCircle, RefreshCw, ShieldAlert, Trash2, PlusCircle, HardDrive, BellRing, X } from 'lucide-react';

export default function Home() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'containers' | 'images' | 'volumes' | 'agents'>('containers');

  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Modals & Auth State
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRealName, setCurrentUserRealName] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [selectedLogContainer, setSelectedLogContainer] = useState<ContainerInfo | null>(null);
  const [serverLogAgent, setServerLogAgent] = useState<AgentConfig | null>(null);
  const [deleteVolumeTarget, setDeleteVolumeTarget] = useState<{ volume: VolumeInfo; agent: AgentConfig } | null>(null);

  // Security Gate States
  const [gateExpiredUsername, setGateExpiredUsername] = useState('');
  const [gateTab, setGateTab] = useState<'login' | 'register'>('login');
  const [gateRegComplexityMet, setGateRegComplexityMet] = useState(false);
  const [gateRequires2FA, setGateRequires2FA] = useState(false);
  const [gateNotice, setGateNotice] = useState('');
  const [adminAlertBanner, setAdminAlertBanner] = useState<any>(null);

  // Config / App Title State
  const [appTitle, setAppTitle] = useState<string>('DockWatch');

  useEffect(() => {
    fetch('/api/config', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data.appTitle) {
          setAppTitle(data.appTitle);
          document.title = `${data.appTitle} - Control Plane`;
        }
      })
      .catch(() => {});
  }, []);

  const fetchWatchListAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const watchList: AgentConfig[] = data.agents || [];
        setAgents(watchList);
        if (watchList.length > 0) {
          setSelectedAgentId((prev) => (prev && watchList.some((a) => a.id === prev) ? prev : watchList[0].id));
        } else {
          setSelectedAgentId('');
        }
      }
    } catch (e) {
      console.error('Failed to fetch watch list agents', e);
    }
  }, []);

  // Initial Auth Check (/api/auth/me)
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (data.user.requirePasswordChange) {
              setGateExpiredUsername(data.user.username);
              setIsPasswordChangeOpen(true);
            } else {
              setAuthToken('authenticated');
              setCurrentUser(data.user.username);
              setCurrentUserRealName(data.user.name);
              setCurrentUserRole(data.user.role);
              setTwoFactorEnabled(!!data.user.twoFactorEnabled);
            }
          }
        }
      } catch (e) {
        console.error('Auth check error', e);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (authToken) {
      fetchWatchListAgents();
    } else {
      setAgents([]);
      setContainers([]);
      setImages([]);
      setVolumes([]);
    }
  }, [authToken, fetchWatchListAgents]);

  const recordHistory = async (
    agentName: string,
    agentUrl: string,
    actionType: string,
    detail: string,
    containerId?: string,
    containerName?: string
  ) => {
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName,
          agentUrl,
          actionType,
          detail,
          containerId,
          containerName,
        }),
      });
    } catch (e) {
      console.error('Failed to record history', e);
    }
  };

  const handleLoginSuccess = (
    username: string,
    name?: string,
    role?: string,
    extras?: { twoFactorEnabled?: boolean; adminAlertInfo?: any }
  ) => {
    setAuthToken('authenticated');
    setCurrentUser(username);
    if (name) setCurrentUserRealName(name);
    if (role) setCurrentUserRole(role);
    setTwoFactorEnabled(!!extras?.twoFactorEnabled);
    if (extras?.adminAlertInfo) {
      setAdminAlertBanner(extras.adminAlertInfo);
    }
    setGateNotice('');
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentUserRealName(null);
    setCurrentUserRole(null);
    setTwoFactorEnabled(false);
    setAdminAlertBanner(null);
  };

  const handleSessionTerminated = useCallback((reason: 'idle_timeout' | 'concurrent_session') => {
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentUserRealName(null);
    setCurrentUserRole(null);
    setTwoFactorEnabled(false);
    setAdminAlertBanner(null);
    setGateNotice(
      reason === 'concurrent_session'
        ? '동일 계정으로 다른 위치에서 로그인하여 현재 세션이 종료되었습니다.'
        : '보안 정책에 따라 10분 이상 미활동으로 자동 로그아웃되었습니다. 다시 로그인해 주세요.'
    );
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  // Health checks: Polling every 10s when authenticated
  useEffect(() => {
    if (!authToken) return;
    let isMounted = true;

    const checkHealth = async () => {
      setAgents((currentAgents) => {
        if (currentAgents.length === 0) return currentAgents;

        Promise.all(
          currentAgents.map(async (ag) => {
            const isOnline = await checkAgentHealth(ag);
            return { ...ag, isOnline };
          })
        ).then((updated) => {
          if (!isMounted) return;
          setAgents((latest) => {
            const changed = latest.some(
              (item, i) => updated[i] && item.isOnline !== updated[i].isOnline
            );
            if (!changed) return latest;
            return latest.map((item, i) => ({
              ...item,
              isOnline: updated[i] ? updated[i].isOnline : item.isOnline,
            }));
          });
        });

        return currentAgents;
      });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [authToken]);

  const loadAgentData = useCallback(async () => {
    if (!authToken || !selectedAgentId) {
      setContainers([]);
      setImages([]);
      setVolumes([]);
      setErrorMsg('');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      if (selectedAgentId === 'all') {
        const targetAgents = agents.filter((a) => a.isOnline);
        if (targetAgents.length === 0 && agents.length > 0) {
          setErrorMsg('All registered agent nodes are currently offline.');
          setContainers([]);
          setImages([]);
          setVolumes([]);
          setIsLoading(false);
          return;
        }

        const results = await Promise.all(
          targetAgents.map(async (ag) => {
            const [cList, iList, vList] = await Promise.all([
              fetchContainers(ag).catch(() => []),
              fetchImages(ag).catch(() => []),
              fetchVolumes(ag).catch(() => []),
            ]);
            const taggedContainers = cList.map((c) => ({
              ...c,
              agentName: ag.name,
              agentUrl: ag.url,
            }));
            const taggedVolumes = vList.map((v) => ({
              ...v,
              agentName: ag.name,
              agentUrl: ag.url,
            }));
            return { containers: taggedContainers, images: iList, volumes: taggedVolumes };
          })
        );

        setContainers(results.flatMap((r) => r.containers));
        setImages(results.flatMap((r) => r.images));
        setVolumes(results.flatMap((r) => r.volumes));
      } else {
        const targetAgent = agents.find((a) => a.id === selectedAgentId);
        if (!targetAgent) {
          setContainers([]);
          setImages([]);
          setVolumes([]);
          setIsLoading(false);
          return;
        }

        const [cList, iList, vList] = await Promise.all([
          fetchContainers(targetAgent).catch((e) => {
            setErrorMsg(e.message);
            return [];
          }),
          fetchImages(targetAgent).catch(() => []),
          fetchVolumes(targetAgent).catch(() => []),
        ]);

        setContainers(
          cList.map((c) => ({
            ...c,
            agentName: targetAgent.name,
            agentUrl: targetAgent.url,
          }))
        );
        setImages(iList);
        setVolumes(
          vList.map((v) => ({
            ...v,
            agentName: targetAgent.name,
            agentUrl: targetAgent.url,
          }))
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to communicate with Agent(s)');
    } finally {
      setIsLoading(false);
    }
  }, [authToken, selectedAgentId, agents]);

  useEffect(() => {
    if (authToken && selectedAgentId) {
      loadAgentData();
    }
  }, [authToken, selectedAgentId]);

  const handleControlContainer = async (
    containerId: string,
    action: 'start' | 'stop' | 'restart' | 'remove',
    removeVolumes?: boolean
  ) => {
    const targetContainer = containers.find((c) => c.id === containerId);
    const targetAgent = targetContainer?.agentUrl
      ? agents.find((a) => a.url === targetContainer.agentUrl) || selectedAgent
      : selectedAgent;

    if (!targetAgent) return;
    try {
      await controlContainer(targetAgent, containerId, action, removeVolumes);

      const actionUpper = action.toUpperCase();
      const containerName = targetContainer?.name || containerId;
      const volText = removeVolumes ? ' (with associated volumes)' : '';
      await recordHistory(
        targetAgent.name,
        targetAgent.url,
        actionUpper,
        `Container '${containerName}' ${action}ed successfully on ${targetAgent.name}${volText}`,
        containerId,
        containerName
      );

      setTimeout(loadAgentData, 1000);
    } catch (e: any) {
      alert(`Action error: ${e.message}`);
    }
  };

  const handlePruneImages = async () => {
    if (!selectedAgent) return;
    try {
      const res = await pruneImages(selectedAgent);
      const reclaimedMB = Math.round((res.spaceReclaimed || 0) / 1024 / 1024);
      alert(`Pruned successfully! Reclaimed ${reclaimedMB} MB`);

      await recordHistory(
        selectedAgent.name,
        selectedAgent.url,
        'PRUNE_IMAGES',
        `Pruned dangling images on ${selectedAgent.name}, reclaimed ${reclaimedMB} MB`
      );

      await loadAgentData();
    } catch (err: any) {
      alert(`Prune error: ${err.message}`);
    }
  };

  const handleDeleteVolumeConfirm = async () => {
    if (!deleteVolumeTarget) return;
    const { volume, agent } = deleteVolumeTarget;

    try {
      await deleteVolume(agent, volume.name);
      await recordHistory(
        agent.name,
        agent.url,
        'VOLUME_DELETE',
        `Deleted volume '${volume.name}' on ${agent.name}`
      );
      await loadAgentData();
    } catch (err: any) {
      alert(`볼륨 삭제 실패: ${err.message}`);
    } finally {
      setDeleteVolumeTarget(null);
    }
  };

  const handleAddAgent = async (newAgent: AgentConfig) => {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgent.name,
          url: newAgent.url,
          token: newAgent.token,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedList: AgentConfig[] = data.agents || [];
        setAgents(updatedList);
        const added =
          updatedList.find((a) => a.url === newAgent.url.replace(/\/$/, '')) ||
          updatedList[updatedList.length - 1];
        if (added) {
          setSelectedAgentId(added.id);
        }

        await recordHistory(
          newAgent.name,
          newAgent.url,
          'ADD_AGENT',
          `Added new agent node '${newAgent.name}' (${newAgent.url}) to watch list`
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to add agent to watch list');
      }
    } catch (e: any) {
      alert(`Add agent error: ${e.message}`);
    }
  };

  const handleRemoveAgent = async (id: string) => {
    const target = agents.find((a) => a.id === id);
    if (!target) return;

    try {
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.url, id }),
      });

      if (res.ok) {
        const data = await res.json();
        const updatedList: AgentConfig[] = data.agents || [];
        setAgents(updatedList);
        if (selectedAgentId === id) {
          setSelectedAgentId(updatedList.length > 0 ? updatedList[0].id : '');
        }

        await recordHistory(
          target.name,
          target.url,
          'REMOVE_AGENT',
          `Removed agent node '${target.name}' from watch list`
        );
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to remove agent from watch list');
      }
    } catch (e: any) {
      alert(`Delete agent error: ${e.message}`);
    }
  };

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state !== 'running').length;
  const onlineAgentsCount = agents.filter((a) => a.isOnline).length;

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-sans">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        <span>Verifying Control Plane Authentication...</span>
      </div>
    );
  }

  if (!authToken) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100 relative overflow-hidden select-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl z-10">
          <div className="flex items-center space-x-3 mb-5">
            <div className="bg-blue-600/20 p-2.5 rounded-xl border border-blue-500/30">
              <Server className="w-7 h-7 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">{appTitle}</h1>
              <p className="text-xs text-slate-400">Control Plane Dashboard Login & Registration</p>
            </div>
          </div>

          {gateNotice && (
            <div className="mb-4 bg-amber-950/60 border border-amber-800/80 text-amber-200 text-xs font-semibold p-3 rounded-xl">
              {gateNotice}
            </div>
          )}

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
            <button
              onClick={() => {
                setGateTab('login');
                setGateRequires2FA(false);
                const err = document.getElementById('gate-error-msg');
                if (err) err.innerText = '';
                const succ = document.getElementById('gate-success-msg');
                if (succ) succ.innerText = '';
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                gateTab === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              로그인 (Sign In)
            </button>
            <button
              onClick={() => {
                setGateTab('register');
                setGateRequires2FA(false);
                const err = document.getElementById('gate-error-msg');
                if (err) err.innerText = '';
                const succ = document.getElementById('gate-success-msg');
                if (succ) succ.innerText = '';
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                gateTab === 'register' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              회원가입 (Sign Up)
            </button>
          </div>

          <div id="gate-error-msg" className="mb-4 text-rose-300 text-xs font-semibold empty:hidden bg-rose-950/60 border border-rose-800/80 p-3 rounded-xl" />
          <div id="gate-success-msg" className="mb-4 text-emerald-300 text-xs font-semibold empty:hidden bg-emerald-950/60 border border-emerald-800/80 p-3 rounded-xl" />

          {gateTab === 'login' ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const username = (form.elements.namedItem('username') as HTMLInputElement).value;
                const password = (form.elements.namedItem('password') as HTMLInputElement).value;
                const totpInput = form.elements.namedItem('totpCode') as HTMLInputElement | null;
                const totpCode = totpInput ? totpInput.value : undefined;
                const errorEl = document.getElementById('gate-error-msg');
                if (errorEl) errorEl.innerText = '';

                try {
                  const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, totpCode }),
                  });
                  const data = await res.json();
                  if (data.requiresTwoFactor && !data.authenticated) {
                    setGateRequires2FA(true);
                    if (data.error && errorEl) errorEl.innerText = data.error;
                    return;
                  }
                  if (res.ok && data.success) {
                    if (data.requirePasswordChange) {
                      setGateExpiredUsername(data.username || username);
                      setIsPasswordChangeOpen(true);
                      return;
                    }
                    setGateRequires2FA(false);
                    handleLoginSuccess(data.username || username, data.name, data.role, {
                      twoFactorEnabled: data.twoFactorEnabled,
                      adminAlertInfo: data.adminAlertInfo,
                    });
                  } else {
                    if (errorEl) errorEl.innerText = data.error || '아이디 또는 비밀번호가 올바르지 않습니다.';
                  }
                } catch (err: any) {
                  if (errorEl) errorEl.innerText = err.message || '로그인 요청 중 오류가 발생했습니다.';
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">사용자 아이디 (ID)</label>
                <input
                  name="username"
                  type="text"
                  required
                  placeholder="아이디 입력"
                  onChange={() => setGateRequires2FA(false)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">비밀번호 (Password)</label>
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="비밀번호 입력 (연속 5회 실패 시 계정 잠금)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500 transition"
                />
              </div>

              {gateRequires2FA && (
                <div className="bg-emerald-950/30 border border-emerald-800/60 rounded-xl p-3 space-y-1.5">
                  <label className="block text-xs font-semibold text-emerald-300">2단계 인증 (OTP) 6자리 코드</label>
                  <input
                    name="totpCode"
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    placeholder="123456"
                    className="w-full bg-slate-950 border border-emerald-700 rounded-xl px-4 py-2 text-sm font-mono tracking-widest text-slate-100 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg hover:shadow-blue-500/25 transition mt-2 flex items-center justify-center space-x-2"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{gateRequires2FA ? 'OTP 인증 후 로그인' : '대시보드 로그인 (Sign In)'}</span>
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setIsPasswordChangeOpen(true)}
                  className="text-[11px] text-slate-500 hover:text-blue-400 underline transition"
                >
                  비밀번호 90일 만료 재설정 / 변경
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const username = (form.elements.namedItem('reg_username') as HTMLInputElement).value;
                const password = (form.elements.namedItem('reg_password') as HTMLInputElement).value;
                const confirmPassword = (form.elements.namedItem('reg_confirm') as HTMLInputElement).value;
                const name = (form.elements.namedItem('reg_name') as HTMLInputElement).value;
                const email = (form.elements.namedItem('reg_email') as HTMLInputElement).value;

                const errorEl = document.getElementById('gate-error-msg');
                const successEl = document.getElementById('gate-success-msg');
                if (errorEl) errorEl.innerText = '';
                if (successEl) successEl.innerText = '';

                if (password !== confirmPassword) {
                  if (errorEl) errorEl.innerText = '비밀번호와 비밀번호 확인이 일치하지 않습니다.';
                  return;
                }

                try {
                  const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, name, email }),
                  });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    if (successEl) successEl.innerText = '회원가입이 완료되었습니다! 로그인 탭에서 로그인해 주세요.';
                    setTimeout(() => setGateTab('login'), 1500);
                  } else {
                    if (errorEl) errorEl.innerText = data.error || '회원가입에 실패했습니다.';
                  }
                } catch (err: any) {
                  if (errorEl) errorEl.innerText = err.message || '회원가입 중 오류가 발생했습니다.';
                }
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">사용자 아이디 (ID)</label>
                <input
                  name="reg_username"
                  type="text"
                  required
                  placeholder="개별 ID 최소 3자 (admin/root 불가)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">실명 (Full Name)</label>
                  <input
                    name="reg_name"
                    type="text"
                    required
                    placeholder="홍길동"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">이메일 (Email)</label>
                  <input
                    name="reg_email"
                    type="email"
                    required
                    placeholder="user@example.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400">비밀번호</label>
                  <span className={`text-[10px] font-semibold ${gateRegComplexityMet ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {gateRegComplexityMet ? '✓ 복잡도 만족' : '영대/소문자, 숫자, 특수문자 중 3종류 8자'}
                  </span>
                </div>
                <input
                  name="reg_password"
                  type="password"
                  required
                  placeholder="영대/소문자, 숫자, 특수문자 조합"
                  onChange={(e) => {
                    const pw = e.target.value;
                    let count = 0;
                    if (/[a-z]/.test(pw)) count++;
                    if (/[A-Z]/.test(pw)) count++;
                    if (/[0-9]/.test(pw)) count++;
                    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(pw)) count++;
                    setGateRegComplexityMet(pw.length >= 8 && count >= 3);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">비밀번호 확인</label>
                <input
                  name="reg_confirm"
                  type="password"
                  required
                  placeholder="비밀번호 다시 입력"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm py-2 rounded-xl shadow-lg hover:shadow-blue-500/25 transition mt-2 flex items-center justify-center space-x-2"
              >
                <span>회원가입 완료</span>
              </button>
            </form>
          )}
        </div>

        {isPasswordChangeOpen && (
          <PasswordChangeModal
            isOpen={isPasswordChangeOpen}
            onClose={() => setIsPasswordChangeOpen(false)}
            username={gateExpiredUsername || ''}
            isExpiredPrompt={!!gateExpiredUsername}
            onSuccess={() => {
              setIsPasswordChangeOpen(false);
              setGateExpiredUsername('');
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <IdleTimeoutGuard
        isAuthenticated={!!authToken}
        onSessionTerminated={handleSessionTerminated}
      />

      <Navbar
        appTitle={appTitle}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        isAuthenticated={!!authToken}
        currentUser={currentUser}
        currentUserRealName={currentUserRealName}
        currentUserRole={currentUserRole}
        twoFactorEnabled={twoFactorEnabled}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        onOpenChangePassword={() => setIsPasswordChangeOpen(true)}
        onOpenTwoFactor={() => setIsTwoFactorOpen(true)}
      />

      <div className="flex-1 flex w-full max-w-[1920px] mx-auto min-h-[calc(100vh-61px)]">
        <Sidebar
          agents={agents}
          selectedAgentId={selectedAgentId}
          onSelectAgent={setSelectedAgentId}
          onOpenAddAgent={() => setIsAddAgentOpen(true)}
          onOpenServerLogs={(ag) => setServerLogAgent(ag)}
          currentUserRole={currentUserRole}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8">
          {/* Admin Login Security Alert Banner (항목 14-③) */}
          {adminAlertBanner && (
            <div className="mb-6 bg-amber-950/70 border border-amber-700/80 text-amber-100 px-4 py-3 rounded-xl flex items-start justify-between text-xs shadow-lg">
              <div className="flex items-start space-x-3">
                <BellRing className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-200">{adminAlertBanner.message}</p>
                  <p className="text-amber-300/90 font-mono">
                    현재 접속 IP: {adminAlertBanner.currentIp} | 이전 접속 IP: {adminAlertBanner.previousLoginIp || '최초'} (
                    {adminAlertBanner.previousLoginAt ? new Date(adminAlertBanner.previousLoginAt).toLocaleString() : '-'}) |
                    최근 로그인 실패: {adminAlertBanner.recentFailedAttempts || 0}건
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdminAlertBanner(null)}
                className="text-amber-300 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="mb-6 bg-rose-950/70 border border-rose-800 text-rose-200 px-4 py-3 rounded-xl flex items-center justify-between text-sm shadow-md">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
              <button
                onClick={loadAgentData}
                className="text-xs bg-rose-900/50 hover:bg-rose-900 border border-rose-700/50 px-2.5 py-1 rounded-md transition"
              >
                Retry
              </button>
            </div>
          )}

          {/* Dashboard Stats */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Agents Online</p>
                <h3 className="text-3xl font-bold mt-1 text-emerald-400">
                  {onlineAgentsCount} <span className="text-slate-500 text-sm font-normal">/ {agents.length}</span>
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <Server className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Running Containers</p>
                <h3 className="text-3xl font-bold mt-1 text-blue-400">{runningCount}</h3>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                <PlayCircle className="w-6 h-6 text-blue-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Stopped Containers</p>
                <h3 className="text-3xl font-bold mt-1 text-rose-400">{stoppedCount}</h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20">
                <StopCircle className="w-6 h-6 text-rose-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Images</p>
                <h3 className="text-3xl font-bold mt-1 text-purple-400">{images.length}</h3>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                <Layers className="w-6 h-6 text-purple-400" />
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Volumes</p>
                <h3 className="text-3xl font-bold mt-1 text-indigo-400">{volumes.length}</h3>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <HardDrive className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
          </section>

          {/* Tab Navigation & Refresh */}
          <div className="flex items-center justify-between border-b border-slate-800 mb-6 pb-2">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('containers')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'containers'
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Box className="w-4 h-4" />
                <span>Containers ({containers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('images')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'images'
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Images ({images.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('volumes')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'volumes'
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span>Volumes ({volumes.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('agents')}
                className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
                  activeTab === 'agents'
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Agent Nodes ({agents.length})</span>
              </button>
            </div>

            <button
              onClick={loadAgentData}
              disabled={isLoading}
              className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-800 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {activeTab === 'containers' && (
            <ContainerTable
              containers={containers}
              allVolumes={volumes}
              isLoading={isLoading}
              onControl={handleControlContainer}
              onOpenLogs={setSelectedLogContainer}
              currentUserRole={currentUserRole}
            />
          )}

          {activeTab === 'images' && (
            <ImageTable
              images={images}
              isLoading={isLoading}
              onPrune={handlePruneImages}
              currentUserRole={currentUserRole}
            />
          )}

          {activeTab === 'volumes' && (
            <VolumeTable
              volumes={volumes}
              agents={agents}
              isLoading={isLoading}
              onDeleteVolume={(vol, ag) => setDeleteVolumeTarget({ volume: vol, agent: ag })}
              currentUserRole={currentUserRole}
            />
          )}

          {activeTab === 'agents' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between font-semibold text-slate-200">
                <span>Registered Agent Engine Nodes</span>
                {currentUserRole !== 'monitor' && (
                  <button
                    onClick={() => setIsAddAgentOpen(true)}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg flex items-center space-x-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add New Agent</span>
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-800">
                {agents.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    <Server className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
                    <p className="font-semibold text-slate-300">No Agent Nodes registered yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click &apos;Add New Agent&apos; above or in the navigation bar to register your Docker agent.
                    </p>
                  </div>
                ) : (
                  agents.map((ag) => (
                    <div key={ag.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                      <div>
                        <h4 className="font-bold text-slate-100 text-sm flex items-center space-x-2">
                          <span>{ag.name}</span>
                          {ag.isOnline ? (
                            <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded">
                              Online
                            </span>
                          ) : (
                            <span className="text-[10px] bg-rose-950 text-rose-300 border border-rose-800 px-2 py-0.5 rounded">
                              Offline
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-slate-400 font-mono mt-0.5">{ag.url}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setServerLogAgent(ag)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-blue-300 transition flex items-center space-x-1"
                        >
                          <Server className="w-3.5 h-3.5" />
                          <span>서버 로그</span>
                        </button>
                        <button
                          onClick={() => setSelectedAgentId(ag.id)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                            selectedAgentId === ag.id
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                          }`}
                        >
                          {selectedAgentId === ag.id ? 'Active Node' : 'Select Node'}
                        </button>
                        {currentUserRole !== 'monitor' && (
                          <button
                            onClick={() => handleRemoveAgent(ag.id)}
                            className="text-xs p-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-900/50 rounded-lg transition"
                            title="Remove Agent"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <AgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAddAgent={handleAddAgent}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <PasswordChangeModal
        isOpen={isPasswordChangeOpen}
        onClose={() => setIsPasswordChangeOpen(false)}
        username={currentUser || ''}
        onSuccess={() => {
          setIsPasswordChangeOpen(false);
        }}
      />

      <TwoFactorModal
        isOpen={isTwoFactorOpen}
        onClose={() => setIsTwoFactorOpen(false)}
        onStatusChange={(enabled) => setTwoFactorEnabled(enabled)}
      />

      <LogViewerModal
        container={selectedLogContainer}
        agent={
          selectedLogContainer?.agentUrl
            ? agents.find((a) => a.url === selectedLogContainer.agentUrl) || selectedAgent
            : selectedAgent
        }
        onClose={() => setSelectedLogContainer(null)}
      />

      <ServerLogModal
        agent={serverLogAgent}
        isOpen={!!serverLogAgent}
        onClose={() => setServerLogAgent(null)}
      />

      {deleteVolumeTarget && (
        <ConfirmModal
          isOpen={!!deleteVolumeTarget}
          onClose={() => setDeleteVolumeTarget(null)}
          onConfirm={handleDeleteVolumeConfirm}
          actionType="delete_volume"
          title="도커 볼륨 영구 삭제 확인"
          description={`볼륨 '${deleteVolumeTarget.volume.name}'을(를) 삭제하시겠습니까? 볼륨 내부 데이터가 완전히 제거됩니다.`}
          confirmText="볼륨 영구 삭제"
          requireMatchText={deleteVolumeTarget.volume.name}
        />
      )}
    </div>
  );
}
