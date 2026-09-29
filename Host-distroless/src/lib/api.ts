import { AgentConfig, ContainerInfo, ImageInfo, VolumeInfo } from './types';

// Helper to send request to Host Proxy Route
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
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
    const res = await fetchWithTimeout('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentUrl: agent.url,
        endpoint: '/health',
        method: 'GET'
      })
    }, 5000);
    if (!res.ok) {
      return false;
    }
    const data = await res.json();
    return data.status === 'ok';
  } catch (err: any) {
    return false;
  }
}

export async function fetchContainers(agent: AgentConfig): Promise<ContainerInfo[]> {
  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint: '/api/containers',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
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
  action: 'start' | 'stop' | 'restart' | 'remove',
  removeVolumes?: boolean
): Promise<void> {
  const method = action === 'remove' ? 'DELETE' : 'POST';
  let endpoint = `/api/containers/${containerId}/${action === 'remove' ? '' : action}`;
  if (action === 'remove') {
    const queryParams: string[] = ['force=true'];
    if (removeVolumes) {
      queryParams.push('v=true');
    }
    endpoint += `?${queryParams.join('&')}`;
  }

  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint,
      method,
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to ${action} container (${res.status})`);
  }
}

export async function fetchImages(agent: AgentConfig): Promise<ImageInfo[]> {
  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint: '/api/images',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch images (${res.status})`);
  }
  const data = await res.json();
  return data.images || [];
}

export async function pruneImages(agent: AgentConfig): Promise<{ imagesDeleted: any[]; spaceReclaimed: number }> {
  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint: '/api/images/prune',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to prune images (${res.status})`);
  }
  return await res.json();
}

export async function fetchVolumes(agent: AgentConfig): Promise<VolumeInfo[]> {
  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint: '/api/volumes',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to fetch volumes (${res.status})`);
  }
  const data = await res.json();
  return data.volumes || [];
}

export async function deleteVolume(agent: AgentConfig, volumeName: string): Promise<void> {
  const res = await fetchWithTimeout('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentUrl: agent.url,
      endpoint: `/api/volumes/${encodeURIComponent(volumeName)}`,
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${agent.token}`
      }
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to delete volume (${res.status})`);
  }
}
