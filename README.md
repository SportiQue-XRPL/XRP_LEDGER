# XRPL 기반 건강데이터 관리 시스템

## 프로젝트 개요

XRPL(XRP Ledger)을 활용한 블록체인 기반 건강데이터 정보 소유-대여-판매 시스템입니다.

## 포함된 파일들

### 📋 문서
- `final_report.md` - 종합 분석 보고서 (50페이지)
- `xrpl_research_findings.md` - XRPL 기술 분석 결과
- `todo.md` - 프로젝트 진행 상황
- `README.md` - 이 파일

### 🏗️ 시스템 아키텍처
- `system_architecture.png` - 시스템 아키텍처 다이어그램
- `system_architecture.mmd` - Mermaid 다이어그램 소스
- `system_architecture.puml` - PlantUML 다이어그램 소스

### 💻 백엔드 (Flask)
- `health-data-backend/src/main.py` - Flask 메인 애플리케이션
- `health-data-backend/src/models/health_data.py` - 건강데이터 모델
- `health-data-backend/src/services/xrpl_service.py` - XRPL 연동 서비스
- `health-data-backend/src/routes/health_data.py` - API 라우트
- `health-data-backend/requirements.txt` - Python 의존성

### 🌐 프론트엔드 (React)
- `health-data-frontend/src/App.jsx` - React 메인 컴포넌트
- `health-data-frontend/package.json` - Node.js 의존성
- `health-data-frontend/index.html` - HTML 템플릿

## 설치 및 실행

### 백엔드 설정
```bash
cd health-data-backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python src/main.py
```

### 프론트엔드 설정
```bash
cd health-data-frontend
npm install  # 또는 pnpm install
npm run dev  # 또는 pnpm run dev
```

## 주요 기능

✅ **XRPL 지갑 생성 및 관리**
✅ **건강데이터 NFT 토큰화**
✅ **데이터 소유권 관리**
✅ **데이터 거래 시스템 (판매/대여)**
✅ **접근 권한 관리**
✅ **데이터 품질 평가**

## 기술 스택

- **블록체인**: XRPL (XRP Ledger)
- **백엔드**: Python Flask, XRPL-py
- **프론트엔드**: React.js, Tailwind CSS
- **데이터베이스**: SQLite (프로토타입용)

## 주요 결과

- ✅ 기술적 실현 가능성 확인
- 💰 경제적 타당성 입증 (5년 내 연매출 2억 달러 전망)
- 🔒 보안 및 개인정보보호 보장
- 🌍 사회적 가치 창출

## 라이선스

MIT License

## 문의

프로젝트 관련 문의사항은 이슈를 통해 남겨주세요.

