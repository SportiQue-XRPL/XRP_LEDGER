/**
 * SportiQue - 데이터 풀 시나리오 전체 실행 스크립트
 * 
 * 이 스크립트는 데이터 풀의 전체 생명주기를 시연합니다:
 * 1. 데이터 풀 생성
 * 2. 기업 참여 (에스크로)
 * 3. 사용자 데이터 제공
 * 4. 보상 지급
 * 5. NFT 발행
 * 6. 트랜잭션 증빙
 */

import { Client, Wallet, xrpToDrops, convertStringToHex } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc, 
  Timestamp 
} from 'firebase/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBlkthPW-3LCSVvyXg4k8yYZ7lx_5RZg3E",
  authDomain: "xrplhackathon-9bf0a.firebaseapp.com",
  projectId: "xrplhackathon-9bf0a",
  storageBucket: "xrplhackathon-9bf0a.appspot.com",
  messagingSenderId: "235937752656",
  appId: "1:235937752656:web:abcdef1234567890abcdef"
};

// XRPL 테스트넷 설정
const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

// 시나리오 데이터 로드
const scenarioPath = path.join(__dirname, '../../data/scenarios/datapool_scenario.json');
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'));

/**
 * 지갑 생성 또는 펀딩 함수
 */
async function getOrCreateWallet(client: Client, seed?: string): Promise<Wallet> {
  if (seed) {
    try {
      const wallet = Wallet.fromSeed(seed);
      console.log(`기존 지갑 사용: ${wallet.address}`);
      return wallet;
    } catch (error) {
      console.log('시드에서 지갑 생성 실패, 새 지갑 생성');
    }
  }
  
  const fundResult = await client.fundWallet();
  console.log(`새 지갑 생성 및 펀딩: ${fundResult.wallet.address}`);
  return fundResult.wallet;
}

/**
 * 1단계: 데이터 풀 생성 및 초기 설정
 */
async function createDataPoolPhase(db: any, client: Client) {
  console.log('\n========== 1단계: 데이터 풀 생성 ==========\n');
  
  const poolData = scenario.dataPool;
  
  // 플랫폼 지갑 생성
  const platformWallet = await getOrCreateWallet(client);
  console.log(`플랫폼 지갑: ${platformWallet.address}`);
  
  // 데이터 풀 정보 Firestore에 저장
  const poolDoc = {
    ...poolData,
    status: 'forming',
    currentPhase: 'enterprise_recruitment',
    consortium: {
      participatingEnterprises: [],
      totalContribution: 0,
      totalShares: 0,
      remainingShares: 100
    },
    userParticipation: {
      registeredUsers: 0,
      activeUsers: 0,
      completedUsers: 0,
      userList: []
    },
    escrow: {
      escrowAddress: `rPool${poolData.poolId.substring(5, 15)}Escrow`,
      totalAmount: 0,
      usedAmount: 0,
      remainingAmount: 0
    },
    createdAt: Timestamp.now(),
    lastUpdated: Timestamp.now()
  };
  
  await setDoc(doc(db, 'data_pools', poolData.poolId), poolDoc);
  console.log(`데이터 풀 생성 완료: ${poolData.poolId}`);
  
  // 알림 트랜잭션 전송 (최소 금액)
  const notifyTx = await client.autofill({
    TransactionType: 'Payment',
    Account: platformWallet.address,
    Destination: platformWallet.address,
    Amount: xrpToDrops(0.000001),
    Memos: [{
      Memo: {
        MemoData: convertStringToHex(JSON.stringify({
          type: 'pool_created',
          poolId: poolData.poolId,
          name: poolData.name
        }))
      }
    }]
  });
  
  const signedNotify = platformWallet.sign(notifyTx);
  const notifyResult = await client.submitAndWait(signedNotify.tx_blob);
  
  console.log(`데이터 풀 생성 알림 트랜잭션: ${notifyResult.result.hash}`);
  
  return {
    platformWallet,
    poolCreationTxHash: notifyResult.result.hash
  };
}

/**
 * 2단계: 기업 참여 (에스크로 생성)
 */
async function enterpriseParticipationPhase(db: any, client: Client, platformWallet: Wallet) {
  console.log('\n========== 2단계: 기업 참여 (에스크로) ==========\n');
  
  const enterprises = scenario.participants.enterprises;
  const poolId = scenario.dataPool.poolId;
  const results = [];
  
  for (const enterprise of enterprises) {
    console.log(`\n기업 참여: ${enterprise.companyName}`);
    
    // 기업 지갑 생성
    const enterpriseWallet = await getOrCreateWallet(client, enterprise.walletSeed);
    console.log(`기업 지갑: ${enterpriseWallet.address}`);
    
    // 기업 정보 Firestore에 저장
    await setDoc(doc(db, 'enterprises', enterprise.enterpriseId), {
      ...enterprise,
      walletAddress: enterpriseWallet.address,
      stats: {
        totalPoolParticipations: 0,
        totalDataPointsCollected: 0
      },
      xrpl: {
        walletAddress: enterpriseWallet.address,
        balance: 10000,
        escrowBalance: 0,
        totalSpent: 0
      },
      createdAt: Timestamp.now()
    });
    
    // 에스크로 생성 (90일 후 릴리즈)
    const finishAfter = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
    
    const escrowTx = await client.autofill({
      TransactionType: 'EscrowCreate',
      Account: enterpriseWallet.address,
      Destination: platformWallet.address,
      Amount: xrpToDrops(enterprise.contributionAmount),
      FinishAfter: finishAfter,
      Memos: [{
        Memo: {
          MemoData: convertStringToHex(JSON.stringify({
            type: 'pool_participation',
            poolId,
            enterpriseId: enterprise.enterpriseId,
            companyName: enterprise.companyName
          }))
        }
      }]
    });
    
    const signedEscrow = enterpriseWallet.sign(escrowTx);
    const escrowResult = await client.submitAndWait(signedEscrow.tx_blob);
    
    console.log(`에스크로 생성 트랜잭션: ${escrowResult.result.hash}`);
    console.log(`에스크로 금액: ${enterprise.contributionAmount} XRP`);
    console.log(`지분율: ${enterprise.sharePercentage}%`);
    
    // 데이터 풀 업데이트
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    const poolData = poolDoc.data();
    
    await updateDoc(poolRef, {
      'consortium.participatingEnterprises': [...poolData.consortium.participatingEnterprises, {
        enterpriseId: enterprise.enterpriseId,
        companyName: enterprise.companyName,
        contributionAmount: enterprise.contributionAmount,
        sharePercentage: enterprise.sharePercentage,
        joinedAt: Timestamp.now(),
        status: 'confirmed',
        escrowTxHash: escrowResult.result.hash,
        escrowSequence: (signedEscrow as any).tx_json?.Sequence
      }],
      'consortium.totalContribution': poolData.consortium.totalContribution + enterprise.contributionAmount,
      'consortium.totalShares': poolData.consortium.totalShares + enterprise.sharePercentage,
      'consortium.remainingShares': poolData.consortium.remainingShares - enterprise.sharePercentage,
      'escrow.totalAmount': poolData.escrow.totalAmount + enterprise.contributionAmount,
      'lastUpdated': Timestamp.now()
    });
    
    results.push({
      enterpriseId: enterprise.enterpriseId,
      companyName: enterprise.companyName,
      walletAddress: enterpriseWallet.address,
      escrowTxHash: escrowResult.result.hash,
      escrowSequence: (signedEscrow as any).tx_json?.Sequence,
      amount: enterprise.contributionAmount
    });
    
    // 트랜잭션 기록 저장
    await addDoc(collection(db, 'transactions'), {
      txHash: escrowResult.result.hash,
      txType: 'pool_participation',
      status: 'confirmed',
      transaction: {
        fromWallet: enterpriseWallet.address,
        toWallet: platformWallet.address,
        amount: enterprise.contributionAmount,
        fee: 0.012,
        memo: `Pool participation for ${poolId}`,
        sequence: (signedEscrow as any).tx_json?.Sequence,
        ledgerIndex: escrowResult.result.ledger_index
      },
      businessContext: {
        purpose: 'pool_participation',
        relatedType: 'data_pool',
        relatedId: poolId,
        enterpriseId: enterprise.enterpriseId
      },
      createdAt: Timestamp.now()
    });
  }
  
  // 풀 상태를 'active'로 업데이트
  await updateDoc(doc(db, 'data_pools', poolId), {
    status: 'active',
    currentPhase: 'data_collection',
    lastUpdated: Timestamp.now()
  });
  
  console.log(`\n총 ${enterprises.length}개 기업 참여 완료`);
  console.log(`총 에스크로 금액: ${enterprises.reduce((sum, e) => sum + e.contributionAmount, 0)} XRP`);
  
  return results;
}

/**
 * 3단계: 사용자 참여 및 데이터 제공
 */
async function userDataProvisionPhase(db: any, client: Client) {
  console.log('\n========== 3단계: 사용자 데이터 제공 ==========\n');
  
  const users = scenario.participants.users;
  const poolId = scenario.dataPool.poolId;
  const results = [];
  
  for (const user of users) {
    console.log(`\n사용자 참여: ${user.nickname}`);
    
    // 사용자 지갑 생성
    const userWallet = await getOrCreateWallet(client);
    user.walletAddress = userWallet.address;
    
    // 사용자 정보 Firestore에 저장
    await setDoc(doc(db, 'users', user.userId), {
      ...user,
      stats: {
        totalDataPoints: 0,
        totalEarnings: 0,
        dataQualityAverage: 0
      },
      xrpl: {
        walletAddress: userWallet.address,
        balance: 0,
        totalEarned: 0
      },
      createdAt: Timestamp.now()
    });
    
    // 사용자 풀 참여 알림
    const joinTx = await client.autofill({
      TransactionType: 'Payment',
      Account: userWallet.address,
      Destination: userWallet.address,
      Amount: xrpToDrops(0.000001),
      Memos: [{
        Memo: {
          MemoData: convertStringToHex(JSON.stringify({
            type: 'pool_join',
            poolId,
            userId: user.userId,
            nickname: user.nickname
          }))
        }
      }]
    });
    
    const signedJoin = userWallet.sign(joinTx);
    const joinResult = await client.submitAndWait(signedJoin.tx_blob);
    
    console.log(`사용자 참여 트랜잭션: ${joinResult.result.hash}`);
    
    // 데이터 풀에 사용자 추가
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    const poolData = poolDoc.data();
    
    await updateDoc(poolRef, {
      'userParticipation.registeredUsers': poolData.userParticipation.registeredUsers + 1,
      'userParticipation.userList': [...poolData.userParticipation.userList, {
        userId: user.userId,
        nickname: user.nickname,
        joinedAt: Timestamp.now(),
        status: 'active'
      }],
      'lastUpdated': Timestamp.now()
    });
    
    results.push({
      userId: user.userId,
      nickname: user.nickname,
      walletAddress: userWallet.address,
      joinTxHash: joinResult.result.hash
    });
  }
  
  console.log(`\n총 ${users.length}명 사용자 참여 완료`);
  
  return results;
}

/**
 * 4단계: 데이터 제출 및 보상 지급
 */
async function dataSubmissionAndRewardPhase(db: any, client: Client, enterpriseWallets: any[]) {
  console.log('\n========== 4단계: 데이터 제출 및 보상 지급 ==========\n');
  
  const sampleData = scenario.sampleData;
  const results = [];
  
  for (const data of sampleData) {
    console.log(`\n데이터 제출: ${data.userId} - ${data.date}`);
    
    // 건강 데이터 Firestore에 저장
    await setDoc(doc(db, 'health_data', data.dataId), {
      ...data,
      timestamp: Timestamp.now(),
      createdAt: Timestamp.now()
    });
    
    // 사용자 정보 조회
    const userDoc = await getDoc(doc(db, 'users', data.userId));
    const user = userDoc.data();
    
    // 보상 계산
    const baseReward = scenario.expectedRewards.perDataPointBase;
    const qualityBonus = scenario.dataPool.requirements.qualityBonus[data.quality.grade];
    const totalReward = baseReward * qualityBonus;
    
    console.log(`품질 등급: ${data.quality.grade}, 기본 보상: ${baseReward} XRP, 보너스: x${qualityBonus}`);
    console.log(`총 보상: ${totalReward} XRP`);
    
    // 첫 번째 기업 지갑에서 보상 지급
    const payerWallet = await getOrCreateWallet(client, enterpriseWallets[0].walletSeed);
    const userWallet = Wallet.fromAddress(user.xrpl.walletAddress);
    
    // 보상 지급 트랜잭션
    const rewardTx = await client.autofill({
      TransactionType: 'Payment',
      Account: payerWallet.address,
      Destination: user.xrpl.walletAddress,
      Amount: xrpToDrops(totalReward),
      Memos: [{
        Memo: {
          MemoData: convertStringToHex(JSON.stringify({
            type: 'data_reward',
            dataId: data.dataId,
            userId: data.userId,
            dataType: data.dataType,
            qualityGrade: data.quality.grade,
            baseReward,
            qualityBonus,
            totalReward
          }))
        }
      }]
    });
    
    const signedReward = payerWallet.sign(rewardTx);
    const rewardResult = await client.submitAndWait(signedReward.tx_blob);
    
    console.log(`보상 지급 트랜잭션: ${rewardResult.result.hash}`);
    
    // 건강 데이터에 보상 정보 업데이트
    await updateDoc(doc(db, 'health_data', data.dataId), {
      reward: {
        baseReward,
        qualityBonus,
        totalReward,
        paidAt: Timestamp.now(),
        txHash: rewardResult.result.hash
      },
      lastUpdated: Timestamp.now()
    });
    
    // 사용자 통계 업데이트
    await updateDoc(doc(db, 'users', data.userId), {
      'stats.totalDataPoints': user.stats.totalDataPoints + 1,
      'stats.totalEarnings': user.stats.totalEarnings + totalReward,
      'xrpl.balance': user.xrpl.balance + totalReward,
      'xrpl.totalEarned': user.xrpl.totalEarned + totalReward,
      'lastUpdated': Timestamp.now()
    });
    
    results.push({
      dataId: data.dataId,
      userId: data.userId,
      qualityGrade: data.quality.grade,
      totalReward,
      txHash: rewardResult.result.hash
    });
    
    // 트랜잭션 기록 저장
    await addDoc(collection(db, 'transactions'), {
      txHash: rewardResult.result.hash,
      txType: 'data_reward',
      status: 'confirmed',
      transaction: {
        fromWallet: payerWallet.address,
        toWallet: user.xrpl.walletAddress,
        amount: totalReward,
        fee: 0.012,
        memo: `Reward for ${data.dataType} data on ${data.date}`,
        sequence: (signedReward as any).tx_json?.Sequence,
        ledgerIndex: rewardResult.result.ledger_index
      },
      businessContext: {
        purpose: 'data_reward',
        relatedType: 'health_data',
        relatedId: data.dataId,
        userId: data.userId
      },
      createdAt: Timestamp.now()
    });
  }
  
  console.log(`\n총 ${sampleData.length}개 데이터에 대한 보상 지급 완료`);
  
  return results;
}

/**
 * 5단계: 데이터 풀 NFT 발행
 */
async function mintPoolNFTPhase(db: any, client: Client, platformWallet: Wallet, enterpriseWallets: any[]) {
  console.log('\n========== 5단계: 데이터 풀 NFT 발행 ==========\n');
  
  const poolId = scenario.dataPool.poolId;
  const results = [];
  
  for (const enterprise of enterpriseWallets) {
    console.log(`\nNFT 발행 대상: ${enterprise.companyName}`);
    
    // NFT 메타데이터 생성
    const metadata = {
      name: `SportiQue Data Pool NFT - ${poolId}`,
      description: `데이터 풀 ${poolId} 참여 및 접근 권한 NFT`,
      image: 'https://api.sportique.biz/nft/pool-glucose.png',
      attributes: {
        poolId,
        dataType: scenario.dataPool.dataType,
        enterpriseId: enterprise.enterpriseId,
        companyName: enterprise.companyName,
        sharePercentage: enterprise.sharePercentage,
        dataPoints: scenario.sampleData.length,
        qualityAverage: 91.5,
        accessLevel: 'full',
        validUntil: '2026-12-31'
      }
    };
    
    const metadataURI = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;
    
    // NFT 발행 트랜잭션
    const nftTx = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: platformWallet.address,
      NFTokenTaxon: 2, // Pool NFT taxon
      Flags: 8, // Transferable
      TransferFee: 500, // 0.5% royalty
      URI: convertStringToHex(metadataURI),
      Memos: [{
        Memo: {
          MemoData: convertStringToHex(JSON.stringify({
            type: 'pool_nft',
            poolId,
            enterpriseId: enterprise.enterpriseId
          }))
        }
      }]
    });
    
    const signedNFT = platformWallet.sign(nftTx);
    const nftResult = await client.submitAndWait(signedNFT.tx_blob);
    
    console.log(`NFT 발행 트랜잭션: ${nftResult.result.hash}`);
    
    // NFT ID 추출
    const nftMeta = nftResult.result.meta;
    let nftId = '';
    
    if (nftMeta && typeof nftMeta === 'object' && 'CreatedNode' in nftMeta) {
      const createdNodes = (nftMeta as any).CreatedNode || [];
      for (const node of createdNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'NFTokenPage') {
          const nfts = node.CreatedNode?.NewFields?.NFTokens || [];
          if (nfts.length > 0) {
            nftId = nfts[0].NFToken.NFTokenID;
          }
        }
      }
    }
    
    console.log(`발행된 NFT ID: ${nftId || '추출 실패'}`);
    
    // NFT 전송 (기업 지갑으로)
    if (nftId) {
      const enterpriseWallet = await getOrCreateWallet(client, enterprise.walletSeed);
      
      // NFT Offer 생성 (0 XRP로 무료 전송)
      const offerTx = await client.autofill({
        TransactionType: 'NFTokenCreateOffer',
        Account: platformWallet.address,
        NFTokenID: nftId,
        Destination: enterpriseWallet.address,
        Amount: '0',
        Flags: 1 // Sell offer
      });
      
      const signedOffer = platformWallet.sign(offerTx);
      const offerResult = await client.submitAndWait(signedOffer.tx_blob);
      
      console.log(`NFT 전송 오퍼 트랜잭션: ${offerResult.result.hash}`);
    }
    
    results.push({
      enterpriseId: enterprise.enterpriseId,
      companyName: enterprise.companyName,
      nftId: nftId || 'N/A',
      mintTxHash: nftResult.result.hash
    });
    
    // NFT 정보 Firestore에 저장
    await addDoc(collection(db, 'pool_nfts'), {
      nftId,
      poolId,
      enterpriseId: enterprise.enterpriseId,
      companyName: enterprise.companyName,
      sharePercentage: enterprise.sharePercentage,
      metadata,
      mintTxHash: nftResult.result.hash,
      status: 'minted',
      createdAt: Timestamp.now()
    });
  }
  
  console.log(`\n총 ${enterpriseWallets.length}개 NFT 발행 완료`);
  
  return results;
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('========================================');
  console.log('  SportiQue 데이터 풀 시나리오 실행');
  console.log('========================================\n');
  
  // Firebase 초기화
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  
  // XRPL 클라이언트 연결
  const client = new Client(TESTNET_URL);
  await client.connect();
  console.log('XRPL 테스트넷 연결 완료\n');
  
  // 실행 결과 저장용 객체
  const executionResults = {
    timestamp: new Date().toISOString(),
    network: 'XRPL Testnet',
    scenario: scenario.scenarioName,
    phases: {} as any
  };
  
  try {
    // 1단계: 데이터 풀 생성
    const phase1 = await createDataPoolPhase(db, client);
    executionResults.phases.poolCreation = {
      platformWallet: phase1.platformWallet.address,
      txHash: phase1.poolCreationTxHash
    };
    
    // 2단계: 기업 참여
    const phase2 = await enterpriseParticipationPhase(db, client, phase1.platformWallet);
    executionResults.phases.enterpriseParticipation = phase2;
    
    // 3단계: 사용자 참여
    const phase3 = await userDataProvisionPhase(db, client);
    executionResults.phases.userParticipation = phase3;
    
    // 4단계: 데이터 제출 및 보상
    const phase4 = await dataSubmissionAndRewardPhase(db, client, scenario.participants.enterprises);
    executionResults.phases.dataRewards = phase4;
    
    // 5단계: NFT 발행
    const phase5 = await mintPoolNFTPhase(db, client, phase1.platformWallet, scenario.participants.enterprises);
    executionResults.phases.nftMinting = phase5;
    
    // 결과 요약
    console.log('\n========== 실행 결과 요약 ==========\n');
    console.log(`데이터 풀 ID: ${scenario.dataPool.poolId}`);
    console.log(`참여 기업: ${scenario.participants.enterprises.length}개`);
    console.log(`참여 사용자: ${scenario.participants.users.length}명`);
    console.log(`처리된 데이터: ${scenario.sampleData.length}개`);
    console.log(`발행된 NFT: ${phase5.length}개`);
    
    // 트랜잭션 해시 목록
    console.log('\n========== 트랜잭션 해시 목록 ==========\n');
    console.log('데이터 풀 생성:', executionResults.phases.poolCreation.txHash);
    console.log('\n기업 참여 (에스크로):');
    phase2.forEach(e => {
      console.log(`  - ${e.companyName}: ${e.escrowTxHash}`);
    });
    console.log('\n사용자 참여:');
    phase3.forEach(u => {
      console.log(`  - ${u.nickname}: ${u.joinTxHash}`);
    });
    console.log('\n데이터 보상:');
    phase4.forEach(r => {
      console.log(`  - ${r.userId} (${r.qualityGrade}급): ${r.txHash}`);
    });
    console.log('\nNFT 발행:');
    phase5.forEach(n => {
      console.log(`  - ${n.companyName}: ${n.mintTxHash}`);
    });
    
    // 결과 파일 저장
    const resultsPath = path.join(__dirname, '../../data/results/datapool_execution_results.json');
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
    fs.writeFileSync(resultsPath, JSON.stringify(executionResults, null, 2));
    
    console.log(`\n실행 결과가 저장되었습니다: ${resultsPath}`);
    
  } catch (error) {
    console.error('실행 중 오류 발생:', error);
    throw error;
  } finally {
    // XRPL 클라이언트 연결 종료
    await client.disconnect();
    console.log('\nXRPL 테스트넷 연결 종료');
  }
  
  console.log('\n========== 데이터 풀 시나리오 완료 ==========');
}

// 스크립트 실행
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ 모든 작업이 성공적으로 완료되었습니다.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ 실행 실패:', error);
      process.exit(1);
    });
}
