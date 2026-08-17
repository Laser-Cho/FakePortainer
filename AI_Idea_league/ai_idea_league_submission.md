# 🏆 2026 SK AI 해커톤 - AI Idea 리그 제출 신청서

---

## 📌 [기본 입력 정보]

- **사례명 (제목):** `AI Pair Programming 기반 경량 멀티 서버 Docker 관제 & 통합 제어 시스템 (FakePortainer) 구축`
- **활용 Tool 구분:** `① 일반` (Antigravity AI Agent / Claude 3.6 Flash & Pro)
- **사례 개요 (한 줄 요약):** 분산된 가상머신/서버의 Docker 환경을 외부망·모바일망 제약 없이 통합 관제하고, 컨테이너 및 연관 볼륨 오삭제 리스크를 0%로 차단하는 초경량 Control Plane 구축 사례

---

## 📄 [본문 내용]

### 1. 배경 및 문제 정의 (Why)

#### 🏢 업무 맥락 및 문제 상황
조직 내에서 개발·검증·운영을 위해 수십 대의 가상머신(Hyper-V/VMware) 및 타겟 서버에 분산된 Docker 컨테이너를 운용하고 있습니다. 그러나 각 서버의 Docker 상태를 파악하고 제어하는 과정에서 다음과 같은 치명적인 한계와 실무적 Pain Point가 존재했습니다.

1. **기존 관제 도구의 과도한 리소스 소모 및 중량화:**
   - 기존의 대형 관제 솔루션(Portainer 등)은 단일 서버 관제에는 유용하나, 멀티 서버 통합 관제 시 높은 메모리/CPU 리소스를 소모하고 설치 과정이 복잡하여 경량 개발/검증 환경에는 부담이 컸습니다.
2. **외부망 / 모바일 5G망 접속 시 네트워크 통신 차단 (CORS & 사설 IP 한계):**
   - 개발자가 재택근무, 외근, 이동 중 모바일 5G망이나 외부 DDNS(`chcv2.iptime.org`)를 통해 사내 대시보드에 접속할 때, 브라우저가 내부 사설 IP(`192.168.0.x:9000`)에 직접 접근(direct fetch)하려고 시도하면서 **Cross-Origin/CORS 및 사설 IP 라우팅 실패(Network Error)**가 지속 발생했습니다.
3. **수기 CLI 명령 조작 시 데이터·볼륨 오삭제 리스크:**
   - 터미널 CLI에서 `docker rm` 또는 `docker volume rm` 명령을 직접 수행하다가 실수로 운영 중인 컨테이너나 중요 마운트 볼륨을 오삭제하여 데이터가 손실되는 위험이 늘 존재했습니다.
4. **분산 서버 모니터링 공수 과다:**
   - 각 서버마다 일일이 SSH로 접속하여 `docker ps`, `docker logs`를 수기 확인해야 하므로 전체 시스템 헬스 체크와 장애 대응에 매일 1~2시간 이상 불필요한 시간이 소모되었습니다.

---

### 2. 구현 방법 및 활용 Tool (How / What)

#### 🤖 AI Tool 활용 방식 (Antigravity AI Agent & LLM Pair Programming)
Google DeepMind의 **Antigravity AI Agent**와 **Claude 3.6 Flash & Pro** 모델을 페어 프로그래밍 파트너로 도입하여, 시스템 요구사항 정의부터 아키텍처 설계, Full-Stack 구현, 보안 검증, 문서화까지 단 며칠 만에 고품질로 완수했습니다.
- **AI Agent 역할:** 요구사항 해석, 프론트엔드/백엔드 코드 자동 생성 및 리팩토링, Next.js API Routes Proxy 중계 구조 설계, AES-256 바이너리 데이터 암호화 구현, 비동기 빌드 테스트 검증.
- **사람(개발자)의 역할:** 도커 소켓 통신 보안 정책 수립, 실무 유저 시나리오 검증, UI/UX 최종 승인 및 샌드박스 안전장치 요구 조건 제시.

#### 🏗️ 구현된 시스템 핵심 아키텍처 & 기능

```
[클라이언트 브라우저 (외부 DDNS / 모바일 5G망)]
       │
       ▼ (1. HTTPS / Auth Login)
[Control Plane Host (Next.js 백엔드 - Port 3000)]
       ├─ 백엔드 프록시 중계 라우트 (POST /api/proxy)
       ├─ 암호화 마운트 데이터 저장소 (watch_list.bin, history_log.bin - AES-256)
       └─ Dynamic APP_TITLE & 작업 이력 감사 로그 (/history)
       │
       ▼ (2. 내부 사설망 Direct HTTP Proxy 중계)
[Target Agent Server (Node.js Express - Port 9000)]
       ├─ REST API (/api/containers, /api/images, /api/volumes)
       ├─ WebSocket 실시간 터미널 로그 스트리밍 (/api/containers/:id/logs)
       └─ Docker API Socket (/var/run/docker.sock)
```

1. **Host 백엔드 프록시 (Proxy) 중계 아키텍처 (`POST /api/proxy`):**
   - 브라우저가 에이전트에 직접 통신하지 않고, Host 백엔드가 중계 통신을 대행함으로써 접속 환경(외부 DDNS, 모바일 5G, 포트포워딩)과 관계없이 **100% 무장애 통신**을 실현했습니다.
2. **All Nodes Cluster 통합 관제 & 독립 VolumeTable:**
   - 전체 에이전트 머신의 컨테이너, 이미지, 도커 볼륨 정보를 병렬(`Promise.all`) 수집하여 하나의 대시보드에서 조회·제어할 수 있는 풀 파노라마 다크 모드 UI(`max-w-[1920px]`)를 구축했습니다.
3. **컨테이너 연관 볼륨 연동 선택 삭제 안전 팝업 (`ConfirmModal.tsx`):**
   - 컨테이너 삭제 시 바인딩된 Mounts 정보를 자동 파싱하여 바인딩 볼륨 목록을 체크박스로 제시하고, 컨테이너 **풀 네임을 직접 입력해야만** 삭제 버튼이 활성화되는 2중 안전 장치를 구현했습니다. (`DELETE /api/containers/:id?v=true&force=true`)
4. **3중 보안 검증 & 바이너리 암호화 데이터 저장:**
   - `ADMIN_USER` 기반 풀스크린 로그인 게이트 + `AGENT_SECRET_TOKEN` 토큰 검증 + `watch_list.bin`/`history_log.bin` **AES-256-CBC 바이너리 암호화 저장**을 적용하여 외부 침입 및 데이터 유출을 원천 차단했습니다.

---

### 3. 핵심 가치 (Value Proposition)

#### 3-1. Biz. Impact (정량적 성과)
- ⏱️ **서버 관제 및 장애 대응 시간 90% 이상 절감:**
  - 기존: 서버별 SSH 접속 및 수기 상태/로그 확인 (매일 약 90분 소요)
  - 개선: All Nodes Cluster 통합 대시보드로 1-클릭 실시간 관제 및 WebSocket 로그 감시 (매일 5분 이내 완수)
- 🛡️ **수기 조작에 의한 오삭제 및 데이터 손실 리스크 0% 달성:**
  - 컨테이너 및 연관 볼륨 삭제 시 풀 네임 매칭 검증 팝업 도입으로 오작동 사고 원천 차단.
- 📡 **외부망 / 모바일 접속 가용성 100% 확보:**
  - Host 백엔드 프록시 중계로 장소/네트워크 제약 없이 모바일 5G망에서도 100% 관제 및 긴급 제어 성공.
- ⚡ **개발 공수 단축 (AI 페어 프로그래밍 성과):**
  - AI Agent 활용을 통해 기존 수 주가 소요될 Full-Stack 개발 작업을 단 3일 만에 완료.

#### 3-2. 확장 가능성 (Scalability & Applicability)
- 🐳 **Docker Compose 기반 원클릭 즉시 배포:**
  - `docker-compose.yml` 단 한 줄 명령(`docker compose up -d`)만으로 타겟 서버에 에이전트 배포 및 호스트 컨트롤 플레인 구동 가능.
- 🏢 **타 조직 / 멤버사 적용 편의성:**
  - 독립된 `Agent`와 `Host` 구조로 구성되어 있어, SK 계열사 내 가상머신, AWS EC2, 온프레미스 서버 등 어떤 인프라 환경에도 변경 없이 즉시 이식 가능.
- 🏷️ **동적 브랜딩 서포트 (`APP_TITLE`):**
  - 환경변수(`APP_TITLE`) 설정을 통해 각 부서나 조직에 맞춘 맞춤형 관제 대시보드 타이틀 동적 연동 지원.

#### 3-3. 혁신성 (Innovation & Differentiation)
- **Host 백엔드 Proxy 중계 레이어 설계:** 기존 대시보드들이 해결하지 못한 외부망 CORS 및 사설 IP 통신 실패 문제를 프록시 중계 패턴으로 완벽 해결.
- **안전한 도커 볼륨 연동 삭제 파싱:** 단순 컨테이너 찌꺼기 삭제가 아닌, 바인딩된 마운트 메타데이터 파싱으로 연관 볼륨을 선택 삭제할 수 있는 고도화된 UI/UX 제공.
- **AI Agent 중심의 개발 혁신 (AX 문화 구현):** 요구사항부터 코드 작성, 테스팅, 보안 암호화, API 문서화까지 AI와 사람이 긴밀히 협력하는 차세대 개발 공정을 성공적으로 시범 제시함.
