import { Client, Wallet } from 'xrpl';
import { MPTPointSystem } from '../MPTPointSystem';

/**
 * MPT 포인트 시스템 실제 사용 시나리오
 */
async function runMPTScenario() {
  const client = new Client('wss://s.altnet.rippletest.net:51233');
  await client.connect();
  
  const mptSystem = new MPTPointSystem(client);
  
  // 지갑 생성
  const enterpriseWallet = Wallet.fromSeed('sEd7...');
  const userWallet = Wallet.fromSeed('sEd8...');
  
  console.log('🎯 MPT 포인트 시스템 시나리오 시작...');
  
  // 1. 구독 포인트 시스템 초기화
  console.log('\n📦 구독 포인트 시스템 초기화...');
  const subscription = await mptSystem.initializeSubscriptionPoints(
    enterpriseWallet,
    userWallet,
    'enterprise_001',
    'subscription_001'
  );
  
  console.log(`✅ 포인트 시스템 초기화 완료!`);
  console.log(`   - 토큰 ID: ${subscription.tokenId}`);
  console.log(`   - 최대 가능 포인트: ${subscription.totalPossiblePoints}`);
  console.log(`   - 교환 비율: ${subscription.exchangeRate} 포인트 = 1 XRP`);
  
  // 2. 일일 데이터 제출 시뮬레이션 (7일)
  console.log('\n📊 일일 데이터 제출 시뮬레이션...');
  for (let day = 1; day <= 7; day++) {
    const dataQuality = {
      accuracy: 85 + Math.random() * 15, // 85-100%
      completeness: 90 + Math.random() * 10, // 90-100%
      consistency: 80 + Math.random() * 20 // 80-100%
    };
    
    const result = await mptSystem.processDailyDataSubmission(
      enterpriseWallet,
      userWallet,
      subscription.tokenId,
      dataQuality,
      day
    );
    
    console.log(`   Day ${day}: ${result.pointsAwarded}포인트 (${result.grade}등급) - 총 ${result.totalPoints}포인트`);
  }
  
  // 3. 포인트 잔액 조회
  console.log('\n💰 포인트 잔액 조회...');
  const balance = await mptSystem.getUserPointBalance(
    userWallet,
    subscription.tokenId
  );
  console.log(`   현재 잔액: ${balance.balance} 포인트`);
  
  // 4. 포인트 → XRP 교환
  console.log('\n💱 포인트 → XRP 교환...');
  const exchangeResult = await mptSystem.exchangePointsToXRP(
    userWallet,
    enterpriseWallet,
    subscription.tokenId,
    500, // 500포인트 교환
    100 // 100:1 비율
  );
  
  console.log(`✅ 교환 완료!`);
  console.log(`   - 소각된 포인트: ${exchangeResult.pointsBurned}`);
  console.log(`   - 받은 XRP: ${exchangeResult.xrpReceived}`);
  console.log(`   - 트랜잭션 해시: ${exchangeResult.transactionHash}`);
  
  // 5. 데이터 풀 포인트 시스템
  console.log('\n🏊 데이터 풀 포인트 시스템...');
  const participants = [
    {
      userWallet: Wallet.fromSeed('sEd9...'),
      dataQuality: { accuracy: 95, completeness: 98, consistency: 92 },
      contribution: 100
    },
    {
      userWallet: Wallet.fromSeed('sEdA...'),
      dataQuality: { accuracy: 88, completeness: 85, consistency: 90 },
      contribution: 80
    },
    {
      userWallet: Wallet.fromSeed('sEdB...'),
      dataQuality: { accuracy: 92, completeness: 95, consistency: 88 },
      contribution: 95
    }
  ];
  
  const poolResult = await mptSystem.processPoolParticipation(
    enterpriseWallet,
    participants,
    'pool_diabetes_2024'
  );
  
  console.log(`✅ 풀 포인트 분배 완료!`);
  console.log(`   - 총 분배 포인트: ${poolResult.totalPointsDistributed}`);
  console.log(`   - 참여자 수: ${poolResult.participantCount}명`);
  
  // 6. 포인트 통계
  console.log('\n📈 포인트 통계...');
  const stats = await mptSystem.getPointStatistics(subscription.tokenId);
  console.log(`   - 총 공급량: ${stats.totalSupply} 포인트`);
  console.log(`   - 홀더 수: ${stats.totalHolders}명`);
  console.log(`   - 평균 잔액: ${stats.averageBalance.toFixed(2)} 포인트`);
  console.log(`   - 최고 홀더: ${stats.topHolder.address} (${stats.topHolder.balance} 포인트)`);
  
  await client.disconnect();
  console.log('\n🎉 MPT 포인트 시스템 시나리오 완료!');
}

// 실행
runMPTScenario().catch(console.error);
