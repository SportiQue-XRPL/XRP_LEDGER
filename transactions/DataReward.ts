/**
 * SportiQue - 데이터 보상 지급 트랜잭션
 * 
 * 사용자가 건강 데이터를 제공한 후 보상을 지급하는 트랜잭션
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBlkthPW-3LCSVvyXg4k8yYZ7lx_5RZg3E",
  authDomain: "xrplhackathon-9bf0a.firebaseapp.com",
  projectId: "xrplhackathon-9bf0a",
  storageBucket: "xrplhackathon-9bf0a.appspot.com",
  messagingSenderId: "235937752656",
  appId: "1:235937752656:web:abcdef1234567890abcdef"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// XRPL 테스트넷 서버 URL
const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

/**
 * 데이터 보상 지급 함수
 * 
 * @param enterpriseWallet 기업 지갑 정보 (보상 지급자)
 * @param dataId 건강 데이터 ID
 * @param subscriptionId 구독 ID
 * @returns 트랜잭션 결과
 */
export async function payDataReward(
  enterpriseWallet: { address: string, seed: string },
  dataId: string,
  subscriptionId: string
): Promise<any> {
  try {
    console.log(`Paying reward for data ${dataId} from subscription ${subscriptionId}...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑 생성
    const wallet = Wallet.fromSeed(enterpriseWallet.seed);
    
    // 건강 데이터 정보 조회 (Firebase에서)
    const dataRef = doc(db, 'health_data', dataId);
    const dataDoc = await getDoc(dataRef);
    
    if (!dataDoc.exists()) {
      throw new Error(`Health data ${dataId} not found`);
    }
    
    const healthData = dataDoc.data();
    console.log(`Health data found: ${dataId}`);
    
    // 이미 보상이 지급되었는지 확인
    if (healthData.reward && healthData.reward.paidAt) {
      throw new Error(`Reward for data ${dataId} has already been paid at ${healthData.reward.paidAt.toDate()}`);
    }
    
    // 구독 정보 조회
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (!subscriptionDoc.exists()) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    const subscription = subscriptionDoc.data();
    console.log(`Subscription found: ${subscriptionId}`);
    
    // 구독 상태 확인
    if (subscription.status !== 'active') {
      throw new Error(`Cannot pay reward for subscription with status: ${subscription.status}`);
    }
    
    // 사용자 정보 조회
    const userId = healthData.userId;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} not found`);
    }
    
    const user = userDoc.data();
    
    // 사용자 지갑 주소 조회
    const userWalletAddress = user.xrpl.walletAddress;
    
    // 데이터 유형에 따른 기본 보상 계산
    const dataType = healthData.dataType;
    const dataTypeConfig = subscription.requirements.dataTypes.find((dt: any) => dt.type === dataType);
    
    if (!dataTypeConfig) {
      throw new Error(`Data type ${dataType} not found in subscription requirements`);
    }
    
    const baseReward = dataTypeConfig.rewardPerEntry;
    
    // 품질 등급에 따른 보너스 계산
    const qualityGrade = healthData.quality.grade;
    const qualityBonus = subscription.requirements.qualityBonus[qualityGrade] || 0;
    
    // 총 보상 계산
    const totalReward = baseReward * qualityBonus;
    
    // 보상 지급 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: userWalletAddress,
      Amount: xrpToDrops(totalReward),
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'data_reward',
            dataId,
            subscriptionId,
            userId,
            dataType,
            qualityGrade,
            baseReward,
            qualityBonus,
            totalReward
          }), 'utf8').toString('hex')
        }
      }]
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    console.log('Transaction signed');
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    console.log('Transaction submitted and validated');
    
    // 클라이언트 연결 종료
    await client.disconnect();
    console.log('Disconnected from XRPL Testnet');
    
    if (!result.result.meta || typeof result.result.meta === 'string' || result.result.meta.TransactionResult !== 'tesSUCCESS') {
      const code = typeof result.result.meta === 'string' ? result.result.meta : (result.result.meta?.TransactionResult ?? 'unknown');
      throw new Error(`Transaction failed: ${code}`);
    }
    
    // 트랜잭션 해시
    const txHash = result.result.hash;
    console.log(`Transaction successful with hash: ${txHash}`);
    
    // 건강 데이터 업데이트
    await updateDoc(dataRef, {
      'reward': {
        baseReward,
        qualityBonus,
        totalReward,
        paidAt: Timestamp.now(),
        txHash
      },
      'lastUpdated': Timestamp.now()
    });
    console.log(`Health data ${dataId} updated with reward information`);
    
    // 구독 통계 업데이트
    await updateDoc(subscriptionRef, {
      'stats.totalDataPoints': subscription.stats.totalDataPoints + 1,
      [`stats.qualityDistribution.${qualityGrade}`]: subscription.stats.qualityDistribution[qualityGrade] + 1,
      'stats.totalRewardPaid': subscription.stats.totalRewardPaid + totalReward,
      'escrow.usedAmount': subscription.escrow.usedAmount + totalReward,
      'escrow.remainingAmount': subscription.escrow.remainingAmount - totalReward,
      'lastUpdated': Timestamp.now()
    });
    console.log(`Subscription ${subscriptionId} statistics updated`);
    
    // 사용자 통계 업데이트
    await updateDoc(userRef, {
      'stats.totalDataPoints': user.stats.totalDataPoints + 1,
      'stats.totalEarnings': user.stats.totalEarnings + totalReward,
      'xrpl.balance': user.xrpl.balance + totalReward,
      'xrpl.totalEarned': user.xrpl.totalEarned + totalReward,
      'lastUpdated': Timestamp.now()
    });
    console.log(`User ${userId} statistics updated`);
    
    // 기업 통계 업데이트
    const enterpriseId = subscription.enterpriseId;
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    await updateDoc(enterpriseRef, {
      'stats.totalDataPointsCollected': 1, // 실제로는 increment 연산을 사용해야 함
      'xrpl.escrowBalance': subscription.escrow.remainingAmount - totalReward,
      'lastUpdated': Timestamp.now()
    });
    console.log(`Enterprise ${enterpriseId} statistics updated`);
    
    // 트랜잭션 정보 저장
    const transactionData = {
      txHash,
      txType: 'data_reward',
      status: 'confirmed',
      
      transaction: {
        fromWallet: wallet.address,
        toWallet: userWalletAddress,
        amount: totalReward,
        fee: 0.012,
        memo: `Reward for ${dataType} data on ${new Date(healthData.timestamp.toDate()).toISOString().slice(0, 10)}`,
        sequence: (signed as any).tx_json?.Sequence,
        ledgerIndex: result.result.ledger_index
      },
      
      businessContext: {
        purpose: 'data_reward',
        relatedType: 'health_data',
        relatedId: dataId,
        enterpriseId,
        userId
      },
      
      createdAt: Timestamp.now()
    };
    
    // Firestore에 트랜잭션 정보 저장
    const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
    console.log(`Transaction document created with ID: ${transactionRef.id}`);
    
    return {
      success: true,
      txHash,
      dataId,
      subscriptionId,
      userId,
      baseReward,
      qualityBonus,
      totalReward
    };
  } catch (error) {
    console.error('Error paying data reward:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 테스트 실행 함수
 */
async function testDataReward() {
  // 테스트 지갑 정보 (실제 구현에서는 안전하게 관리해야 함)
  const enterpriseWallet = {
    address: 'rEnterprise123456789ABCDEF',
    seed: 's3cr3t5e3d123456789ABCDEF'
  };
  
  // 테스트 파라미터
  const dataId = 'data_123456_20250920_glucose';
  const subscriptionId = 'subscription_123456';
  
  // 데이터 보상 지급
  const result = await payDataReward(
    enterpriseWallet,
    dataId,
    subscriptionId
  );
  
  console.log('Data reward payment result:', result);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testDataReward()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
