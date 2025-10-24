# SportiQue XRPL API Documentation

## 📚 Core APIs

### 🔐 Wallet Management

#### `createWallet()`
XRPL 지갑 생성 및 초기화

```typescript
import { createWallet } from './core/wallet';

// 사용 예시
const wallet = await createWallet();
console.log('지갑 주소:', wallet.address);
console.log('시드:', wallet.seed);

// 반환값
{
  wallet: Wallet,
  address: string,
  seed: string,
  balance: number
}
```

#### `fundWallet(wallet: Wallet, amount: number)`
테스트넷 지갑에 XRP 충전

```typescript
await fundWallet(wallet, 1000); // 1000 XRP 충전
```

---

### 💰 Payment APIs

#### `processSubscriptionPayment()`
구독 결제 처리

```typescript
import { processSubscriptionPayment } from './core/payment';

const txHash = await processSubscriptionPayment({
  enterpriseWallet: wallet,
  userAddress: "rUser123...",
  subscriptionId: "sub_001",
  amount: 100, // XRP
  duration: 2592000 // 30일 (초)
});

// 반환값: 트랜잭션 해시
```

#### `distributePoolRewards()`
데이터 풀 리워드 분배

```typescript
const participants = [
  {
    userId: "user_001",
    walletAddress: "rUser123...",
    baseAmount: 50,
    qualityScore: 85,
    consistencyScore: 90,
    dataCount: 150,
    period: "2024-01"
  }
];

const txHashes = await distributePoolRewards(
  platformWallet,
  "pool_001",
  participants
);
```

---

### 🎨 NFT APIs

#### `mintSubscriptionNFT()`
구독 NFT 발행

```typescript
import { mintSubscriptionNFT } from './core/nft';

const nftId = await mintSubscriptionNFT(
  userWallet,
  "rEnterprise123...", // 기업 주소
  {
    dataTypes: ['혈당', '혈압', '심박수'],
    validityPeriod: 30, // 일
    userQualityGrade: 'A'
  }
);

// 반환값: NFT ID (64자 hex string)
```

#### `mintPoolNFT()`
데이터 풀 NFT 발행

```typescript
const poolNftId = await mintPoolNFT(
  platformWallet,
  "rEnterprise123...",
  {
    poolName: "당뇨병 연구 풀",
    participantCount: 100,
    dataTypes: ['혈당', 'HbA1c'],
    aggregationLevel: 'weekly',
    endDate: "2024-12-31"
  }
);
```

#### `verifyNFTOwnership()`
NFT 소유권 확인

```typescript
const isOwner = await verifyNFTOwnership(
  "000800001234...", // NFT ID
  "rEnterprise123..." // 확인할 주소
);

// 반환값: boolean
```

---

### 🔒 Escrow APIs

#### `createSubscriptionEscrow()`
구독 에스크로 생성

```typescript
import { createSubscriptionEscrow } from './core/escrow';

const escrowId = await createSubscriptionEscrow(
  enterpriseWallet.address,
  userWallet.address,
  100, // XRP
  2592000 // 30일
);

// 반환값: Escrow ID
```

#### `finishEscrow()`
에스크로 완료

```typescript
const success = await finishEscrow(
  escrowId,
  fulfillmentCondition // 조건 충족 증명
);
```

#### `cancelEscrow()`
에스크로 취소

```typescript
const cancelled = await cancelEscrow(escrowId);
```

---

## 🔄 Transaction APIs

### `SubscriptionNFT` Class

```typescript
import { SubscriptionNFT } from './transactions/SubscriptionNFT';

const subscriptionNFT = new SubscriptionNFT(client);

// 구독 생성
const result = await subscriptionNFT.createSubscription({
  enterpriseId: "ent_001",
  userId: "user_001",
  dataTypes: ['혈당', '혈압'],
  duration: 30,
  amount: 100
});

// 구독 활성화
await subscriptionNFT.activateSubscription(
  result.subscriptionId,
  result.nftId
);

// 구독 종료
await subscriptionNFT.completeSubscription(
  result.subscriptionId
);
```

### `DataPoolParticipation` Class

```typescript
import { DataPoolParticipation } from './transactions/DataPoolParticipation';

const poolManager = new DataPoolParticipation(client);

// 풀 생성
const poolId = await poolManager.createDataPool({
  name: "고혈압 연구",
  targetParticipants: 50,
  rewardPerParticipant: 100,
  dataTypes: ['혈압', '심박수'],
  duration: 60 // 일
});

// 풀 참여
await poolManager.joinPool(poolId, userId);

// 풀 완료 및 리워드 분배
await poolManager.completePoolAndDistributeRewards(poolId);
```

---

## 🔍 Query APIs

### `getHealthDataWithNFT()`
NFT를 통한 건강 데이터 조회

```typescript
const healthData = await getHealthDataWithNFT(
  enterpriseId,
  nftId
);

// 반환값
[
  {
    dataHash: "hash123...",
    dataType: "혈당",
    timestamp: Timestamp,
    content: { value: 95, unit: "mg/dL" },
    metadata: {
      device: "Dexcom G6",
      accuracy: 95,
      verified: true
    }
  }
]
```

### `getAggregatedPoolData()`
데이터 풀 집계 데이터 조회

```typescript
const poolData = await getAggregatedPoolData(
  enterpriseId,
  poolId,
  nftId
);

// 반환값
{
  participantCount: 50,
  aggregatedMetrics: {
    bloodGlucose: {
      min: 70, max: 180, avg: 105,
      median: 100, stdDev: 25
    }
  },
  demographics: {
    ageGroups: { "20-29": 10, "30-39": 20, ... },
    genderDistribution: { male: 25, female: 25 }
  },
  trends: [...]
}
```

---

## 📊 Utility Functions

### `calculateDataQualityScore()`
데이터 품질 점수 계산

```typescript
const score = calculateDataQualityScore({
  completeness: 95,  // 완전성
  accuracy: 90,      // 정확도
  consistency: 85,   // 일관성
  timeliness: 100    // 적시성
});

// 반환값: 0-100 점수
```

### `encryptHealthData()`
건강 데이터 암호화

```typescript
const encrypted = await encryptHealthData({
  value: 95,
  unit: "mg/dL",
  timestamp: new Date()
});
```

### `generateAnonymousId()`
익명 ID 생성

```typescript
const anonymousId = generateAnonymousId(userId);
// 반환값: "anon_a3f2b1c8..."
```

---

## 🚦 Event Listeners

### NFT 이벤트 리스닝

```typescript
// NFT 발행 이벤트
client.on('nftMinted', (event) => {
  console.log('NFT 발행됨:', event.nftId);
  console.log('발행자:', event.issuer);
  console.log('소유자:', event.owner);
});

// NFT 전송 이벤트  
client.on('nftTransferred', (event) => {
  console.log('NFT 전송됨:', event.nftId);
  console.log('이전 소유자:', event.from);
  console.log('새 소유자:', event.to);
});
```

### 에스크로 이벤트 리스닝

```typescript
// 에스크로 생성
client.on('escrowCreated', (event) => {
  console.log('에스크로 생성:', event.escrowId);
  console.log('금액:', event.amount);
});

// 에스크로 완료
client.on('escrowFinished', (event) => {
  console.log('에스크로 완료:', event.escrowId);
  console.log('수령자:', event.destination);
});
```

---

## 🔐 Error Handling

### 에러 타입

```typescript
// NFT 관련 에러
class NFTError extends Error {
  constructor(message: string, public nftId?: string) {
    super(message);
    this.name = 'NFTError';
  }
}

// 에스크로 관련 에러
class EscrowError extends Error {
  constructor(message: string, public escrowId?: string) {
    super(message);
    this.name = 'EscrowError';
  }
}

// 데이터 품질 에러
class DataQualityError extends Error {
  constructor(message: string, public qualityScore?: number) {
    super(message);
    this.name = 'DataQualityError';
  }
}
```

### 에러 처리 예시

```typescript
try {
  const nftId = await mintSubscriptionNFT(...);
} catch (error) {
  if (error instanceof NFTError) {
    console.error('NFT 발행 실패:', error.message);
    // NFT 특정 에러 처리
  } else if (error instanceof InsufficientFundsError) {
    console.error('잔액 부족:', error.message);
    // 잔액 부족 처리
  } else {
    console.error('알 수 없는 에러:', error);
  }
}
```

---

## 🧪 Testing

### 단위 테스트 예시

```typescript
import { describe, it, expect } from '@jest/globals';
import { createWallet, mintNFT } from './core';

describe('NFT 발행 테스트', () => {
  it('구독 NFT를 성공적으로 발행해야 함', async () => {
    const wallet = await createWallet();
    const nftId = await mintNFT(wallet, metadata);
    
    expect(nftId).toBeDefined();
    expect(nftId).toHaveLength(64);
  });
  
  it('잘못된 메타데이터로 실패해야 함', async () => {
    const wallet = await createWallet();
    
    await expect(
      mintNFT(wallet, {}) // 빈 메타데이터
    ).rejects.toThrow('Invalid metadata');
  });
});
```

### 통합 테스트 예시

```typescript
describe('구독 플로우 통합 테스트', () => {
  it('전체 구독 시나리오를 완료해야 함', async () => {
    // 1. 지갑 생성
    const userWallet = await createWallet();
    const enterpriseWallet = await createWallet();
    
    // 2. 에스크로 생성
    const escrowId = await createSubscriptionEscrow(...);
    
    // 3. NFT 발행
    const nftId = await mintSubscriptionNFT(...);
    
    // 4. 데이터 업로드
    await uploadHealthData(...);
    
    // 5. 에스크로 완료
    const completed = await finishEscrow(escrowId);
    
    expect(completed).toBe(true);
  });
});
```

---

## 📋 Configuration

### 환경 변수 설정

```env
# .env 파일
XRPL_NETWORK=testnet
XRPL_WSS_URL=wss://s.altnet.rippletest.net:51233
FIREBASE_PROJECT_ID=sportique-platform
FIREBASE_API_KEY=your-api-key
IPFS_GATEWAY=https://ipfs.io/ipfs/
NFT_TAXON_SUBSCRIPTION=1
NFT_TAXON_POOL=2
PLATFORM_WALLET_SEED=your-platform-wallet-seed
```

### TypeScript 설정

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

## 📦 Dependencies

```json
{
  "dependencies": {
    "xrpl": "^2.14.0",
    "firebase": "^10.7.0",
    "crypto": "^1.0.1",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.0"
  }
}
```

---

## 🔗 관련 링크

- [XRPL Documentation](https://xrpl.org/)
- [NFToken Standard](https://xrpl.org/nftoken.html)
- [Escrow Transactions](https://xrpl.org/escrow.html)
- [Payment with Memos](https://xrpl.org/payment.html#memos)
- [SportiQue Platform](https://sportique.biz)
