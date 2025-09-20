/**
 * SportiQue - 트랜잭션 인덱스
 * 
 * 모든 트랜잭션 기능을 내보내는 인덱스 파일
 */

// 구독 에스크로 생성 트랜잭션
export { createSubscriptionEscrow } from './SubscriptionEscrow';

// 데이터 풀 참여 트랜잭션
export { joinDataPool } from './DataPoolParticipation';

// 구독 NFT 발행 트랜잭션
export { issueSubscriptionNFT } from './SubscriptionNFT';

// 풀 NFT 발행 트랜잭션
export { issuePoolNFT } from './PoolNFT';

// 데이터 보상 지급 트랜잭션
export { payDataReward } from './DataReward';

// NFT 기반 데이터 접근 제어
export {
  checkNFTOwnership,
  accessSubscriptionData,
  accessPoolData,
  exportDataToCSV
} from './NFTAccessControl';

/**
 * SportiQue 트랜잭션 시스템
 * 
 * 이 모듈은 SportiQue 플랫폼의 모든 XRPL 트랜잭션 기능을 제공합니다.
 * 
 * 주요 기능:
 * 1. 구독 에스크로 생성: 기업이 사용자 데이터 구독을 위한 에스크로 계약을 생성
 * 2. 데이터 풀 참여: 기업이 데이터 풀에 참여하기 위한 트랜잭션
 * 3. 구독 NFT 발행: 구독 계약이 완료된 후 기업에게 NFT 발행
 * 4. 풀 NFT 발행: 데이터 풀이 완료된 후 참여 기업에게 NFT 발행
 * 5. 데이터 보상 지급: 사용자가 건강 데이터를 제공한 후 보상 지급
 * 6. NFT 기반 데이터 접근 제어: NFT 소유권을 확인하여 데이터 접근 권한 제어
 * 
 * 사용 예시:
 * ```typescript
 * import { createSubscriptionEscrow } from 'sportique-transactions';
 * 
 * const result = await createSubscriptionEscrow(
 *   enterpriseWallet,
 *   userId,
 *   subscriptionDuration,
 *   dataTypes,
 *   totalAmount
 * );
 * ```
 */
