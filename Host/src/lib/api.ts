import { AgentConfig, ContainerInfo, ImageInfo } from './types';

// Helper to send request with timeout & error handling
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`);
    }
    throw err;
  }
}

export async function checkAgentHealth(agent: AgentConfig): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${agent.url}/health`, {}, 3000);
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchContainers(agent: AgentConfig): Promise<ContainerInfo[]> {
  const res = await fetchWithTimeout(`${agent.url}/api/containers`, {
    headers: {
      Authorization: `Bearer ${agent.token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch containers (${res.status})`);
  }
  const data = await res.json();
  return data.containers || [];
}

export async function controlContainer(
  agent: AgentConfig,
  containerId: string,
  action: 'start' | 'stop' | 'restart' | 'remove'
): Promise<void> {
  const method = action === 'remove' ? 'DELETE' : 'POST';
  const url = `${agent.url}/api/containers/${containerId}/${action === 'remove' ? '' : action}`;

  const res = await fetchWithTimeout(url, {
    method,
    headers: {
      Authorization: `Bearer ${agent.token}`
    }
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to ${action} container (${res.status})`);
  }
}

export async function fetchImages(agent: AgentConfig): Promise<ImageInfo[]> {
  const res = await fetchWithTimeout(`${agent.url}/api/images`, {
    headers: {
      Authorization: `Bearer ${agent.token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch images (${res.status})`);
  }
  const data = await res.json();
  return data.images || [];
}

export async function pruneImages(agent: AgentConfig): Promise<{ imagesDeleted: any[]; spaceReclaimed: number }> {
  const res = await fetchWithTimeout(`${agent.url}/api/images/prune`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${agent.token}`
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to prune images (${res.status})`);
  }
  return await res.json();
}
