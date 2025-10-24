# 🔗 SportiQue XRPL 기술 구현 링크

## ✅ XRPL 기술 요건 구현 위치

### 1. TokenEscrow 구현 ✅

**(EscrowCreate Transaction)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/escrow.ts#L15-L45
```typescript
// 구독 에스크로 생성 - core/escrow.ts
async createSubscriptionEscrow()
```

**(EscrowFinish Transaction)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/escrow.ts#L60-L75
```typescript
// 에스크로 완료 처리 - core/escrow.ts
async finishEscrow()
```

**(Conditional Escrow with Fulfillment)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/SubscriptionEscrow.ts#L95-L125
```typescript
// 복합 조건 기반 에스크로 - transactions/SubscriptionEscrow.ts
async createConditionalEscrow()
```

**(Escrow with FinishAfter)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/escrow.ts#L25-L35
```typescript
// 시간 기반 에스크로 설정 - core/escrow.ts
const finishAfter = Math.floor(Date.now() / 1000) + duration;
```

**(Escrow Cancel Transaction)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/escrow.ts#L80-L95
```typescript
// 에스크로 취소 - core/escrow.ts
async cancelEscrow()
```

---

### 2. NFTokens 구현 ✅

**(NFTokenMint Transaction)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/nft.ts#L10-L50
```typescript
// 구독 NFT 발행 - core/nft.ts
async mintSubscriptionNFT()
```

**(NFTokenMint with URI)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/nft.ts#L30-L40
```typescript
// IPFS URI 포함 NFT 발행 - core/nft.ts
URI: convertStringToHex(tokenURI)
```

**(NFTokenMint with TransferFee)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/nft.ts#L70-L80
```typescript
// 수수료 포함 풀 NFT 발행 - core/nft.ts
TransferFee: 500 // 5%
```

**(NFTokenCreateOffer Transaction)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/nft.ts#L115-L135
```typescript
// NFT 전송 오퍼 생성 - core/nft.ts
async createTransferOffer()
```

**(Account_NFTs Request)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/nft.ts#L95-L110
```typescript
// NFT 소유권 검증 - core/nft.ts
async verifyNFTOwnership()
```

**(NFToken Access Control)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/NFTAccessControl.ts#L20-L85
```typescript
// NFT 기반 접근 제어 - transactions/NFTAccessControl.ts
class NFTAccessControl
```

---

### 3. Payment with Memos 구현 ✅

**(Payment with Memos - Pool Reward)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/payment.ts#L10-L65
```typescript
// 풀 리워드 분배 - core/payment.ts
async distributePoolRewards()
```

**(Payment with MemoType and MemoData)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/payment.ts#L35-L45
```typescript
// 메모 데이터 구성 - core/payment.ts
Memos: [{
  Memo: {
    MemoType: convertStringToHex("pool_reward"),
    MemoData: convertStringToHex(JSON.stringify(memoData))
  }
}]
```

**(Payment with DestinationTag)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/payment.ts#L85-L95
```typescript
// 구독 결제 with DestinationTag - core/payment.ts
DestinationTag: 2000 // 구독 결제 식별자
```

**(Payment with MemoFormat)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/payment.ts#L100-L108
```typescript
// JSON 형식 메모 - core/payment.ts
MemoFormat: convertStringToHex("application/json")
```

---

## 🔄 통합 구현

### 구독 플로우

**(Subscription with Escrow + NFT)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/SubscriptionNFT.ts#L15-L120
```typescript
// 구독 전체 플로우 - transactions/SubscriptionNFT.ts
class SubscriptionNFT
```

**(Create Subscription)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/SubscriptionNFT.ts#L25-L55
```typescript
// 구독 생성 (에스크로 + NFT) - transactions/SubscriptionNFT.ts
async createSubscription()
```

**(Activate Subscription)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/SubscriptionNFT.ts#L60-L75
```typescript
// 구독 활성화 - transactions/SubscriptionNFT.ts
async activateSubscription()
```

**(Complete Subscription)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/SubscriptionNFT.ts#L80-L95
```typescript
// 구독 완료 - transactions/SubscriptionNFT.ts
async completeSubscription()
```

### 데이터 풀 플로우

**(Pool Creation)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/PoolNFT.ts#L20-L45
```typescript
// 풀 생성 - transactions/PoolNFT.ts
async createPool()
```

**(Pool NFT Minting)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/PoolNFT.ts#L50-L75
```typescript
// 풀 NFT 발행 - transactions/PoolNFT.ts
async mintPoolNFT()
```

**(Pool Participation)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/DataPoolParticipation.ts#L45-L80
```typescript
// 풀 참여 트랜잭션 - transactions/DataPoolParticipation.ts
async joinDataPool()
```

**(Pool Reward Distribution)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/DataReward.ts#L15-L85
```typescript
// 풀 리워드 분배 - transactions/DataReward.ts
async distributeRewards()
```

---

## 📊 핵심 기능

### 동적 가격 책정

**(Dynamic Pricing Engine)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/platform/RewardCalculator.ts#L25-L55
```typescript
// 품질 기반 가격 계산 - platform/platform/RewardCalculator.ts
calculateSubscriptionPrice()
```

**(Quality Score Calculation)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/payment.ts#L115-L135
```typescript
// 품질 기반 리워드 계산 - core/payment.ts
calculateReward()
```

### 데이터 처리

**(Data Anonymization)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/data/QualityEvaluator.ts#L40-L85
```typescript
// K-익명성 데이터 집계 - platform/data/QualityEvaluator.ts
async aggregatePoolData()
```

**(Data Encryption)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/utils.ts#L85-L120
```typescript
// AES-256-GCM 암호화 - core/utils.ts
async encryptHealthData()
```

### XRPL 통합

**(XRPL Wallet Creation)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/wallet.ts#L10-L35
```typescript
// XRPL 지갑 생성 - core/wallet.ts
async createWallet()
```

**(XRPL Fund Wallet)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/wallet.ts#L40-L55
```typescript
// Testnet faucet - core/wallet.ts
async fundWallet()
```

**(XRPL Client Connection)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/config.ts#L5-L25
```typescript
// XRPL 네트워크 연결 - core/config.ts
const client = new Client('wss://s.altnet.rippletest.net:51233')
```

---

## 🧪 테스트 시나리오

**(Full Subscription Scenario)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/scripts/runDemo.ts#L10-L45
```typescript
// 구독 전체 시나리오 - transactions/scripts/runDemo.ts
async function runSubscriptionScenario()
```

**(Data Pool Scenario)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/scripts/dataPoolScenario.ts#L15-L60
```typescript
// 데이터 풀 시나리오 - transactions/scripts/dataPoolScenario.ts
async function runPoolScenario()
```

**(Firestore Seed)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/transactions/scripts/seedFirestore.ts#L5-L35
```typescript
// Firebase 초기 데이터 - transactions/scripts/seedFirestore.ts
async function seedFirestore()
```

---

## 🔐 보안 및 인증

**(NFT-based Access Verification)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/xrpl/NftGenerator.ts#L45-L80
```typescript
// NFT 접근 권한 검증 - platform/xrpl/NftGenerator.ts
async verifyDataAccess()
```

**(Enterprise Authentication)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/enterprise/EnterpriseAuth.ts#L10-L45
```typescript
// 기업 인증 - platform/enterprise/EnterpriseAuth.ts
class EnterpriseAuth
```

**(User Authentication)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/user/UserAuth.ts#L10-L40
```typescript
// 사용자 인증 - platform/user/UserAuth.ts
class UserAuth
```

---

## 📚 타입 정의

**(XRPL Transaction Types)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/core/types.ts#L10-L85
```typescript
// XRPL 트랜잭션 타입 - core/types.ts
interface XRPLTransaction
interface NFTMetadata
interface EscrowCondition
```

**(Health Data Types)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/types/health.ts#L5-L45
```typescript
// 건강 데이터 타입 - platform/types/health.ts
interface HealthData
interface AnonymizedHealthData
```

**(User Types)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/types/user.ts#L5-L35
```typescript
// 사용자 타입 - platform/types/user.ts
interface UserProfile
interface UserWallet
```

**(Enterprise Types)** https://github.com/SportiQue-XRPL/XRP_LEDGER/blob/main/platform/types/enterprise.ts#L5-L40
```typescript
// 기업 타입 - platform/types/enterprise.ts
interface EnterpriseProfile
interface Subscription
```

---

> **GitHub Repository**: https://github.com/SportiQue-XRPL/XRP_LEDGER  
> **모든 XRPL 기술 구현이 위 저장소에서 확인 가능합니다**