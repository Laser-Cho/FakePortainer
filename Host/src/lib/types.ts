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
  actionType: 'START' | 'STOP' | 'RESTART' | 'DELETE' | 'PRUNE_IMAGES' | 'ADD_AGENT' | 'REMOVE_AGENT' | 'DETECTED_CHANGE' | string;
  detail: string;
  user?: string;
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

