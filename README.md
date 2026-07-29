프로젝트 저장소 위치 : https://github.com/Laser-Cho/FakePortainer.git

# 🐳 FakePortainer (Docker Container Management Dashboard)

Portainer와 유사한 경량 웹 기반 멀티 서버 Docker 컨테이너 관제 및 제어 GUI 애플리케이션입니다.

---

## 🚀 주요 기능
1. **사이드바 네비게이션 & 멀티 머신 뷰:**
   - 좌측 사이드바(`Sidebar.tsx`)를 통해 등록된 모든 에이전트 머신의 실시간 헬스 상태(온라인/오프라인) 확인 및 1-클릭 머신 전환 지원
2. **전체 머신 통합 관제 (`All Nodes Cluster Overview`):**
   - 클러스터 내 모든 에이전트 머신의 컨테이너 정보를 병렬(`Promise.all`)로 수집하여 전체 컨테이너 현황을 한눈에 조회 및 제어
3. **상세 컨테이너 정보 표출:**
   - **Docker Compose File 출처**: 어떤 `docker-compose.yml` 파일 및 프로젝트/서비스로부터 띄워졌는지 표출 (보라색 배지)
   - **Docker Network / Bridge**: 연결된 도커 브릿지 네트워크명 및 컨테이너 내부 IP 주소, 게이트웨이, MAC 주소 표출 (시안색 배지)
   - **Node / Machine**: 통합 뷰 모드 시 해당 컨테이너가 동작 중인 노드 머신명 표출 (파란색 배지)
4. **컨테이너 & 이미지 제어:**
   - 컨테이너 시작, 중지, 재시작, 삭제 제어 액션
   - 로컬 Docker 이미지 목록 조회 및 미사용(Dangling) 이미지 일괄 Prune 삭제
5. **실시간 터미널 로그 스트리밍:**
   - WebSocket 기반으로 특정 컨테이너의 터미널 로그를 실시간으로 중계하는 터미널 스타일 모달
6. **환경변수 기반 보안 인증:**
   - Docker Compose 환경변수(`ADMIN_USER`, `ADMIN_PASSWORD`) 기반 로그인 검증
   - 미인증 시 대시보드 전체 접근을 강제 차단하는 풀스크린 로그인 게이트 UI
7. **동적 `watch_list.txt` 동기화 & 백엔드 프록시 (Proxy) 중계:**
   - 웹 UI에서 에이전트 노드 추가/삭제 시 `watch_list.txt` 파일에 실시간 영구 반영
   - 외부 DDNS(`chcv2.iptime.org`) 및 모바일 5G망 접속 시에도 Host 백엔드 프록시(`POST /api/proxy`)가 내부망 사설 IP 통신을 대행하여 무조건 정상 작동 지원

---

## 🛠 기술 스택
- **Backend (Agent):** Node.js (Express) + `dockerode` + WebSocket (`ws`)
- **Frontend (Host Control Plane):** Next.js (React) + TypeScript + Tailwind CSS + Lucide React
- **통신:** REST API (상태 조회 및 제어용, Host Proxy 중계), WebSocket (실시간 로그 스트리밍용)

---

## 📋 단계별 개발 마일스톤 (All Completed)
- [x] **[Phase 1] 초기 셋업**: 프론트엔드(`Host/`)와 백엔드(`Agent/`) 디렉터리 구조 셋업 및 Dockerfile 구성
- [x] **[Phase 2] 백엔드 코어**: Docker Socket 연동 및 전체 컨테이너 목록 반환 API 개발
- [x] **[Phase 3] 프론트엔드 UI**: Next.js 기반 다크 테마 대시보드 및 컨테이너 목록 테이블 구현
- [x] **[Phase 4] 제어 액션**: 컨테이너 Start / Stop / Restart / Remove 제어 API 및 UI 연동
- [x] **[Phase 5] 실시간 로그**: WebSocket 기반 실시간 컨테이너 터미널 로그 모달 구현
- [x] **[Phase 6] 이미지 관리**: 로컬 Docker 이미지 조회 및 Dangling 이미지 Prune 기능 구현
- [x] **[Phase 7] 멀티 에이전트 관리**: 여러 서버(Node) 등록 및 헬스 체크 감시 구현
- [x] **[Phase 8] watch_list.txt 동적 연동 & 도커 정보 확장**: `watch_list.txt` 영구 동기화, Docker Compose 파일 출처 및 Docker Network/Bridge IP 정보 표시, 와이드스크린 반응형 UI 적용
- [x] **[Phase 9] 환경변수 기반 인증 게이트**: `ADMIN_USER`, `ADMIN_PASSWORD` 환경변수 연동 및 대시보드 강제 잠금 로그인 화면 구현
- [x] **[Phase 10] 사이드바 & 클러스터 통합 뷰**: 좌측 네비게이션 사이드바 및 전체 머신 통합 관제 뷰 (`All Nodes Cluster`) 구현
- [x] **[Phase 11] Host 백엔드 프록시 (Proxy) 중계 개편**: 외부 DDNS 및 모바일 망 접속 환경에서도 100% 에이전트 통신이 성공하도록 Host 백엔드 중계 방식 적용
