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
