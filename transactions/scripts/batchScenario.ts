import { Client, Wallet } from 'xrpl';
import { BatchDataReward } from '../BatchDataReward';

/**
 * Batch 트랜잭션 실제 사용 시나리오
 * 데이터 풀 완료 시 모든 참여자에게 한번에 리워드 지급
 */
async function runBatchRewardScenario() {
  // XRPL 연결
  const client = new Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();
  
  // 플랫폼 지갑 (실제로는 환경변수에서 로드)
  const platformWallet = Wallet.fromSeed('sEd7...');
  
  // BatchDataReward 인스턴스 생성
  const batchReward = new BatchDataReward(client);
  
  // 시나리오 1: 데이터 풀 종료 후 50명에게 리워드 일괄 지급
  console.log('📦 Batch 리워드 분배 시작...');
  
  // 50명의 참여자 데이터 (실제로는 DB에서 조회)
  const participants = [
    {
      userId: 'user_001',
      walletAddress: 'rUser001...',
      qualityScore: 95,
      dataCount: 150,
      baseAmount: 100
    },
    {
      userId: 'user_002', 
      walletAddress: 'rUser002...',
      qualityScore: 87,
      dataCount: 120,
      baseAmount: 100
    },
    // ... 48명 더
  ];
  
  // Batch로 한번에 리워드 분배
  const rewardResult = await batchReward.distributePoolRewardsBatch(
    platformWallet,
    'pool_diabetes_2024',
    participants
  );
  
  console.log(`✅ Batch 리워드 분배 완료!`);
  console.log(`   - Batch TX Hash: ${rewardResult.batchTxHash}`);
  console.log(`   - 총 지급액: ${rewardResult.totalDistributed} XRP`);
  console.log(`   - 참여자 수: ${rewardResult.participantCount}명`);
  
  // 시나리오 2: 참여 증명 NFT 일괄 발행
  console.log('\n📦 Batch NFT 발행 시작...');
  
  const nftParticipants = participants.map(p => ({
    userId: p.userId,
    walletAddress: p.walletAddress,
    qualityGrade: p.qualityScore >= 90 ? 'A' : 'B'
  }));
  
  const nftResult = await batchReward.batchMintParticipationNFTs(
    platformWallet,
    'pool_diabetes_2024',
    nftParticipants
  );
  
  console.log(`✅ Batch NFT 발행 완료!`);
  console.log(`   - Batch TX Hash: ${nftResult.batchTxHash}`);
  console.log(`   - 발행된 NFT 수: ${nftResult.nftCount}개`);
  
  // 시나리오 3: 구독 일괄 갱신
  console.log('\n📦 Batch 구독 갱신 시작...');
  
  const subscriptionsToRenew = [
    {
      userId: 'user_001',
      userWallet: 'rUser001...',
      amount: 100,
      duration: 2592000 // 30일
    },
    {
      userId: 'user_002',
      userWallet: 'rUser002...',
      amount: 100,
      duration: 2592000
    },
    // ... 더 많은 구독
  ];
  
  const enterpriseWallet = Wallet.fromSeed('sEnt...');
  
  const renewResult = await batchReward.batchRenewSubscriptions(
    enterpriseWallet,
    subscriptionsToRenew
  );
  
  console.log(`✅ Batch 구독 갱신 완료!`);
  console.log(`   - Batch TX Hash: ${renewResult.batchTxHash}`);
  console.log(`   - 생성된 에스크로: ${renewResult.escrowIds.length}개`);
  
  await client.disconnect();
}

// 실행
runBatchRewardScenario().catch(console.error);
