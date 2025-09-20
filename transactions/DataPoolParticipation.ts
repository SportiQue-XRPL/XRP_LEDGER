/**
 * SportiQue - 데이터 풀 참여 트랜잭션
 * 
 * 기업이 데이터 풀에 참여하기 위한 트랜잭션
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';

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
 * 데이터 풀 참여 함수
 * 
 * @param enterpriseWallet 기업 지갑 정보
 * @param poolId 데이터 풀 ID
 * @param contributionAmount 기여 금액
 * @returns 트랜잭션 결과
 */
export async function joinDataPool(
  enterpriseWallet: { address: string, seed: string },
  poolId: string,
  contributionAmount: number
): Promise<any> {
  try {
    console.log(`Joining data pool ${poolId} with contribution of ${contributionAmount} XRP...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑 생성
    const wallet = Wallet.fromSeed(enterpriseWallet.seed);
    
    // 데이터 풀 정보 조회 (Firebase에서)
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    
    if (!poolDoc.exists()) {
      throw new Error(`Data pool ${poolId} not found`);
    }
    
    const pool = poolDoc.data();
    console.log(`Data pool found: ${pool.name}`);
    
    // 풀 상태 확인
    if (pool.status !== 'forming' && pool.status !== 'active') {
      throw new Error(`Cannot join data pool with status: ${pool.status}`);
    }
    
    // 참여 기업 수 확인
    if (pool.consortium.participatingEnterprises.length >= pool.targets.maxEnterprises) {
      throw new Error(`Maximum number of enterprises (${pool.targets.maxEnterprises}) already reached`);
    }
    
    // 기업 ID 생성
    const enterpriseId = `enterprise_${wallet.address.substring(1, 7)}`;
    
    // 이미 참여 중인지 확인
    const existingParticipation = pool.consortium.participatingEnterprises.find(
      (p: any) => p.enterpriseId === enterpriseId
    );
    
    if (existingParticipation) {
      throw new Error(`Enterprise ${enterpriseId} is already participating in this pool`);
    }
    
    // 기여 금액 확인
    if (contributionAmount < pool.targets.estimatedBudgetMin / pool.targets.maxEnterprises) {
      throw new Error(`Contribution amount (${contributionAmount} XRP) is less than the minimum required (${pool.targets.estimatedBudgetMin / pool.targets.maxEnterprises} XRP)`);
    }
    
    // 풀 에스크로 주소 (실제로는 풀 에스크로 주소를 사용해야 함)
    const poolEscrowAddress = pool.escrow ? pool.escrow.escrowAddress : `rPool${poolId.substring(5, 15)}Escrow`;
    
    // 에스크로 생성 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'EscrowCreate',
      Account: wallet.address,
      Destination: poolEscrowAddress,
      Amount: xrpToDrops(contributionAmount),
      FinishAfter: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90일 에스크로
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'pool_participation',
            poolId,
            enterpriseId
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
    
    // 기업 정보 조회 (실제 구현에서는 Firebase에서 기업 정보를 조회해야 함)
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    const enterpriseDoc = await getDoc(enterpriseRef);
    
    if (!enterpriseDoc.exists()) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }
    
    const enterprise = enterpriseDoc.data();
    
    // 지분 비율 계산
    const totalContribution = pool.consortium.totalContribution + contributionAmount;
    const sharePercentage = (contributionAmount / totalContribution) * 100;
    
    // 데이터 풀 업데이트
    await updateDoc(poolRef, {
      'consortium.participatingEnterprises': arrayUnion({
        enterpriseId,
        companyName: enterprise.companyName,
        contributionAmount,
        sharePercentage,
        joinedAt: Timestamp.now(),
        status: 'confirmed',
        escrowTxHash: txHash
      }),
      'consortium.totalContribution': totalContribution,
      'consortium.totalShares': pool.consortium.totalShares + sharePercentage,
      'consortium.remainingShares': 100 - (pool.consortium.totalShares + sharePercentage),
      'lastUpdated': Timestamp.now()
    });
    console.log(`Data pool ${poolId} updated with new enterprise participation`);
    
    // 기업 통계 업데이트
    await updateDoc(enterpriseRef, {
      'stats.totalPoolParticipations': enterprise.stats.totalPoolParticipations + 1,
      'xrpl.totalSpent': enterprise.xrpl.totalSpent + contributionAmount,
      'xrpl.escrowBalance': enterprise.xrpl.escrowBalance + contributionAmount,
      'lastUpdated': Timestamp.now()
    });
    console.log(`Enterprise statistics updated for ${enterpriseId}`);
    
    // 트랜잭션 정보 저장
    const transactionData = {
      txHash,
      txType: 'pool_participation',
      status: 'confirmed',
      
      transaction: {
        fromWallet: wallet.address,
        toWallet: poolEscrowAddress,
        amount: contributionAmount,
        fee: 0.012,
        memo: `Pool participation for ${poolId}`,
        sequence: (signed as any).tx_json?.Sequence,
        ledgerIndex: result.result.ledger_index
      },
      
      businessContext: {
        purpose: 'pool_participation',
        relatedType: 'data_pool',
        relatedId: poolId,
        enterpriseId,
        userId: null
      },
      
      createdAt: Timestamp.now()
    };
    
    // Firestore에 트랜잭션 정보 저장
    const transactionRef = await addDoc(collection(db, 'transactions'), transactionData);
    console.log(`Transaction document created with ID: ${transactionRef.id}`);
    
    return {
      success: true,
      txHash,
      poolId,
      enterpriseId,
      contributionAmount,
      sharePercentage
    };
  } catch (error) {
    console.error('Error joining data pool:', error);
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
async function testDataPoolParticipation() {
  // 테스트 지갑 정보 (실제 구현에서는 안전하게 관리해야 함)
  const enterpriseWallet = {
    address: 'rEnterprise123456789ABCDEF',
    seed: 's3cr3t5e3d123456789ABCDEF'
  };
  
  // 테스트 파라미터
  const poolId = 'pool_glucose_202509';
  const contributionAmount = 5000; // 5000 XRP
  
  // 데이터 풀 참여
  const result = await joinDataPool(
    enterpriseWallet,
    poolId,
    contributionAmount
  );
  
  console.log('Data pool participation result:', result);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testDataPoolParticipation()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
