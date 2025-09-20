/**
 * SportiQue - 구독 에스크로 생성 트랜잭션
 * 
 * 기업이 사용자 데이터 구독을 위한 에스크로 계약을 생성하는 트랜잭션
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';

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
 * 구독 에스크로 생성 함수
 * 
 * @param enterpriseWallet 기업 지갑 정보
 * @param userId 사용자 ID
 * @param subscriptionDuration 구독 기간 (일)
 * @param dataTypes 데이터 유형 배열
 * @param totalAmount 총 에스크로 금액
 * @returns 트랜잭션 결과
 */
export async function createSubscriptionEscrow(
  enterpriseWallet: { address: string, seed: string },
  userId: string,
  subscriptionDuration: number,
  dataTypes: string[],
  totalAmount: number
): Promise<any> {
  try {
    console.log(`Creating subscription escrow for user ${userId}...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑 생성
    const wallet = Wallet.fromSeed(enterpriseWallet.seed);
    
    // 사용자 지갑 정보 조회 (Firebase에서)
    // 실제 구현에서는 Firebase에서 사용자 지갑 주소를 조회해야 함
    const userWalletAddress = `rUser${userId.substring(5)}ABCDEF`;
    
    // 종료 시간 계산 (현재 시간 + subscriptionDuration일)
    const finishAfter = Math.floor(Date.now() / 1000) + (subscriptionDuration * 24 * 60 * 60);
    
    // 에스크로 생성 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'EscrowCreate',
      Account: wallet.address,
      Destination: userWalletAddress,
      Amount: xrpToDrops(totalAmount),
      FinishAfter: finishAfter,
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'subscription',
            userId,
            dataTypes,
            duration: subscriptionDuration
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
    
    // 에스크로 주소 생성 (실제로는 에스크로 ID를 사용해야 함)
    const escrowAddress = `rEscrow${wallet.address.substring(1, 10)}${Math.floor(Math.random() * 1000000)}`;
    
    // 구독 ID 생성
    const subscriptionId = `subscription_${userId}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    
    // Firebase에 구독 정보 저장
    const subscriptionData = {
      subscriptionId,
      enterpriseId: `enterprise_${wallet.address.substring(1, 7)}`,
      userId,
      
      status: 'active',
      type: 'individual',
      
      contract: {
        startDate: Timestamp.now(),
        endDate: Timestamp.fromMillis(Date.now() + (subscriptionDuration * 24 * 60 * 60 * 1000)),
        duration: subscriptionDuration,
        autoRenew: false,
        terminationConditions: ["user_request", "enterprise_request", "quality_below_c"]
      },
      
      requirements: {
        dataTypes: dataTypes.map(type => ({
          type,
          frequency: 'daily',
          minEntries: 1,
          rewardPerEntry: type === 'glucose' ? 3.0 : (type === 'blood_pressure' ? 2.5 : 2.0)
        })),
        qualityBonus: {
          A: 1.5,
          B: 1.0,
          C: 0.7
        },
        minQualityGrade: 'C'
      },
      
      escrow: {
        escrowAddress,
        totalAmount,
        usedAmount: 0,
        remainingAmount: totalAmount,
        escrowTxHash: txHash
      },
      
      stats: {
        totalDataPoints: 0,
        qualityDistribution: {
          A: 0,
          B: 0,
          C: 0,
          D: 0
        },
        averageQuality: 0,
        totalRewardPaid: 0
      },
      
      nft: {
        nftId: null,
        issuedAt: null
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };
    
    // Firestore에 구독 정보 저장
    const subscriptionRef = await addDoc(collection(db, 'subscriptions'), subscriptionData);
    console.log(`Subscription document created with ID: ${subscriptionRef.id}`);
    
    // 트랜잭션 정보 저장
    const transactionData = {
      txHash,
      txType: 'subscription_escrow',
      status: 'confirmed',
      
      transaction: {
        fromWallet: wallet.address,
        toWallet: userWalletAddress,
        amount: totalAmount,
        fee: 0.012,
        memo: `Subscription escrow for user ${userId}`,
        sequence: (signed as any).tx_json?.Sequence,
        ledgerIndex: result.result.ledger_index
      },
      
      businessContext: {
        purpose: 'subscription_creation',
        relatedType: 'subscription',
        relatedId: subscriptionId,
        enterpriseId: `enterprise_${wallet.address.substring(1, 7)}`,
        userId
      },
      
      createdAt: Timestamp.now()
    };
    
    // Firestore에 트랜잭션 정보 저장
    const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
    console.log(`Transaction document created with ID: ${transactionRef.id}`);
    
    // 기업 통계 업데이트 (실제 구현에서는 기업 문서를 조회한 후 업데이트해야 함)
    const enterpriseId = `enterprise_${wallet.address.substring(1, 7)}`;
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    await updateDoc(enterpriseRef, {
      'stats.totalSubscriptions': 1, // 실제로는 increment 연산을 사용해야 함
      'stats.activeSubscriptions': 1,
      'xrpl.totalSpent': totalAmount,
      'xrpl.escrowBalance': totalAmount,
      'lastUpdated': Timestamp.now()
    });
    console.log(`Enterprise statistics updated for ${enterpriseId}`);
    
    // 사용자 통계 업데이트 (실제 구현에서는 사용자 문서를 조회한 후 업데이트해야 함)
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'stats.totalSubscriptions': 1, // 실제로는 increment 연산을 사용해야 함
      'stats.activeSubscriptions': 1,
      'lastUpdated': Timestamp.now()
    });
    console.log(`User statistics updated for ${userId}`);
    
    return {
      success: true,
      txHash,
      escrowAddress,
      subscriptionId,
      amount: totalAmount,
      duration: subscriptionDuration
    };
  } catch (error) {
    console.error('Error creating subscription escrow:', error);
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
async function testSubscriptionEscrow() {
  // 테스트 지갑 정보 (실제 구현에서는 안전하게 관리해야 함)
  const enterpriseWallet = {
    address: 'rEnterprise123456789ABCDEF',
    seed: 's3cr3t5e3d123456789ABCDEF'
  };
  
  // 테스트 파라미터
  const userId = 'user_123456';
  const subscriptionDuration = 30; // 30일
  const dataTypes = ['glucose', 'blood_pressure'];
  const totalAmount = 450; // 450 XRP
  
  // 구독 에스크로 생성
  const result = await createSubscriptionEscrow(
    enterpriseWallet,
    userId,
    subscriptionDuration,
    dataTypes,
    totalAmount
  );
  
  console.log('Subscription escrow creation result:', result);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testSubscriptionEscrow()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
