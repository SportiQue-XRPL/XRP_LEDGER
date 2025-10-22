# SportiQue - XRPL Blockchain Healthcare Data Marketplace

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL](https://img.shields.io/badge/XRPL-Mainnet-brightgreen)](https://xrpl.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**건강 데이터를 NFT로 토큰화하고, Escrow로 안전하게 거래하는 XRPL 기반 데이터 마켓플레이스**

SportiQue는 XRP Ledger의 NFTokens, Escrow, MPT(Multi-Purpose Tokens)를 활용하여 개인 건강 데이터의 소유권을 사용자에게 돌려주고, 투명하고 안전한 데이터 거래를 가능하게 합니다.

## 📄 Documentation

- **[Technical Design Document (PDF)](./SportiQue_XRPL_Technical_Design.pdf)** - 완전한 시스템 아키텍처 및 XRPL 통합 상세 설명
- **[API Documentation](./API_DOCUMENTATION.md)** - REST API 엔드포인트 레퍼런스
- **[XRPL Implementation Links](./XRPL_IMPLEMENTATION_LINKS.md)** - XRPL 기능별 코드 위치
- **[Submission Guide](./SUBMISSION_GUIDE.md)** - 해커톤 제출 가이드

## 🎯 Key XRPL Features

### ✅ NFTokens - Data Access Control
모든 건강 데이터 접근 권한을 NFT로 관리합니다. NFT 소유자만 암호화된 데이터를 복호화할 수 있습니다.

```typescript
// core/nft.ts
const nftId = await mintNFT(wallet, {
  uri: 'https://sportique.io/data/user_123',
  transferFee: 0,
  flags: 8 // tfTransferable
});
```

### ✅ Escrow - Trustless Trading
기업의 데이터 구매 자금을 Escrow에 잠가 플랫폼 신뢰 없이도 안전한 거래가 가능합니다.

```typescript
// core/escrow.ts
await createEscrow(enterpriseWallet, userWallet, '500', {
  finishAfter: Date.now() + 7 * 24 * 60 * 60, // 7 days
  condition: nftTransferCondition
});
```

### ✅ MPT (Multi-Purpose Tokens) - Reward System
사용자 활동 리워드를 MPT로 배치 처리하여 99.9% 트랜잭션 비용 절감

```typescript
// core/mpt.ts
await createMPToken(platformWallet, {
  maxAmount: '1000000000', // 1B points
  assetScale: 2
});
```

## 📁 폴더 구조

```
XRP_LEDGER/
├── SportiQue_XRPL_Technical_Design.pdf  # 📄 기술 설계 문서
├── core/                                # XRPL 기본 기능 모듈
│   ├── nft.ts                           # NFToken operations
│   ├── escrow.ts                        # Escrow operations
│   ├── mpt.ts                           # Multi-Purpose Tokens
│   ├── payment.ts                       # XRP payments
│   └── wallet.ts                        # Wallet management
├── platform/                            # 플랫폼 비즈니스 로직
│   ├── enterprise/                      # 기업 기능
│   ├── user/                            # 사용자 기능
│   └── xrpl/                            # XRPL 통합 레이어
└── transactions/                        # 트랜잭션 처리 모듈
    ├── NFTAccessControl.ts              # NFT 기반 접근 제어
    ├── SubscriptionEscrow.ts            # 구독 결제 Escrow
    └── DataReward.ts                    # MPT 리워드 분배
```

## 🎯 core/ - XRPL 기본 기능 모듈

XRP Ledger와의 직접적인 상호작용을 담당하는 핵심 모듈들입니다.

| 파일 | 기능 |
|------|------|
| `config.ts` | XRPL 네트워크 설정 및 환경 변수 관리 |
| `wallet.ts` | XRPL 지갑 생성 및 관리 |
| `payment.ts` | XRP 및 토큰 결제 처리 |
| `nft.ts` | NFT 발행 및 거래 |
| `escrow.ts` | 에스크로 계약 관리 |
| `dataPool.ts` | 데이터 풀 관련 기능 |
| `firebase.ts` | Firebase 연동 모듈 |
| `types.ts` | 공통 타입 정의 |
| `utils.ts` | 유틸리티 함수 |
| `index.ts` | 모듈 진입점 |

## 💼 platform/ - 플랫폼 비즈니스 로직

SportiQue 플랫폼의 핵심 비즈니스 로직을 구현한 모듈들입니다.

### platform/enterprise/
- `EnterpriseAuth.ts` - 기업 인증 및 권한 관리
- `DataPoolManager.ts` - 기업용 데이터 풀 관리
- `SubscriptionManager.ts` - 구독 서비스 관리

### platform/user/
- `UserAuth.ts` - 사용자 인증 및 권한 관리
- `HealthDataManager.ts` - 건강 데이터 관리

### platform/platform/
- `DataPoolManager.ts` - 플랫폼 레벨 데이터 풀 관리
- `RewardCalculator.ts` - 리워드 계산 로직
- `SystemConfig.ts` - 시스템 설정 관리

### platform/xrpl/
- `XrplWallet.ts` - XRPL 지갑 통합 관리
- `XrplEscrow.ts` - XRPL 에스크로 통합
- `NftGenerator.ts` - NFT 생성 및 메타데이터 관리

### platform/data/
- `QualityEvaluator.ts` - 데이터 품질 평가 엔진

### platform/types/
- `index.ts` - 타입 정의 진입점
- `user.ts` - 사용자 관련 타입
- `health.ts` - 건강 데이터 타입
- `enterprise.ts` - 기업 관련 타입

## 🔄 transactions/ - 트랜잭션 처리 모듈

XRPL 트랜잭션을 처리하고 관리하는 고급 모듈들입니다.

| 파일 | 기능 |
|------|------|
| `index.ts` | 트랜잭션 모듈 진입점 |
| `SubscriptionNFT.ts` | 구독 NFT 발행 및 관리 |
| `SubscriptionEscrow.ts` | 구독 에스크로 계약 |
| `PoolNFT.ts` | 데이터 풀 NFT 관리 |
| `NFTAccessControl.ts` | NFT 기반 접근 제어 |
| `DataPoolParticipation.ts` | 데이터 풀 참여 관리 |
| `DataReward.ts` | 데이터 제공 리워드 처리 |

### transactions/scripts/
- `runDemo.ts` - 데모 실행 스크립트
- `seedFirestore.ts` - Firestore 초기 데이터 설정

## 🚀 주요 기능

### 1. NFT 기반 구독 시스템
- 구독 NFT 발행으로 서비스 접근 권한 관리
- 에스크로를 통한 안전한 결제 처리
<p align="center">
  <img src="https://github.com/user-attachments/assets/e4915f28-a7e1-437e-a7f0-fc6a4cc5ac67" height="450" alt="img3" />
  &nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/ffbdbf16-49e9-495f-b100-15d1fdc24173" height="450" alt="img4" />
</p>

### 2. 데이터 풀 관리
- 기업과 사용자 간 건강 데이터 거래
- NFT 기반 데이터 소유권 증명
- 왼쪽은 기업과 연구 기관 등에서 사용하는 인터페이스
- 오른쪽은 개인이 사용하는 인터페이스
<p align="center">
  <img src="https://github.com/user-attachments/assets/f5cc1ac9-04a0-4d98-aea4-b5cb5d4e60cf" height="420" alt="img1" />
  &nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/99e2a0b5-fdd0-451b-ae96-87a05fb07aea" height="420" alt="img2" />
</p>

### 3. 리워드 시스템
- 데이터 제공자에게 자동 리워드 분배
- 품질 평가 기반 차등 보상

### 4. 보안 및 프라이버시
- 익명화된 건강 데이터 처리
- NFT 기반 접근 제어

## 📝 사용 예시

```typescript
// 지갑 생성
import { createWallet } from './core/wallet';
const wallet = await createWallet();

// NFT 발행
import { mintNFT } from './core/nft';
await mintNFT(wallet, metadata);

// 구독 생성
import { SubscriptionNFT } from './transactions/SubscriptionNFT';
const subscription = new SubscriptionNFT();
await subscription.createSubscription(enterpriseWallet, userAddress, amount);
```

## 🔧 설정

각 모듈은 환경 변수를 통해 설정됩니다:
- `XRPL_NETWORK`: 네트워크 선택 (testnet/mainnet)
- `FIREBASE_CONFIG`: Firebase 프로젝트 설정
- `NFT_TAXON`: NFT 분류 코드

## 📚 Technology Stack

### Core Dependencies
- **XRPL**: `xrpl@2.14.0` - XRP Ledger JavaScript SDK
- **TypeScript**: `5.3+` - Type-safe development
- **Firebase**: `10.7.0` - Encrypted health data storage
- **Node.js**: `20+` - Runtime environment

### XRPL Integration
```json
{
  "dependencies": {
    "xrpl": "^2.14.0",
    "firebase": "^10.7.0",
    "crypto-js": "^4.2.0",
    "uuid": "^9.0.1"
  }
}
```

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your XRPL credentials
```

### Run Demo
```bash
# NFT + Escrow data trading demo
npm run demo:datapool

# MPT reward distribution demo
npm run demo:mpt

# Subscription escrow demo
npm run demo:subscription
```

## 📊 Key Metrics

### XRPL Performance
- **Transaction Cost**: 0.000012 XRP (~$0.00002)
- **NFT Mint Time**: 3-5 seconds
- **Escrow Settlement**: Automatic on condition fulfillment
- **MPT Batch Efficiency**: 99.9% cost reduction vs individual payments

### Business Value
- **Data Ownership**: Users own their health data NFTs
- **Transparent Trading**: All transactions on public ledger
- **Privacy**: Zero PII on blockchain (encrypted off-chain)
- **Trustless**: Escrow eliminates platform risk

## 🔐 Security Features

### NFT-Based Access Control
```typescript
// Middleware verifies NFT ownership before database query
if (verifyNFTOwnership(nftId, requesterWallet)) {
  return decryptedHealthData;
}
```

### Escrow Protection
- Funds locked until NFT transfer confirmed
- Automatic refund if timeout (7 days)
- No platform custody of funds

### Data Encryption
- AES-256 encryption for health records
- AWS KMS key management
- Decryption keys never exposed

## 📖 Documentation

For detailed technical architecture, XRPL integration patterns, and system design, see:

📄 **[SportiQue_XRPL_Technical_Design.pdf](./SportiQue_XRPL_Technical_Design.pdf)**

This comprehensive document includes:
- System architecture diagrams
- XRPL primitive usage (NFTokens, Escrow, MPT)
- Data flow diagrams
- Code organization
- Security architecture
- Deployment architecture

## 🤝 Contributing

This project is part of the XRPL Hackathon submission. Contributions, issues, and feature requests are welcome!

## 📝 License

MIT License - see LICENSE file for details

---

**Built with ❤️ on the XRP Ledger**

> SportiQue는 건강 데이터의 안전한 거래와 투명한 리워드 분배를 위한 완전한 블록체인 솔루션입니다.
