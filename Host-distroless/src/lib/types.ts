export interface AgentConfig {
  id: string;
  name: string;
  url: string; // e.g. http://localhost:9000
  token: string;
  isOnline?: boolean;
}

export interface ContainerPort {
  privatePort: number;
  publicPort?: number;
  type: string;
  ip?: string;
}

export interface ContainerNetwork {
  name: string;
  ip?: string | null;
  gateway?: string | null;
  mac?: string | null;
}

export interface ContainerMount {
  type: string;
  name?: string | null;
  source?: string | null;
  destination?: string | null;
  driver?: string | null;
}

export interface ContainerInfo {
  id: string;
  fullId: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | string;
  status: string;
  created: number;
  ports: ContainerPort[];
  composeFile?: string | null;
  composeProject?: string | null;
  composeService?: string | null;
  networks?: ContainerNetwork[];
  mounts?: ContainerMount[];
  agentName?: string;
  agentUrl?: string;
}

export interface ImageInfo {
  id: string;
  fullId: string;
  repoTags: string[];
  size: number;
  created: number;
}

export interface HistoryLogItem {
  id: string;
  timestamp: string;
  agentName: string;
  agentUrl: string;
  containerId?: string;
  containerName?: string;
  actionType: 'START' | 'STOP' | 'RESTART' | 'DELETE' | 'PRUNE_IMAGES' | 'ADD_AGENT' | 'REMOVE_AGENT' | 'DETECTED_CHANGE' | 'VOLUME_DELETE' | string;
  detail: string;
  user?: string;
  userRealName?: string;
  clientIp?: string;
}

export interface VolumeAttachedContainer {
  id: string;
  name: string;
  state: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  mountpoint: string;
  created?: string | null;
  attachedContainers: VolumeAttachedContainer[];
  agentName?: string;
  agentUrl?: string;
}

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  name: string; // Real name (실명)
  email: string; // Email (이메일)
  passwordHash: string;
  salt: string;
  role: UserRole;
  createdAt: string;
  passwordChangedAt: string;
  failedLoginAttempts: number;
  isLocked: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  passwordChangedAt: string;
  isLocked: boolean;
  requirePasswordChange?: boolean;
}

export type SystemLogCategory =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'ACCESS_DENIED'
  | 'USER_MGMT'
  | 'ROLE_CHANGE'
  | 'OPERATION'
  | 'EVENT';

export type SystemLogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface SystemLogItem {
  id: string;
  timestamp: string;
  clientIp: string;
  user: string; // username or 'anonymous'
  userRealName?: string;
  category: SystemLogCategory;
  level: SystemLogLevel;
  action: string;
  detail: string;
}

export interface ClusterNodeSummary {
  id: string;
  name: string;
  url: string;
  isOnline: boolean;
  containersCount: number;
  runningCount: number;
  stoppedCount: number;
}

export interface ClusterStatusResponse {
  timestamp: string;
  summary: {
    totalNodes: number;
    onlineNodes: number;
    offlineNodes: number;
    totalContainers: number;
    runningContainers: number;
    stoppedContainers: number;
  };
  nodes: ClusterNodeSummary[];
  containers: ContainerInfo[];
}

