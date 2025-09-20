# SportiQue XRP Ledger 핵심 TypeScript 코드 모음

SportiQue 프로젝트의 모든 핵심 TypeScript 코드가 체계적으로 정리되어 있습니다.

## 📁 폴더 구조

```
XRP_LEDGER/
├── core/           # XRPL 기본 기능 모듈
├── platform/       # 플랫폼 비즈니스 로직
└── transactions/   # 트랜잭션 처리 모듈
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

### 2. 데이터 풀 관리
- 기업과 사용자 간 건강 데이터 거래
- NFT 기반 데이터 소유권 증명

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

## 📚 의존성

- `xrpl`: XRP Ledger JavaScript 라이브러리
- `firebase`: Firebase SDK
- `typescript`: TypeScript 컴파일러

---

> 이 코드 모음은 SportiQue 프로젝트의 핵심 블록체인 기능을 구현합니다.
> 건강 데이터의 안전한 거래와 투명한 리워드 분배를 위한 완전한 솔루션입니다.
