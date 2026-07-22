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

export interface ContainerInfo {
  id: string;
  fullId: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'paused' | 'restarting' | string;
  status: string;
  created: number;
  ports: ContainerPort[];
}

export interface ImageInfo {
  id: string;
  fullId: string;
  repoTags: string[];
  size: number;
  created: number;
}
