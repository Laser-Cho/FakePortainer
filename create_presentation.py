import sys
import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

def build_dockwatch_ppt():
    prs = Presentation()
    prs.slide_width = Inches(13.333)
    prs.slide_height = Inches(7.5)
    
    # Blank slide layout
    blank_layout = prs.slide_layouts[6]
    
    # Color Palette Definitions
    COLOR_BG_DARK = RGBColor(15, 23, 42)      # #0F172A Deep Slate
    COLOR_BG_LIGHT = RGBColor(248, 250, 252)  # #F8FAFC Slate Light
    COLOR_CARD_BG = RGBColor(255, 255, 255)   # White
    COLOR_CARD_BORDER = RGBColor(226, 232, 240)# #E2E8F0
    
    COLOR_PRIMARY = RGBColor(30, 58, 138)    # #1E3A8A Deep Blue
    COLOR_ACCENT = RGBColor(59, 130, 246)    # #3B82F6 Electric Blue
    COLOR_CYAN = RGBColor(6, 182, 212)       # #06B6D4 Cyan
    COLOR_GREEN = RGBColor(16, 185, 129)     # #10B981 Emerald
    COLOR_RED = RGBColor(239, 68, 68)        # #EF4444 Red
    COLOR_AMBER = RGBColor(245, 158, 11)     # #F59E0B Amber
    
    COLOR_TEXT_MAIN = RGBColor(15, 23, 42)   # #0F172A Dark Slate
    COLOR_TEXT_MUTED = RGBColor(71, 85, 105)  # #475569 Slate Muted
    COLOR_TEXT_LIGHT = RGBColor(248, 250, 252)# #F8FAFC Light Text
    
    FONT_FAMILY = "Malgun Gothic"  # Standard Korean Windows Font
    
    # Helper: Set slide background color
    def set_slide_bg(slide, color):
        background = slide.background
        fill = background.fill
        fill.solid()
        fill.fore_color.rgb = color
        
    # Helper: Add Standard Header
    def add_header(slide, title_text, category_text="DOCKWATCH™ PROJECT OVERVIEW"):
        # Header background banner line
        shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(0.5), Inches(11.733), Inches(0.04))
        shape.fill.solid()
        shape.fill.fore_color.rgb = COLOR_ACCENT
        shape.line.fill.background()
        
        # Category label
        tb_cat = slide.shapes.add_textbox(Inches(0.8), Inches(0.6), Inches(11.733), Inches(0.3))
        p_cat = tb_cat.text_frame.paragraphs[0]
        p_cat.text = category_text.upper()
        p_cat.font.name = FONT_FAMILY
        p_cat.font.size = Pt(10)
        p_cat.font.bold = True
        p_cat.font.color.rgb = COLOR_ACCENT
        
        # Main Title
        tb_title = slide.shapes.add_textbox(Inches(0.8), Inches(0.85), Inches(11.733), Inches(0.6))
        p_title = tb_title.text_frame.paragraphs[0]
        p_title.text = title_text
        p_title.font.name = FONT_FAMILY
        p_title.font.size = Pt(22)
        p_title.font.bold = True
        p_title.font.color.rgb = COLOR_TEXT_MAIN

    # Helper: Create Card Container
    def add_card(slide, left, top, width, height, bg_color=COLOR_CARD_BG, border_color=COLOR_CARD_BORDER):
        shape = slide.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(left), Inches(top), Inches(width), Inches(height))
        shape.fill.solid()
        shape.fill.fore_color.rgb = bg_color
        if border_color:
            shape.line.color.rgb = border_color
            shape.line.width = Pt(1.5)
        else:
            shape.line.fill.background()
        return shape

    # -------------------------------------------------------------
    # SLIDE 1: Title Slide (Dark Theme)
    # -------------------------------------------------------------
    slide1 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide1, COLOR_BG_DARK)
    
    # Decorative Card / Badge
    badge_shape = slide1.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.0), Inches(1.5), Inches(3.2), Inches(0.4))
    badge_shape.fill.solid()
    badge_shape.fill.fore_color.rgb = RGBColor(30, 58, 138)
    badge_shape.line.fill.background()
    p_badge = badge_shape.text_frame.paragraphs[0]
    p_badge.text = "🔒 Airgap Ready & Zero-Telemetry"
    p_badge.font.name = FONT_FAMILY
    p_badge.font.size = Pt(11)
    p_badge.font.bold = True
    p_badge.font.color.rgb = COLOR_CYAN
    p_badge.alignment = PP_ALIGN.CENTER
    
    # Main Title
    tb_t1 = slide1.shapes.add_textbox(Inches(1.0), Inches(2.2), Inches(11.333), Inches(1.2))
    p_t1 = tb_t1.text_frame.paragraphs[0]
    p_t1.text = "DockWatch™"
    p_t1.font.name = FONT_FAMILY
    p_t1.font.size = Pt(44)
    p_t1.font.bold = True
    p_t1.font.color.rgb = COLOR_TEXT_LIGHT
    
    p_sub1 = tb_t1.text_frame.add_paragraph()
    p_sub1.text = "초경량 웹 기반 분산 Docker 관제 & 3단 보안 통합 제어 솔루션"
    p_sub1.font.name = FONT_FAMILY
    p_sub1.font.size = Pt(22)
    p_sub1.font.color.rgb = COLOR_ACCENT
    p_sub1.space_before = Pt(10)
    
    # Description Card
    add_card(slide1, 1.0, 3.8, 11.333, 1.6, bg_color=RGBColor(30, 41, 59), border_color=RGBColor(51, 65, 85))
    tb_desc = slide1.shapes.add_textbox(Inches(1.2), Inches(3.95), Inches(10.9), Inches(1.3))
    tf_desc = tb_desc.text_frame
    tf_desc.word_wrap = True
    
    p_d1 = tf_desc.paragraphs[0]
    p_d1.text = "📌 프로젝트 핵심 요약"
    p_d1.font.name = FONT_FAMILY
    p_d1.font.size = Pt(14)
    p_d1.font.bold = True
    p_d1.font.color.rgb = COLOR_CYAN
    
    p_d2 = tf_desc.add_paragraph()
    p_d2.text = "• 고비용 상용 관제 솔루션(Portainer) 대체 및 외부 데이터 무단 전송(Telemetry) 100% 차단\n• SW 공학 'AI 클린룸 프로세스' 및 Gemini 3.6 Flash (Effort High & Medium) 기반 1주일 간 구축 완료\n• 3단 다계층 보안(진입/통신/저장) 및 Fail-Safe 오삭제 방지 시스템을 탑재한 엔터프라이즈 플랫폼"
    p_d2.font.name = FONT_FAMILY
    p_d2.font.size = Pt(12)
    p_d2.font.color.rgb = RGBColor(203, 213, 225)
    p_d2.space_before = Pt(8)
    
    # Footer Info
    tb_foot = slide1.shapes.add_textbox(Inches(1.0), Inches(6.0), Inches(11.333), Inches(0.8))
    p_f = tb_foot.text_frame.paragraphs[0]
    p_f.text = "AI Idea League 제출 프로젝트 | 개발 및 기획: lasercho | 사용 모델: Gemini 3.6 Flash (via agy)"
    p_f.font.name = FONT_FAMILY
    p_f.font.size = Pt(11)
    p_f.font.color.rgb = COLOR_TEXT_MUTED

    # -------------------------------------------------------------
    # SLIDE 2: Background & Problem Definition (Why)
    # -------------------------------------------------------------
    slide2 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide2, COLOR_BG_LIGHT)
    add_header(slide2, "1. 배경 및 문제 정의 (Why)", "PROBLEM DEFINITION")
    
    # Top Banner Box
    add_card(slide2, 0.8, 1.5, 11.733, 0.9, bg_color=RGBColor(238, 242, 255), border_color=RGBColor(199, 210, 254))
    tb_b2 = slide2.shapes.add_textbox(Inches(1.0), Inches(1.6), Inches(11.333), Inches(0.7))
    p_b2 = tb_b2.text_frame.paragraphs[0]
    p_b2.text = "🏢 운영 환경 현황: 10여 대 이상의 서버가 보안이 엄중한 Airgap(폐쇄망) 환경에서 수많은 Docker 컨테이너 운용 중"
    p_b2.font.name = FONT_FAMILY
    p_b2.font.size = Pt(13)
    p_b2.font.bold = True
    p_b2.font.color.rgb = COLOR_PRIMARY
    
    # 4 Pain Points Cards Grid (2x2)
    cards_data_s2 = [
        ("💸 과도한 라이선스 비용", "Portainer 등 상용 관제 솔루션의 고가 멀티 노드 라이선스 비용 및 유지보수 비용 부담이 매우 높음", COLOR_RED),
        ("📡 Telemetry 보안 리스크", "상용 및 무료 오픈소스 솔루션 특유의 외부 무단 데이터 전송 가능성으로 엄중한 폐쇄망 보안 정책 위반 위험", COLOR_AMBER),
        ("⚠️ CLI 수기 조작 오삭제 위험", "개별 서버 SSH 접속 후 수기 CLI 명령(docker rm, volume rm) 실행 시 운영 컨테이너 및 데이터 유실 사고 상존", COLOR_RED),
        ("⏳ 과중한 관리 공수 점검", "매일 10여 대 분산 서버에 일일이 접속하여 docker ps, docker logs 수기 점검 (매일 60분 이상 소요)", COLOR_AMBER)
    ]
    
    coords = [
        (0.8, 2.6, 5.7, 2.0),
        (6.833, 2.6, 5.7, 2.0),
        (0.8, 4.8, 5.7, 2.0),
        (6.833, 4.8, 5.7, 2.0)
    ]
    
    for (title, text, color), (x, y, w, h) in zip(cards_data_s2, coords):
        add_card(slide2, x, y, w, h)
        
        # Color bar on top of card
        bar = slide2.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(0.08))
        bar.fill.solid()
        bar.fill.fore_color.rgb = color
        bar.line.fill.background()
        
        tb = slide2.shapes.add_textbox(Inches(x + 0.2), Inches(y + 0.2), Inches(w - 0.4), Inches(h - 0.3))
        tf = tb.text_frame
        tf.word_wrap = True
        
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.name = FONT_FAMILY
        pt.font.size = Pt(14)
        pt.font.bold = True
        pt.font.color.rgb = COLOR_TEXT_MAIN
        
        pt2 = tf.add_paragraph()
        pt2.text = text
        pt2.font.name = FONT_FAMILY
        pt2.font.size = Pt(12)
        pt2.font.color.rgb = COLOR_TEXT_MUTED
        pt2.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 3: Solution Overview (What & Key Pillars)
    # -------------------------------------------------------------
    slide3 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide3, COLOR_BG_LIGHT)
    add_header(slide3, "2. 솔루션 개요: DockWatch™ (What)", "SOLUTION OVERVIEW")
    
    # 3 Pillar Cards (Vertical Columns)
    pillars = [
        ("🌐 100% Zero-Telemetry & Airgap", 
         "• 외부 인터넷 접속 0% 차단 폐쇄망 완전 지원\n• 서드파티 외부 추적/통계 전송 로직 배제\n• 독립 구동 2-Tier Architecture",
         COLOR_ACCENT, 0.8),
        ("🛡️ 3-Tier Enterprise 보안", 
         "• 1단: ADMIN ID/PW 풀스크린 로그인 게이트\n• 2단: AGENT_SECRET_TOKEN 중계 프록시\n• 3단: AES-256-CBC 바이너리 암호화 저장",
         COLOR_PRIMARY, 4.8),
        ("⚡ Fail-Safe 오삭제 방지", 
         "• 볼륨 자동 파싱 & 연동 선택 삭제\n• 컨테이너 Full Name 타이핑 입력 강제\n• 중지/재시작 2중 확인 팝업 모달 제공",
         COLOR_GREEN, 8.8)
    ]
    
    for title, desc, color, left_pos in pillars:
        add_card(slide3, left_pos, 1.6, 3.733, 5.2)
        
        # Header banner inside card
        card_hdr = slide3.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(left_pos), Inches(1.6), Inches(3.733), Inches(0.8))
        card_hdr.fill.solid()
        card_hdr.fill.fore_color.rgb = color
        card_hdr.line.fill.background()
        
        p_ch = card_hdr.text_frame.paragraphs[0]
        p_ch.text = title
        p_ch.font.name = FONT_FAMILY
        p_ch.font.size = Pt(14)
        p_ch.font.bold = True
        p_ch.font.color.rgb = COLOR_TEXT_LIGHT
        p_ch.alignment = PP_ALIGN.CENTER
        
        tb = slide3.shapes.add_textbox(Inches(left_pos + 0.2), Inches(2.6), Inches(3.333), Inches(4.0))
        tf = tb.text_frame
        tf.word_wrap = True
        
        for line in desc.split('\n'):
            p = tf.add_paragraph()
            p.text = line
            p.font.name = FONT_FAMILY
            p.font.size = Pt(13)
            p.font.color.rgb = COLOR_TEXT_MAIN
            p.space_before = Pt(12)

    # -------------------------------------------------------------
    # SLIDE 4: Business Impact & KPI (Value Proposition)
    # -------------------------------------------------------------
    slide4 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide4, COLOR_BG_LIGHT)
    add_header(slide4, "3. 핵심 가치: Business Impact (Value Proposition)", "BIZ IMPACT & METRICS")
    
    # 4 Big KPI Box Cards Grid
    kpi_items = [
        ("💰 비용 절감 (License Cost)", "0 원", "Portainer 고가 멀티노드 라이선스 및 유지보수 비용 100% 대체", COLOR_ACCENT, 0.8, 1.6),
        ("⏱️ 관제 공수 단축", "90% ↓", "매일 60분(SSH 10대 수기 점검) ➔ 매일 5분 (1클릭 통합 대시보드)", COLOR_GREEN, 6.833, 1.6),
        ("🛡️ 오삭제 리스크", "0 %", "Full Name 검증 & 2중 확인 팝업 모달로 실수 삭제 사고 원천 차단", COLOR_PRIMARY, 0.8, 4.4),
        ("🚀 개발 소요 기간", "1 주일", "AI pair programming(agy + Gemini 3.6 Flash)으로 6개월 분량 1주 완결", COLOR_CYAN, 6.833, 4.4)
    ]
    
    for label, big_val, desc, color, x, y in kpi_items:
        w, h = 5.7, 2.5
        add_card(slide4, x, y, w, h)
        
        # Left color strip
        strip = slide4.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(0.15), Inches(h))
        strip.fill.solid()
        strip.fill.fore_color.rgb = color
        strip.line.fill.background()
        
        # Textbox for Label & Big Value
        tb = slide4.shapes.add_textbox(Inches(x + 0.4), Inches(y + 0.25), Inches(w - 0.6), Inches(h - 0.4))
        tf = tb.text_frame
        tf.word_wrap = True
        
        p1 = tf.paragraphs[0]
        p1.text = label
        p1.font.name = FONT_FAMILY
        p1.font.size = Pt(14)
        p1.font.bold = True
        p1.font.color.rgb = COLOR_TEXT_MUTED
        
        p2 = tf.add_paragraph()
        p2.text = big_val
        p2.font.name = FONT_FAMILY
        p2.font.size = Pt(36)
        p2.font.bold = True
        p2.font.color.rgb = color
        p2.space_before = Pt(4)
        
        p3 = tf.add_paragraph()
        p3.text = desc
        p3.font.name = FONT_FAMILY
        p3.font.size = Pt(12)
        p3.font.color.rgb = COLOR_TEXT_MAIN
        p3.space_before = Pt(8)

    # -------------------------------------------------------------
    # SLIDE 5: Architecture & Tech Stack (How)
    # -------------------------------------------------------------
    slide5 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide5, COLOR_BG_LIGHT)
    add_header(slide5, "4. 시스템 아키텍처 및 시스템 사양 (How)", "SYSTEM ARCHITECTURE")
    
    # Left Column: Architecture Box Diagram
    add_card(slide5, 0.8, 1.6, 6.2, 5.2)
    tb_a = slide5.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.8), Inches(4.8))
    tf_a = tb_a.text_frame
    tf_a.word_wrap = True
    
    p_at = tf_a.paragraphs[0]
    p_at.text = "🏗️ 2-Tier 분산 구조 (Control Plane & Agents)"
    p_at.font.name = FONT_FAMILY
    p_at.font.size = Pt(15)
    p_at.font.bold = True
    p_at.font.color.rgb = COLOR_PRIMARY
    
    # Diagram Boxes inside left column
    # Box 1: Browser
    b1 = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(2.3), Inches(5.4), Inches(0.7))
    b1.fill.solid(); b1.fill.fore_color.rgb = RGBColor(241, 245, 249); b1.line.color.rgb = COLOR_ACCENT
    p = b1.text_frame.paragraphs[0]; p.text = "💻 User Browser Dashboard (Dark UI / Responsive)"; p.font.name = FONT_FAMILY; p.font.size = Pt(11); p.font.bold = True; p.alignment = PP_ALIGN.CENTER; p.font.color.rgb = COLOR_TEXT_MAIN
    
    # Arrow down 1
    a1 = slide5.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(3.7), Inches(3.05), Inches(0.4), Inches(0.35))
    a1.fill.solid(); a1.fill.fore_color.rgb = COLOR_ACCENT; a1.line.fill.background()
    
    # Box 2: Host Control Plane
    b2 = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(3.45), Inches(5.4), Inches(1.1))
    b2.fill.solid(); b2.fill.fore_color.rgb = RGBColor(30, 58, 138); b2.line.fill.background()
    tf_b2 = b2.text_frame; tf_b2.word_wrap = True
    p = tf_b2.paragraphs[0]; p.text = "🖥️ DockWatch Host Control Plane (Port 3000)"; p.font.name = FONT_FAMILY; p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = COLOR_TEXT_LIGHT; p.alignment = PP_ALIGN.CENTER
    p2 = tf_b2.add_paragraph(); p2.text = "• Next.js Proxy Relay (POST /api/proxy)\n• AES-256 Storage Engine (.bin files)"; p2.font.name = FONT_FAMILY; p2.font.size = Pt(10); p2.font.color.rgb = COLOR_CYAN; p2.alignment = PP_ALIGN.CENTER
    
    # Arrow down 2
    a2 = slide5.shapes.add_shape(MSO_SHAPE.DOWN_ARROW, Inches(3.7), Inches(4.6), Inches(0.4), Inches(0.35))
    a2.fill.solid(); a2.fill.fore_color.rgb = COLOR_ACCENT; a2.line.fill.background()
    
    # Box 3: Agent Nodes
    b3 = slide5.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(1.2), Inches(5.0), Inches(5.4), Inches(1.1))
    b3.fill.solid(); b3.fill.fore_color.rgb = RGBColor(15, 23, 42); b3.line.fill.background()
    tf_b3 = b3.text_frame; tf_b3.word_wrap = True
    p = tf_b3.paragraphs[0]; p.text = "⚡ DockWatch Agent Nodes (Port 9000)"; p.font.name = FONT_FAMILY; p.font.size = Pt(12); p.font.bold = True; p.font.color.rgb = COLOR_TEXT_LIGHT; p.alignment = PP_ALIGN.CENTER
    p2 = tf_b3.add_paragraph(); p2.text = "• Express + WebSocket Live Streaming Engine\n• Direct Unix Socket Bind (/var/run/docker.sock)"; p2.font.name = FONT_FAMILY; p2.font.size = Pt(10); p2.font.color.rgb = COLOR_GREEN; p2.alignment = PP_ALIGN.CENTER

    # Right Column: Resource Specs & Requirements Card
    add_card(slide5, 7.3, 1.6, 5.233, 5.2)
    tb_r = slide5.shapes.add_textbox(Inches(7.5), Inches(1.8), Inches(4.8), Inches(4.8))
    tf_r = tb_r.text_frame
    tf_r.word_wrap = True
    
    p_rt = tf_r.paragraphs[0]
    p_rt.text = "⚙️ 시스템 권장 사양 및 런타임"
    p_rt.font.name = FONT_FAMILY
    p_rt.font.size = Pt(15)
    p_rt.font.bold = True
    p_rt.font.color.rgb = COLOR_PRIMARY
    
    specs = [
        ("🐧 지원 OS", "Linux (Ubuntu 20.04+, RHEL 8+) 및 Windows 10/11 (WSL2 / Hyper-V)"),
        ("💻 Host 리소스", "1 Core CPU / 512MB RAM 이상 (초경량)"),
        ("⚡ Agent 리소스", "0.2 Core CPU / 64MB RAM 이상 (극초경량 구동)"),
        ("🐳 런타임 필수", "Docker Engine 20.10+ 및 Docker Compose v2.0+"),
        ("🌐 포트 구성", "Host: 3000 (HTTP/TCP)\nAgent: 9000 (HTTP, WS/TCP)")
    ]
    
    for stitle, sdesc in specs:
        p_st = tf_r.add_paragraph()
        p_st.text = f"{stitle}: {sdesc}"
        p_st.font.name = FONT_FAMILY
        p_st.font.size = Pt(12)
        p_st.font.color.rgb = COLOR_TEXT_MAIN
        p_st.space_before = Pt(10)

    # -------------------------------------------------------------
    # SLIDE 6: 3-Tier Security Architecture
    # -------------------------------------------------------------
    slide6 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide6, COLOR_BG_LIGHT)
    add_header(slide6, "5. 엔터프라이즈급 3단 다계층 보안 체계 (Security)", "SECURITY ARCHITECTURE")
    
    # 3 Horizontal Layers of Security
    sec_layers = [
        ("1단: 진입 통제 보안 (Admin Authentication Gate)",
         "• 환경변수(ADMIN_USER, ADMIN_PASSWORD) 기반 풀스크린 인증 게이트\n• 로그인에 성공하지 않으면 관리 대시보드 UI 및 모든 내부 API 접근 원천 차단",
         COLOR_PRIMARY, 1.6),
        ("2단: 제어 통신 보안 (Proxy Token Relay)",
         "• Host 백엔드가 사설망 HTTP Proxy 중계 통신 수행 (브라우저 직접 노출 X)\n• AGENT_SECRET_TOKEN Bearer 검증으로 인가되지 않은 도커 소켓 무단 접근 방어",
         COLOR_ACCENT, 3.4),
        ("3단: 저장소 바이너리 암호화 (AES-256-CBC Encryption)",
         "• 관제 대상 노드 목록(watch_list.bin) 및 작업 감사 히스토리(history_log.bin) 암호화\n• HOST 서버 물리 탈취 및 파일 유출 시에도 IP/토큰/변경이력 평문 노출 0%",
         COLOR_GREEN, 5.2)
    ]
    
    for title, desc, color, top_pos in sec_layers:
        add_card(slide6, 0.8, top_pos, 11.733, 1.5)
        
        # Color side badge
        badge = slide6.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(0.8), Inches(top_pos), Inches(0.2), Inches(1.5))
        badge.fill.solid(); badge.fill.fore_color.rgb = color; badge.line.fill.background()
        
        tb = slide6.shapes.add_textbox(Inches(1.2), Inches(top_pos + 0.15), Inches(11.1), Inches(1.2))
        tf = tb.text_frame
        tf.word_wrap = True
        
        pt = tf.paragraphs[0]
        pt.text = title
        pt.font.name = FONT_FAMILY
        pt.font.size = Pt(14)
        pt.font.bold = True
        pt.font.color.rgb = color
        
        for line in desc.split('\n'):
            p = tf.add_paragraph()
            p.text = line
            p.font.name = FONT_FAMILY
            p.font.size = Pt(12)
            p.font.color.rgb = COLOR_TEXT_MAIN
            p.space_before = Pt(4)

    # -------------------------------------------------------------
    # SLIDE 7: Core Features & Operation Guide
    # -------------------------------------------------------------
    slide7 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide7, COLOR_BG_LIGHT)
    add_header(slide7, "6. 주요 기능 및 운영 가이드 (Features)", "CORE FEATURES")
    
    # 4 Cards Grid for Features
    features_data = [
        ("🌐 클러스터 통합 뷰 (All Nodes)", 
         "• 분산된 전체 서버의 컨테이너를 병렬 수집하여 단일 대시보드 표출\n• Docker Compose 풀경로, 브릿지 IP, 호스트 노드 식별 배지 제공", 
         COLOR_PRIMARY, 0.8, 1.6),
        ("📜 WebSocket 실시간 로그 스트리밍", 
         "• stdout / stderr 로그 다크 터미널 뷰어 기반 실시간 파이프라인 스트리밍\n• Auto-Scroll 및 Clear 기능으로 실시간 장애 분석 극대화", 
         COLOR_ACCENT, 6.833, 1.6),
        ("🧹 이미지 & 볼륨 정리 (Prune)", 
         "• 태그 없는 찌꺼기 Dangling 이미지 1클릭 일괄 Prune 정리\n• 미사용 연결 끊긴 도커 볼륨 선별 정리로 디스크 용량 자동 확보", 
         COLOR_CYAN, 0.8, 4.4),
        ("📝 작업 감사 이력 추적 (Audit Log)", 
         "• 누가, 언제, 어느 노드에서 수행했는지 타임스탬프 감사 로그 저장\n• history_log.bin 암호화 저장으로 이력 무단 임의 조작 불가능", 
         COLOR_GREEN, 6.833, 4.4)
    ]
    
    for title, desc, color, x, y in features_data:
        add_card(slide7, x, y, 5.7, 2.5)
        
        # Header strip inside card
        strip = slide7.shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(x), Inches(y), Inches(5.7), Inches(0.45))
        strip.fill.solid(); strip.fill.fore_color.rgb = color; strip.line.fill.background()
        
        p_st = strip.text_frame.paragraphs[0]
        p_st.text = title
        p_st.font.name = FONT_FAMILY
        p_st.font.size = Pt(12)
        p_st.font.bold = True
        p_st.font.color.rgb = COLOR_TEXT_LIGHT
        p_st.alignment = PP_ALIGN.LEFT
        
        tb = slide7.shapes.add_textbox(Inches(x + 0.2), Inches(y + 0.55), Inches(5.3), Inches(1.8))
        tf = tb.text_frame
        tf.word_wrap = True
        
        for line in desc.split('\n'):
            p = tf.add_paragraph()
            p.text = line
            p.font.name = FONT_FAMILY
            p.font.size = Pt(12)
            p.font.color.rgb = COLOR_TEXT_MAIN
            p.space_before = Pt(6)

    # -------------------------------------------------------------
    # SLIDE 8: Fail-Safe Safety System Deep Dive
    # -------------------------------------------------------------
    slide8 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide8, COLOR_BG_LIGHT)
    add_header(slide8, "7. 차별화 기능: Fail-Safe 오삭제 방지 시스템", "FAIL-SAFE SAFETY SYSTEM")
    
    # Large Banner Card
    add_card(slide8, 0.8, 1.6, 11.733, 5.2)
    
    tb_fs = slide8.shapes.add_textbox(Inches(1.1), Inches(1.8), Inches(11.1), Inches(4.8))
    tf_fs = tb_fs.text_frame
    tf_fs.word_wrap = True
    
    p_fst = tf_fs.paragraphs[0]
    p_fst.text = "🛡️ 휴먼 에러로 인한 운영 컨테이너 & 볼륨 데이터 유실 사고 0% 지향"
    p_fst.font.name = FONT_FAMILY
    p_fst.font.size = Pt(16)
    p_fst.font.bold = True
    p_fst.font.color.rgb = COLOR_RED
    
    steps = [
        ("1. 2중 안전 삭제 팝업 모달 제공", "컨테이너 삭제 버튼 클릭 시 단방향 즉시 삭제를 금지하고, 팝업 모달창을 표출하여 작업자의 주의 환기"),
        ("2. 연관 도커 볼륨 연동 선택 삭제 (자동 파싱)", "컨테이너에 마운트된 볼륨 목록을 백엔드가 자동 파싱하여 표시. 함께 제거할 볼륨을 체크박스로 안전하게 선택"),
        ("3. Full Name 타이핑 타이틀 매칭 검증 강제", "대상 컨테이너의 전체 이름(Full Name)을 정확히 일치하게 타이핑해야만 [삭제 확인] 버튼이 활성화됨 (실수 클릭 100% 방지)"),
        ("4. 중지 / 재시작 2중 확인 모달", "중요 서비스 컨테이너 중단 시 우발적 터치 방지를 위한 재확인 절차 제공")
    ]
    
    for stitle, sdesc in steps:
        p_t = tf_fs.add_paragraph()
        p_t.text = f"• {stitle}"
        p_t.font.name = FONT_FAMILY
        p_t.font.size = Pt(13)
        p_t.font.bold = True
        p_t.font.color.rgb = COLOR_PRIMARY
        p_t.space_before = Pt(12)
        
        p_d = tf_fs.add_paragraph()
        p_d.text = f"   {sdesc}"
        p_d.font.name = FONT_FAMILY
        p_d.font.size = Pt(12)
        p_d.font.color.rgb = COLOR_TEXT_MUTED
        p_d.space_before = Pt(4)

    # -------------------------------------------------------------
    # SLIDE 9: Innovation - AI Clean Room Development Process
    # -------------------------------------------------------------
    slide9 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide9, COLOR_BG_LIGHT)
    add_header(slide9, "8. 혁신성: AI 클린룸 개발 프로세스 & 추론 단계 최적화", "AI CLEAN ROOM METHODOLOGY")
    
    # 2 Big Cards: Left Clean Room Concept, Right Dual Effort Strategy
    # Left Card
    add_card(slide9, 0.8, 1.6, 5.7, 5.2)
    tb_cl = slide9.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_cl = tb_cl.text_frame
    tf_cl.word_wrap = True
    
    p_clt = tf_cl.paragraphs[0]
    p_clt.text = "🏛️ SW 공학 'AI 클린룸 기법' 적용"
    p_clt.font.name = FONT_FAMILY
    p_clt.font.size = Pt(15)
    p_clt.font.bold = True
    p_clt.font.color.rgb = COLOR_PRIMARY
    
    cl_text = [
        "• 더티 룸 (Dirty Room - 분석 및 명세화):",
        "  - 상용 Portainer 및 GPU 관제 구축 경험을 바탕으로 소스코드 없이 기능 명세서(README, Host.md, Agent.md) 작성",
        "• 클린 룸 (Clean Room - 독립적 코딩):",
        "  - 작성된 기능 명세서만 agy(Antigravity CLI) 도구에 전달하여 밑바닥부터 코드를 생성, 저작권 침해 리스크 원천 차단",
        "• 맥락 동기화 구조:",
        "  - Host와 Agent의 독립 빌드 시 개성 불일치 문제 예방을 위해 README.md 마일스톤 기반 통합 제어"
    ]
    for line in cl_text:
        p = tf_cl.add_paragraph()
        p.text = line
        p.font.name = FONT_FAMILY
        p.font.size = Pt(11)
        p.font.color.rgb = COLOR_TEXT_MAIN
        p.space_before = Pt(8)
        if line.startswith("•"):
            p.font.bold = True
            p.font.color.rgb = COLOR_ACCENT

    # Right Card: Dual Effort Tuning Strategy
    add_card(slide9, 6.833, 1.6, 5.7, 5.2)
    tb_eff = slide9.shapes.add_textbox(Inches(7.033), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_eff = tb_eff.text_frame
    tf_eff.word_wrap = True
    
    p_eft = tf_eff.paragraphs[0]
    p_eft.text = "🧠 Gemini 3.6 Flash 추론 강도 단계별 최적화"
    p_eft.font.name = FONT_FAMILY
    p_eft.font.size = Pt(15)
    p_eft.font.bold = True
    p_eft.font.color.rgb = COLOR_GREEN
    
    eff_text = [
        "• Phase 1: 기획 & 구조 검증 (Effort: High)",
        "  - 가장 강력한 사고력(Deepest reasoning) 설정으로 명세서의 구조적 모순과 누락 요소를 정밀 평가 및 고도화",
        "• Phase 2: 구현 & 코딩 (Effort: Medium)",
        "  - 빠른 반응속도 및 토큰 사용량 제약 회피를 위해 Effort를 Medium으로 조정",
        "  - 사람이 직접 컨테이너 빌드/테스트를 수행하는 'Human-in-the-Loop' 실전 개발 프로세스 정립"
    ]
    for line in eff_text:
        p = tf_eff.add_paragraph()
        p.text = line
        p.font.name = FONT_FAMILY
        p.font.size = Pt(11)
        p.font.color.rgb = COLOR_TEXT_MAIN
        p.space_before = Pt(8)
        if line.startswith("•"):
            p.font.bold = True
            p.font.color.rgb = COLOR_PRIMARY

    # -------------------------------------------------------------
    # SLIDE 10: Installation & Scalability
    # -------------------------------------------------------------
    slide10 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide10, COLOR_BG_LIGHT)
    add_header(slide10, "9. 배포 가이드 및 확장 가능성 (Deployment & Scalability)", "DEPLOYMENT & SCALABILITY")
    
    # Left Card: Docker Hub & Compose
    add_card(slide10, 0.8, 1.6, 5.7, 5.2)
    tb_dep = slide10.shapes.add_textbox(Inches(1.0), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_dep = tb_dep.text_frame
    tf_dep.word_wrap = True
    
    p_dt = tf_dep.paragraphs[0]
    p_dt.text = "🐳 Docker Hub 이미지 배포 & 원클릭 구동"
    p_dt.font.name = FONT_FAMILY
    p_dt.font.size = Pt(15)
    p_dt.font.bold = True
    p_dt.font.color.rgb = COLOR_PRIMARY
    
    dep_lines = [
        "• Official Docker Hub Repositories:",
        "  - Host: lasercho/dockwatch-host:latest",
        "  - Agent: lasercho/dockwatch-agent:latest",
        "• docker-compose.yml 통한 즉시 실행 지원",
        "• Agent 도커 소켓 마운트 핵심 설정:",
        "  -v /var/run/docker.sock:/var/run/docker.sock"
    ]
    for line in dep_lines:
        p = tf_dep.add_paragraph()
        p.text = line
        p.font.name = FONT_FAMILY
        p.font.size = Pt(12)
        p.font.color.rgb = COLOR_TEXT_MAIN
        p.space_before = Pt(8)
        if line.startswith("•"):
            p.font.bold = True

    # Right Card: Branding & Portability
    add_card(slide10, 6.833, 1.6, 5.7, 5.2)
    tb_sca = slide10.shapes.add_textbox(Inches(7.033), Inches(1.8), Inches(5.3), Inches(4.8))
    tf_sca = tb_sca.text_frame
    tf_sca.word_wrap = True
    
    p_st2 = tf_sca.paragraphs[0]
    p_st2.text = "🎨 동적 브랜딩 커스터마이징 & 범용성"
    p_st2.font.name = FONT_FAMILY
    p_st2.font.size = Pt(15)
    p_st2.font.bold = True
    p_st2.font.color.rgb = COLOR_CYAN
    
    sca_lines = [
        "• 솔루션 표기 이름 동적 변경 (APP_TITLE):",
        "  - Host docker-compose.yml의 APP_TITLE 환경변수 변경으로 개별 현장 브랜드명(예: SK_AI_Platform_Monitor) 이질감 없이 즉시 이식 가능",
        "• 사설망 통신 유연성:",
        "  - Host 백엔드 Proxy 중계 라우트(POST /api/proxy) 지원으로 외부망/DDNS/모바일망 접속 시에도 100% 정상 구동",
        "• 데이터 영구 백업:",
        "  - ./data 디렉터리 바이너리 압축 백업만으로 완벽 이전 가능"
    ]
    for line in sca_lines:
        p = tf_sca.add_paragraph()
        p.text = line
        p.font.name = FONT_FAMILY
        p.font.size = Pt(12)
        p.font.color.rgb = COLOR_TEXT_MAIN
        p.space_before = Pt(8)
        if line.startswith("•"):
            p.font.bold = True

    # -------------------------------------------------------------
    # SLIDE 11: Summary & Conclusion (Dark Theme)
    # -------------------------------------------------------------
    slide11 = prs.slides.add_slide(blank_layout)
    set_slide_bg(slide11, COLOR_BG_DARK)
    
    # Title
    tb_c = slide11.shapes.add_textbox(Inches(1.0), Inches(1.2), Inches(11.333), Inches(1.0))
    p_ct = tb_c.text_frame.paragraphs[0]
    p_ct.text = "DockWatch™ 핵심 요약 및 결언"
    p_ct.font.name = FONT_FAMILY
    p_ct.font.size = Pt(32)
    p_ct.font.bold = True
    p_ct.font.color.rgb = COLOR_TEXT_LIGHT
    
    # Summary Card Box
    add_card(slide11, 1.0, 2.3, 11.333, 4.3, bg_color=RGBColor(30, 41, 59), border_color=RGBColor(51, 65, 85))
    tb_sum = slide11.shapes.add_textbox(Inches(1.3), Inches(2.5), Inches(10.733), Inches(3.9))
    tf_sum = tb_sum.text_frame
    tf_sum.word_wrap = True
    
    sum_bullets = [
        "✅ 1. 비용 절감 및 100% Telemetry 차단: 고가 상용 솔루션을 대체하며 엄중한 Airgap 환경에 완벽 대응",
        "✅ 2. 3단 보안 & Fail-Safe 오삭제 방지: 진입-통신-저장 3중 보안 및 컨테이너 Full Name 입력 매칭으로 데이터 보호",
        "✅ 3. AI 클린룸 SW 공학 검증: Gemini 3.6 Flash 모델 추론 강도(High/Medium) 조절을 통해 1주일 만에 고품질 구축 완료",
        "✅ 4. 즉시 현장 이식 가능: Docker Hub 이미지 제공 및 APP_TITLE 동적 브랜딩 지원"
    ]
    for bullet in sum_bullets:
        p = tf_sum.add_paragraph()
        p.text = bullet
        p.font.name = FONT_FAMILY
        p.font.size = Pt(14)
        p.font.bold = True
        p.font.color.rgb = COLOR_CYAN
        p.space_before = Pt(14)
        
    p_end = tf_sum.add_paragraph()
    p_end.text = "🎉 경청해 주셔서 감사합니다. 질문이 있으시면 편하게 말씀해 주세요!"
    p_end.font.name = FONT_FAMILY
    p_end.font.size = Pt(16)
    p_end.font.bold = True
    p_end.font.color.rgb = COLOR_GREEN
    p_end.space_before = Pt(24)
    p_end.alignment = PP_ALIGN.CENTER
    
    # Save Presentation
    output_filename = r"D:\FakePortainer\AI_Idea_league\DockWatch_프로젝트_소개.pptx"
    prs.save(output_filename)
    print(f"Presentation saved successfully to: {output_filename}")

if __name__ == "__main__":
    build_dockwatch_ppt()
