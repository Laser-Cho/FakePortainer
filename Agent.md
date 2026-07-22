# Agent.md - 각 서버 배포용 경량 Docker 에이전트 가이드

이 문서는 관리 대상이 되는 각 서버(Node)에 설치되어 Docker 데몬과 직접 통신하며, 중앙 제어 호스트(HOST)의 명령을 처리하는 **경량 Docker 에이전트(Agent)**의 구축 방법과 보안 조건을 정의합니다.

---

## 1. 역할 및 목표
- **Docker 소켓 브릿지:** 각 서버의 Docker 데몬 API 소켓(`/var/run/docker.sock`)에 안전하게 접근하여 외부의 통신 요청을 Docker 제어 명령으로 번역합니다.
- **실시간 데이터 스트리밍:** 특정 컨테이너의 실시간 터미널 로그 출력을 위해 백엔드 스트림을 WebSocket으로 중계합니다.
- **최소 경량화:** 추가적인 UI 없이 REST API와 WebSocket 연결만을 처리하는 초경량 API 서버로 동작합니다.

---

## 2. 핵심 기능 요구사항
1. **Docker 데몬 연동:**
   - Node.js `dockerode` 라이브러리를 사용하여 로컬 Docker 엔진과 연결
2. **REST API 엔드포인트 구현:**
   - `GET /api/containers` : 로컬 전체 컨테이너 목록 조회 (ID, 이름, 포트 매핑, 이미지, 상태 등)
   - `POST /api/containers/:id/start` : 컨테이너 시작
   - `POST /api/containers/:id/stop` : 컨테이너 중지
   - `POST /api/containers/:id/restart` : 컨테이너 재시작
   - `DELETE /api/containers/:id` : 컨테이너 삭제
   - `GET /api/images` : 로컬 Docker 이미지 목록 조회
   - `POST /api/images/prune` : 사용하지 않는 이미지(Dangling) 일괄 삭제
3. **WebSocket 실시간 로그 스트리밍:**
   - `/api/containers/:id/logs` 연결 시, 해당 컨테이너의 Docker 로그 스트림(`dockerode.getEvents` 또는 `container.logs`)을 읽어 클라이언트에 실시간 전송
4. **접근 제어 미들웨어:**
   - 모든 REST 요청 및 WebSocket 연결 시 토큰 유효성 검사 적용

---

## 3. 기술 스택
- **Runtime:** Node.js
- **Framework:** Express
- **Docker Client:** `dockerode`
- **Real-time:** `ws` (Node.js WebSocket library)
- **Security:** `jsonwebtoken` (JWT 검증용), `cors` (교차 출처 리소스 공유 제한)

---

## 4. 에이전트 구동 및 볼륨 마운트 방법

에이전트는 호스트 머신의 Docker 환경을 제어해야 하므로, 에이전트 자체를 Docker 컨테이너로 띄울 때 반드시 호스트의 Docker 소켓을 볼륨 마운트해야 합니다.

### Docker Run 명령 예시:
```bash
docker run -d \
  --name fake-portainer-agent \
  -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e AGENT_SECRET_TOKEN="your_secure_agent_token" \
  fake-portainer-agent-image:latest
```

> [!NOTE]
> 호스트의 `/var/run/docker.sock`이 컨테이너 내부의 동일 경로에 마운트되어야 `dockerode` 라이브러리가 기본 소켓 경로를 통해 Docker 데몬과 통신할 수 있습니다.

---

## 5. 보안 및 안전성 요구 조건
- **Docker 소켓 권한 보호:**
  - `/var/run/docker.sock`에 접근할 수 있는 애플리케이션은 사실상 root 권한을 가지게 됩니다. 따라서 에이전트 포트(예: 9000)가 공인 IP를 통해 외부에 무방비로 노출되지 않도록 각별히 유의해야 합니다.
- **인증 토큰(JWT/API Key) 검증:**
  - 중앙 제어 호스트(HOST)에서 발급하거나 사전에 약속된 Bearer 토큰이 `Authorization` 헤더에 유효하게 포함되어 있는지 확인하는 미들웨어를 모든 라우트에 적용합니다.
- **CORS 및 방화벽 설정:**
  - Express 설정 시 `cors` 옵션을 활용하여 중앙 제어 호스트(HOST)의 도메인 또는 IP만 통신할 수 있도록 제한합니다.
  - 서버 레벨의 방화벽(ufw, iptables 등) 설정을 통해 허용된 중앙 제어 호스트 IP로부터의 인바운드 트래픽만 허용할 것을 권장합니다.
