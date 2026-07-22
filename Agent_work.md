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
