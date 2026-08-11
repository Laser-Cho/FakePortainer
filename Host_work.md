# FakePortainer Host - 작업 내역 (Work Log)

## 📌 프로젝트 정보
- **위치:** `Host/`
- **역할:** 여러 에이전트를 통합 모니터링 및 제어하는 웹 GUI 대시보드 (Control Plane)
- **기술 스택:** Next.js (React), TypeScript, Tailwind CSS, Shadcn UI (Dark Theme)

---

## 🛠 작업 이력

### [Phase 1] 초기 셋업 (Completed: 2026-07-22)
- [x] `Host/` 디렉터리 구조 및 Next.js App Router 프로젝트 기본 셋업
- [x] Tailwind CSS 및 다크 테마 디자인 시스템 구조화 (`globals.css`, `tailwind.config.ts`)
- [x] 멀티스테이지 빌드 Dockerfile (`Host/Dockerfile`) 및 `.dockerignore` 생성

### [Phase 2 & Step 2] 에이전트 연동 API 클라이언트 (Completed: 2026-07-22)
- [x] REST API 클라이언트 모듈 (`src/lib/api.ts`) 구현 (타임아웃 5초 설정, Bearer Token 헤더 자동 첨부, 에러 노출)
- [x] 에이전트 헬스체크 (`checkAgentHealth`) 및 10초 주기 자동 감시 기능

### [Phase 3] 통합 대시보드 & 리스트 테이블 UI (Completed: 2026-07-22)
- [x] 상단 네비게이션 및 에이전트 선택기, 상태 배지 (`src/components/Navbar.tsx`)
- [x] 통합 대시보드 요약 카드 UI (Agents Online, Running Containers, Stopped Containers, Total Images)
- [x] 컨테이너 목록 테이블 UI (`src/components/ContainerTable.tsx`) (Running: Green, Stopped: Red 상태 배지, 포트 매핑)

### [Phase 4] 컨테이너 제어 인터페이스 (Completed: 2026-07-22)
- [x] 컨테이너 개별 제어 버튼 (Start, Stop, Restart, Remove) UI 및 백엔드 API 연동
- [x] 실행 상태 변경 시 자동 대시보드 데이터 리로드

### [Phase 5] 실시간 로그 스트리밍 WebSocket 모달 (Completed: 2026-07-22)
- [x] Terminal 스타일 실시간 로그 모달 (`src/components/LogViewerModal.tsx`)
- [x] WebSocket 연결 기반 스트리밍 수신, Pause/Resume 자동 스크롤 제어, 로그 초기화

### [Phase 6] 이미지 관리 UI (Completed: 2026-07-22)
- [x] 로컬 Docker 이미지 목록 테이블 (`src/components/ImageTable.tsx`) (Image ID, Repository/Tag, 용량, 생성일)
- [x] 미사용 Dangling 이미지 일괄 삭제 (Prune) 기능 및 용량 회분 안내 토스트/알림

### [Phase 7] 사용자 인증 및 멀티 에이전트 관리 (Completed: 2026-07-22)
- [x] 사용자 로그인 모달 (`src/components/LoginModal.tsx`) 및 JWT 토큰 관리
- [x] 새로운 에이전트 노드 추가/등록 모달 (`src/components/AgentModal.tsx`)

### [Phase 8] watch_list.txt 동적 연동 & 브라우저 캐시 전면 제거 (Completed: 2026-07-28)
- [x] 비밀 토큰(`AGENT_SECRET_TOKEN`) 유연화 및 토큰 설정 개선
- [x] 브라우저 `localStorage` 에이전트 목록 캐싱 제거 (하드코딩 IP 삭제 및 캐시 오염 방지)
- [x] 실시간 `watch_list.txt` 파싱 백엔드 API (`GET /api/agents`) 작성 (`Cache-Control: no-store` 적용)
- [x] Agent Nodes 탭 UI 개선 (개별 에이전트 노드 삭제 버튼 `Trash2` 및 Empty State 안내 컴포넌트 추가)
- [x] `docker-compose.yml` 볼륨 마운트 (`./watch_list.txt:/app/watch_list.txt`) 구성하여 컨테이너 재빌드 없이 서버 주소 목록 동적 갱신 지원
- [x] **[기능 개선] 웹 UI 기반 `watch_list.txt` 실시간 영구 동기화**: `POST /api/agents` 및 `DELETE /api/agents` 라우트 구현하여 웹페이지에서 노드 추가/삭제 시 실제로 `watch_list.txt` 파일에 즉시 반영 및 저장되도록 구현
- [x] **[기능 추가] Docker Compose 파일 출처 표시 UI**: ContainerTable UI에 각 컨테이너가 어떤 `docker-compose.yml` 파일 및 프로젝트/서비스로부터 실행되었는지 표출하는 컬럼 및 보라색 배지 UI 구현
- [x] **[기능 추가] Docker Network / Bridge 표시 UI**: ContainerTable UI에 각 컨테이너가 바인딩된 도커 브릿지/네트워크 이름, 컨테이너 할당 IP 주소, 게이트웨이 및 MAC 주소를 표출하는 시안(Cyan) 배지 UI 구현
- [x] **[디자인 & 레이아웃 최적화] 와이드스크린 반응형 풀 파노라마 레이아웃**: 1280px(`max-w-7xl`) 폭 제약을 제거하고 모니터 가로 해상도를 자동 인식하는 `max-w-[1920px]` 레이아웃 적용. 테이블 셀의 자르기 제약을 풀어 수평 스크롤 없이 가로 공간을 시원하게 활용하도록 개선
- [x] **[버그 수정]** `pingAgents` / `loadAgentData` 의존성 배열에 의한 초고속 무한 무한 재렌더링 루프 및 타임아웃 경고창 팝업 무한 연속 생성 문제 완전 해결

### [Phase 9] 환경변수 기반 인증 & 대시보드 잠금 게이트 (Completed: 2026-07-28)
- [x] Docker Compose 환경변수(`ADMIN_USER`, `ADMIN_PASSWORD`)를 통한 사용자 아이디/패스워드 동적 설정 지원
- [x] 인증 백엔드 API 라우트 (`POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`) 및 암호화 세션 쿠키 구성
- [x] 미인증 사용자의 대시보드 접근을 완벽 차단하는 풀스크린(Full-Screen) 로그인 게이트 UI 구현
- [x] 상단 Navbar 사용자 정보 표시(`User: admin`) 및 세션 해제(Logout) 기능 연동

### [Phase 10] 사이드바 네비게이션 & 전체 머신 통합 클러스터 뷰 (Completed: 2026-07-28)
- [x] **[신규 컴포넌트] 좌측 사이드바 (`Sidebar.tsx`)**: 등록된 전체 머신 목록, 실시간 상태(온라인/오프라인 뱃지), 빠른 1-클릭 전환 및 노드 추가 버튼 제공
- [x] **[신규 뷰 모드] All Nodes Cluster 통합 뷰**: `selectedAgentId === 'all'` 모드 구현하여 전체 등록 머신들의 컨테이너 현황을 병렬 수집 및 하나의 대시보드 테이블로 통합 표출
- [x] **[UI 개선] Node / Machine 컬럼 추가**: 통합 뷰 모드 시 각 컨테이너가 어느 에이전트 머신(`192.168.0.32`, `33`, `34` 등)에서 돌아가는지 파란색 뱃지로 명확히 표출
- [x] 통합 뷰 모드에서도 개별 컨테이너 동작(시작/중지/재시작/삭제) 및 터미널 로그 스트리밍을 해당 머신 에이전트와 정확히 자동 매칭하도록 처리

### [Phase 11] Host 백엔드 프록시(Proxy) 구현 (Completed: 2026-07-29)
- [x] **[아키텍처 개선] Host 백엔드 프록시 API 라우트 (`POST /api/proxy`) 구현**: 웹 브라우저의 direct fetch 구조를 제거하고 Host 백엔드가 Hyper-V 내부망 게스트 에이전트들과 통신하도록 중계 처리
- [x] **[CORS & 네트워크 통신 보완]**: 접속 주소(내부 사설 IP `192.168.0.32:3000` 또는 외부 DDNS `chcv2.iptime.org:33000` / 모바일 LTE/5G)와 관계없이 Host 서버가 내부망 가상머신과 통신하여 모든 에이전트 통신이 100% 정상 작동하도록 개편
- [x] **[API 라우트 정제]**: `agents/route.ts`에서 불필요한 Host IP 강제 변환 로직을 제거하여 `watch_list.txt` 원본 사설 IP 그대로 백엔드 중계에 사용

### [Phase 12] All Nodes Cluster 통합 뷰 내 도커 볼륨 조회 지원 (Completed: 2026-08-11)
- [x] **[신규 컴포넌트] VolumeTable (`VolumeTable.tsx`)**: 볼륨 검색, 연결된 컨테이너, 호스트 마운트 지점, 에이전트 노드 표시 및 오동작 방지 볼륨 삭제 팝업을 포함하는 독립 재사용 컴포넌트 구현
- [x] **[탭 통합 및 순서 변경]**: All Nodes Cluster 및 개별 노드 대시보드 탭 순서를 **컨테이너, 이미지, 볼륨, 에이전트 노드** (`containers` -> `images` -> `volumes` -> `agents`) 순서로 변경 및 배치
- [x] **[통합 데이터 페칭]**: `loadAgentData()`에서 전체 또는 개별 에이전트 노드의 볼륨 데이터를 병렬(`fetchVolumes`) 수집하고 대시보드 상단 요약 카드에 **Total Volumes** 카드를 추가하여 클러스터 전체 볼륨 현황을 실시간 관제하도록 구현

### [Phase 13] 연관 볼륨 선택 동시 삭제 & Dynamic APP_TITLE & 작업 이력 추적 (Completed: 2026-08-11)
- [x] **[컨테이너 바인딩 볼륨 연동 삭제]**: `ContainerTable.tsx`에서 컨테이너 Mounts 메타데이터를 파싱하여 `ConfirmModal.tsx`에 전달, 팝업 창 내 연관 볼륨 선택 체크박스 UI 제공 및 `DELETE /api/containers/:id?v=true&force=true` 연동
- [x] **[동적 앱 타이틀 지원]**: `Host/src/app/api/config/route.ts` 구현하여 환경변수 `APP_TITLE` (기본값: `FakePortainer`) 값을 대시보드 상단 Navbar 및 브라우저 세션에 동적으로 표출하도록 구현
- [x] **[작업 이력 모니터링 고도화]**: `/history` 페이지에서 헬스체크 현황 및 컨테이너/이미지/볼륨/노드 변경 작업 이력을 실시간 모니터링하도록 보완, `history_log.bin` AES-256 바이너리 데이터 암호화 호환성 확보


