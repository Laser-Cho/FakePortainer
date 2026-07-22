# 🚀 FakePortainer 사용 및 배포 가이드 (USAGE.md)

이 문서는 **FakePortainer**의 Agent 및 Host 서비스에 대한 **Dockerfile 빌드 방법**, **Docker CLI 실행 방법**, **Docker Compose 레시피**, 및 **운영/보안 가이드**를 설명합니다.

---

## 📌 1. 시스템 아키텍처 요약

- **Agent Node (`Agent/`)**: 관리 대상이 되는 각 서버에 배포되는 초경량 API 서버 (Port: `9000`). 호스트 머신의 `/var/run/docker.sock`을 볼륨 마운트하여 컨테이너 제어 및 터미널 로그 스트리밍을 중계합니다.
- **Host Control Plane (`Host/`)**: 중앙 제어 머신에 배포되는 Next.js 대시보드 웹 GUI (Port: `3000`). 여러 Agent 서버를 등록하여 모니터링 및 제어합니다.

---

## 🛠️ 2. Dockerfile 직접 빌드 방법

### A. Agent 빌드
```bash
# 프로젝트 루트 디렉터리에서 실행
docker build -t fake-portainer-agent:latest ./Agent
```

### B. Host Control Plane 빌드
```bash
# 프로젝트 루트 디렉터리에서 실행
docker build -t fake-portainer-host:latest ./Host
```

> [!NOTE]
> 폐쇄망 또는 프록시/사설 CA 환경에서 `registry.npmjs.org` SSL 검증 차단 문제를 방지하기 위해, 모든 Dockerfile의 `npm install` 명령에 `npm config set strict-ssl false` 및 `--strict-ssl=false` 옵션이 적용되어 있습니다.


---

## 🐳 3. Docker Run 직접 실행 방법

### A. Agent 노드 실행 (관리 대상 서버)
> [!IMPORTANT]
> 반드시 호스트 머신의 `/var/run/docker.sock`을 컨테이너 내부로 볼륨 마운트해야 Docker 데몬을 제어할 수 있습니다.

```bash
docker run -d \
  --name fake-portainer-agent \
  -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e PORT=9000 \
  -e AGENT_SECRET_TOKEN="your_secure_agent_token" \
  --restart always \
  fake-portainer-agent:latest
```

### B. Host Control Plane 실행 (중앙 제어 서버)
```bash
docker run -d \
  --name fake-portainer-host \
  -p 3000:3000 \
  -e NODE_ENV=production \
  --restart always \
  fake-portainer-host:latest
```

---

## 📜 4. Docker Compose 배포 레시피

### Scenario 1: 단일 머신 통합 실행 (Full Stack)
로컬 테스트 및 단일 서버 모니터링을 위해 Agent와 Host를 한 번에 실행합니다.
- 레시피 파일: [docker-compose.yml](file:///mnt/d/FakePortainer/docker-compose.yml)

```yaml
version: '3.8'

services:
  agent:
    build:
      context: ./Agent
      dockerfile: Dockerfile
    image: fake-portainer-agent:latest
    container_name: fake-portainer-agent
    restart: always
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - PORT=9000
      - AGENT_SECRET_TOKEN=your_secure_agent_token

  host:
    build:
      context: ./Host
      dockerfile: Dockerfile
    image: fake-portainer-host:latest
    container_name: fake-portainer-host
    restart: always
    ports:
      - "3000:3000"
    depends_on:
      - agent
```
**실행 명령:**
```bash
docker compose up -d
```

---

### Scenario 2: 개별 서버 분리 배포 (Multi-Server Setup)

#### 1) 각 타겟 서버에 Agent만 배포할 때
- 레시피 파일: [Agent/docker-compose.yml](file:///mnt/d/FakePortainer/Agent/docker-compose.yml)

```yaml
version: '3.8'

services:
  fake-portainer-agent:
    build:
      context: .
      dockerfile: Dockerfile
    image: fake-portainer-agent:latest
    container_name: fake-portainer-agent
    restart: always
    ports:
      - "9000:9000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    environment:
      - PORT=9000
      - AGENT_SECRET_TOKEN=your_secure_agent_token
```
**실행 명령:**
```bash
cd Agent
docker compose up -d
```

#### 2) 중앙 서버에 Host(Control Plane)만 배포할 때
- 레시피 파일: [Host/docker-compose.yml](file:///mnt/d/FakePortainer/Host/docker-compose.yml)

```yaml
version: '3.8'

services:
  fake-portainer-host:
    build:
      context: .
      dockerfile: Dockerfile
    image: fake-portainer-host:latest
    container_name: fake-portainer-host
    restart: always
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
```
**실행 명령:**
```bash
cd Host
docker compose up -d
```

---

## 🔒 5. 보안 및 권한 설정 가이드

1. **Docker Socket 접근 권한**:
   - `/var/run/docker.sock` 파일은 root 및 `docker` 그룹에 권한이 있습니다. 에이전트 구동 중 Permission Denied 발생 시 아래 명령어로 권한을 확인해 주세요.
   ```bash
   sudo chmod 660 /var/run/docker.sock
   ```
2. **보안 토큰 관리 (`AGENT_SECRET_TOKEN`)**:
   - Agent 실행 시 설정한 `AGENT_SECRET_TOKEN` 값과 Host 대시보드의 에이전트 등록 시 입력하는 Token 값이 일치해야 REST API 및 WebSocket 접속이 허용됩니다.
3. **방화벽 (UFW/iptables)**:
   - Agent의 9000 포트가 외부에 무방비로 노출되지 않도록, Host 대시보드 서버의 IP 주소만 인바운드를 허용할 것을 권장합니다.
   ```bash
   # 예시: Host 서버 IP(192.168.1.50)만 Agent 9000 포트 허용
   sudo ufw allow from 192.168.1.50 to any port 9000
   ```

---

## ❓ 6. 문제 해결 (Troubleshooting)

- **에이전트 상태가 Offline으로 표시될 때**:
  1. Agent 컨테이너가 정상 실행 중인지 확인: `docker ps | grep fake-portainer-agent`
  2. 9000번 포트에 헬스체크 응답 확인: `curl http://<AGENT_IP>:9000/health`
  3. Host 화면에서 등록된 Agent URL 및 Token 값 재확인
- **로그 스트리밍이 연결되지 않을 때**:
  - WebSocket 통신을 방해하는 차단 유무 확인 (`ws://<AGENT_IP>:9000/api/containers/:id/logs?token=...`)
