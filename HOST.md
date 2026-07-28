# HOST.md - 중앙 제어 호스트 (Control Plane) 가이드

이 문서는 여러 대상 서버에 배포된 Docker 에이전트들을 통합 모니터링하고 제어하는 **중앙 제어 호스트(Control Plane) 머신**의 구축 방법과 설계 조건을 정의합니다.

---

## 1. 역할 및 목표
- **통합 제어 타워:** 개별 서버(에이전트)들의 Docker 상태 및 전체 클러스터 상태를 한눈에 파악할 수 있는 다크 모드 기반의 풀 파노라마 대시보드 UI를 제공합니다.
- **사용자 인증 및 보안 관리:** 미인증 사용자의 접근을 차단하기 위한 환경변수 기반 풀스크린 로그인 화면 및 세션 쿠키 관리 기능을 제공합니다.
- **프록시 및 데이터 취합:** 사용자의 요청을 알맞은 에이전트 API로 중계하고, 여러 에이전트로부터 수신된 데이터를 병렬 처리하여 표출합니다.

---

## 2. 핵심 기능 요구사항
1. **사이드바 네비게이션 & 멀티 머신 뷰 (`Sidebar.tsx`):**
   - 등록된 모든 에이전트 서버의 헬스 체크 및 연결 상태 표시 (온라인/오프라인 뱃지)
   - 1-클릭 머신 전환 기능 및 노드 추가 모달 연결
2. **전체 머신 통합 관제 (`All Nodes Cluster Overview`):**
   - 모든 에이전트 노드의 데이터를 병렬(`Promise.all`) 수집하여 클러스터 전체의 컨테이너 현황을 하나의 대시보드에 통합 표출
   - 각 컨테이너가 속한 머신 이름(`192.168.0.32`, `33`, `34` 등)을 파란색 배지로 표출하는 `Node / Machine` 컬럼 제공
3. **상세 컨테이너 정보 표출:**
   - **Docker Compose File 출처**: 컨테이너가 실행된 `docker-compose.yml` 파일명, 프로젝트명, 서비스명 표출 (보라색 배지)
   - **Docker Network / Bridge**: 연결된 도커 브릿지 네트워크명 및 컨테이너 내부 IP 주소, 게이트웨이, MAC 주소 표출 (시안색 배지)
4. **동적 `watch_list.txt` 관리:**
   - 웹 UI에서 노드 추가/삭제 시 `POST /api/agents` 및 `DELETE /api/agents`를 통해 서버의 `watch_list.txt` 파일에 실시간 영구 동기화 (브라우저 `localStorage` 캐시 전면 제거)
5. **실시간 터미널 로그 뷰어:**
   - WebSocket 클라이언트를 활용하여 에이전트로부터 전달되는 컨테이너의 실시간 터미널 로그 출력 모달 구현
6. **보안 및 환경변수 로그인 인증:**
   - Docker Compose 환경변수(`ADMIN_USER`, `ADMIN_PASSWORD`) 기반 관리자 로그인 인증
   - 미인증 시 컨트롤 플레인 대시보드 전체 접근 강제 차단 (풀스크린 로그인 화면 게이트)
   - 인증 완료 시 세션 쿠키 발급 및 상단 Navbar 계정 정보(`User: admin`) / Logout 제어 지원
7. **와이드스크린 반응형 풀 파노라마 UI:**
   - 모니터 가로 해상도를 자동 인식하는 `max-w-[1920px]` 레이아웃 적용으로 수평 스크롤 없이 넓은 공간 활용

---

## 3. 기술 스택 및 구조
- **Frontend:** Next.js (React) + TypeScript + Tailwind CSS + Lucide React (깔끔하고 세련된 다크 모드 기본 테마)
- **Backend (Host Controller):** Next.js App Router API Routes (`/api/agents`, `/api/auth/login`, `/api/auth/me`, `/api/auth/logout`)
- **데이터 저장:** `watch_list.txt` (서버 주소 목록 마운트 연동) 및 세션 쿠키
- **통신 클라이언트:** 
  - REST API Client (`fetch`): 에이전트 제어 및 상태 수집용
  - WebSocket Client: 실시간 로그 스트리밍 중계 수신용

---

## 4. 구축 프로세스 (Phase별 완성 내역)

- [x] **[Phase 1] UI 및 프로젝트 셋업**: Next.js App Router 초기화, Tailwind CSS 다크 테마 및 Dockerfile 구성
- [x] **[Phase 2] 에이전트 연동 API 클라이언트**: `src/lib/api.ts` 공통 통신 클라이언트 및 10초 주기 자동 헬스체크 구현
- [x] **[Phase 3] 대시보드 테이블 UI**: `ContainerTable.tsx`, `ImageTable.tsx`, `Navbar.tsx` 구현
- [x] **[Phase 4] 컨테이너 제어 인터페이스**: Start, Stop, Restart, Remove 제어 액션 구현
- [x] **[Phase 5] 실시간 로그 WebSocket 모달**: `LogViewerModal.tsx` 터미널 스타일 로그 스트리밍 구현
- [x] **[Phase 6] 이미지 관리 UI**: 로컬 이미지 목록 및 Dangling 이미지 Prune 구현
- [x] **[Phase 7] 사용자 인증 및 멀티 에이전트 관리**: Agent 등록 모달 및 토큰 관리 구현
- [x] **[Phase 8] watch_list.txt 동적 연동 & 도커 정보 확장**: `watch_list.txt` 영구 동기화, Docker Compose 출처 및 Docker Network/Bridge IP 표출, 와이드스크린 레이아웃 구현
- [x] **[Phase 9] 환경변수 인증 게이트**: `ADMIN_USER`, `ADMIN_PASSWORD` 환경변수 로그인 및 강제 대시보드 잠금 구현
- [x] **[Phase 10] 사이드바 & 클러스터 통합 뷰**: 좌측 네비게이션 `Sidebar.tsx` 및 `All Nodes Cluster` 통합 관제 뷰 구현

---

## 5. 보안 및 필수 운영 조건
- **통신 암호화 및 토큰 보호:**
  - 호스트와 에이전트 간 통신 시 보안 토큰(`Authorization: Bearer <TOKEN>`)을 사용하며, SSL/TLS 보안 프로토콜 사용을 권장합니다.
- **명확한 에러 핸들링:**
  - 에이전트 서버가 응답하지 않을 경우 5초 타임아웃 처리 및 사용자 경고 배너/토스트 메시지를 노출합니다.
