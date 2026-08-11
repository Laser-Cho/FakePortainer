# FakePortainer Agent - 작업 내역 (Work Log)

## 📌 프로젝트 정보
- **위치:** `Agent/`
- **역할:** 각 서버(Node)에 배포되어 `/var/run/docker.sock`과 직접 통신하는 경량 REST API 및 WebSocket 서버
- **기술 스택:** Node.js, Express, dockerode, ws, jsonwebtoken, cors

---

## 🛠 작업 이력

### [Phase 1] 초기 셋업 (Completed: 2026-07-22)
- [x] `Agent/` 디렉터리 구조 및 프로젝트 초기화 (`package.json`)
- [x] Node.js Express 기반 기본 서버 엔드포인트 (`src/index.js`) 구성
- [x] 호스트 Docker 소켓 바인딩용 Dockerfile (`Agent/Dockerfile`) 및 `.dockerignore` 생성

### [Phase 2] 백엔드 코어 & Docker Engine 연동 (Completed: 2026-07-22)
- [x] `dockerode` 라이브러리 연동 및 `/var/run/docker.sock` 연결 모듈 (`src/docker.js`) 생성
- [x] 컨테이너 전체 목록 조회 API (`GET /api/containers`) 구현 (ID, Name, Image, Status, Port Mapping)

### [Phase 4] 컨테이너 제어 API (Completed: 2026-07-22)
- [x] 컨테이너 제어 API 라우트 (`src/routes/containers.js`) 구현
  - `POST /api/containers/:id/start` (컨테이너 시작)
  - `POST /api/containers/:id/stop` (컨테이너 중지)
  - `POST /api/containers/:id/restart` (컨테이너 재시작)
  - `DELETE /api/containers/:id` (컨테이너 삭제)
- [x] **[기능 추가] Docker Compose 라벨 및 브릿지 네트워크 정보 추출**: `com.docker.compose.*` 라벨과 `NetworkSettings.Networks` 정보를 추출하여 각 컨테이너의 컴포즈 출처 및 연결된 도커 브릿지/네트워크 명, IP, 게이트웨이, MAC 주소 반환 기능 구현

### [Phase 5] 실시간 터미널 로그 스트리밍 (Completed: 2026-07-22)
- [x] WebSocket 서버 핸들러 (`src/websocket/logs.js`) 작성
- [x] `/api/containers/:id/logs` 엔드포인트 접속 시 `container.logs({ follow: true })` 로그 중계

### [Phase 6] 이미지 관리 API (Completed: 2026-07-22)
- [x] 이미지 관리 API 라우트 (`src/routes/images.js`) 구현
  - `GET /api/images` (로컬 이미지 목록 조회)
  - `POST /api/images/prune` (Dangling 미사용 이미지 일괄 삭제)

### [Phase 7] 보안 및 토큰 검증 (Completed: 2026-07-22)
- [x] Bearer Token / JWT 인증 검증 미들웨어 (`src/middleware/auth.js`) 구현 및 적용
- [x] WebSocket 연결 시 쿼리 파라미터 토큰 검증 추가

### [Phase 12 & Phase 13] 도커 볼륨 제어 API & 컨테이너 연관 볼륨 삭제 지원 (Completed: 2026-08-11)
- [x] **[볼륨 API 구현]**: `src/routes/volumes.js` 모듈 구현 (`GET /api/volumes`, `DELETE /api/volumes/:name`, `POST /api/volumes/prune`)
- [x] **[컨테이너 마운트 정보 제공]**: `GET /api/containers` 라우트에서 `Mounts` 배열 정보를 파싱하여 컨테이너 바인딩 볼륨 목록(`mounts`) 반환
- [x] **[연관 볼륨 함께 삭제 & 강제 삭제]**: `DELETE /api/containers/:id` 쿼리 파라미터 `v=true` 및 `force=true` 지원 구현 (`container.remove({ v: true, force: true })`)

