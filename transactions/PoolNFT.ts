/**
 * SportiQue - 풀 NFT 발행 트랜잭션
 * 
 * 데이터 풀이 완료된 후 참여 기업에게 NFT를 발행하는 트랜잭션
 */

import { Client, Wallet, convertStringToHex } from 'xrpl';
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
 * 풀 NFT 발행 함수
 * 
 * @param platformWallet 플랫폼 지갑 정보 (NFT 발행자)
 * @param enterpriseWallet 기업 지갑 정보 (NFT 수신자)
 * @param poolId 데이터 풀 ID
 * @param enterpriseId 기업 ID
 * @returns 트랜잭션 결과
 */
export async function issuePoolNFT(
  platformWallet: { address: string, seed: string },
  enterpriseWallet: { address: string },
  poolId: string,
  enterpriseId: string
): Promise<any> {
  try {
    console.log(`Issuing pool NFT for pool ${poolId} to enterprise ${enterpriseId}...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑 생성
    const wallet = Wallet.fromSeed(platformWallet.seed);
    
    // 데이터 풀 정보 조회 (Firebase에서)
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    
    if (!poolDoc.exists()) {
      throw new Error(`Data pool ${poolId} not found`);
    }
    
    const pool = poolDoc.data();
    console.log(`Data pool found: ${pool.name}`);
    
    // 데이터 풀 상태 확인
    if (pool.status !== 'completed') {
      throw new Error(`Cannot issue NFT for pool with status: ${pool.status}`);
    }
    
    // 기업 참여 확인
    const enterpriseParticipation = pool.consortium.participatingEnterprises.find(
      (p: any) => p.enterpriseId === enterpriseId
    );
    
    if (!enterpriseParticipation) {
      throw new Error(`Enterprise ${enterpriseId} is not participating in this pool`);
    }
    
    // 기업 정보 조회
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    const enterpriseDoc = await getDoc(enterpriseRef);
    
    if (!enterpriseDoc.exists()) {
      throw new Error(`Enterprise ${enterpriseId} not found`);
    }
    
    const enterprise = enterpriseDoc.data();
    
    // NFT URI 생성 (실제로는 IPFS나 다른 저장소에 메타데이터를 저장하고 URI를 사용해야 함)
    const nftURI = `https://sportique.biz/nft/pool/${poolId}/${enterpriseId}`;
    
    // NFT 메타데이터
    const nftMetadata = {
      name: `${pool.name} 데이터 풀 NFT`,
      description: `${pool.dataType} 데이터 풀 참여 NFT (${enterpriseParticipation.sharePercentage.toFixed(2)}% 지분)`,
      dataType: pool.dataType,
      period: `${new Date(pool.schedule.activeStartDate.toDate()).toISOString().slice(0, 10)} ~ ${new Date(pool.schedule.activeEndDate.toDate()).toISOString().slice(0, 10)}`,
      participants: pool.userParticipation.registeredUsers,
      completedUsers: pool.userParticipation.completedUsers,
      qualityAverage: pool.userParticipation.qualityAverage,
      sharePercentage: enterpriseParticipation.sharePercentage
    };
    
    // NFT 발행 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: wallet.address,
      URI: convertStringToHex(nftURI),
      NFTokenTaxon: 2001, // 풀 NFT 분류
      Flags: 1, // tfTransferable
      TransferFee: 1000, // 10%
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'pool_nft',
            poolId,
            enterpriseId,
            metadata: nftMetadata
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
    
    if (!result.result.meta || typeof result.result.meta === 'string' || result.result.meta.TransactionResult !== 'tesSUCCESS') {
      const code = typeof result.result.meta === 'string' ? result.result.meta : (result.result.meta?.TransactionResult ?? 'unknown');
      throw new Error(`Transaction failed: ${code}`);
    }
    
    // NFT ID 추출
    const meta = result.result.meta as any;
    const nftID = meta && typeof meta !== 'string' && meta.nftoken_id ? meta.nftoken_id : undefined;
    if (!nftID) {
      throw new Error('NFT mint did not return nftoken_id in meta');
    }
    console.log(`NFT minted with ID: ${nftID}`);
    
    // NFT 전송 트랜잭션 준비
    const transferPrepared = await client.autofill({
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nftID,
      Destination: enterpriseWallet.address,
      Amount: '0',
      Flags: 1 // tfSellNFToken
    });
    
    // 트랜잭션 서명
    const transferSigned = wallet.sign(transferPrepared);
    console.log('Transfer transaction signed');
    
    // 트랜잭션 제출
    const transferResult = await client.submitAndWait(transferSigned.tx_blob);
    console.log('Transfer transaction submitted and validated');
    
    if (!transferResult.result.meta || typeof transferResult.result.meta === 'string' || transferResult.result.meta.TransactionResult !== 'tesSUCCESS') {
      const code = typeof transferResult.result.meta === 'string' ? transferResult.result.meta : (transferResult.result.meta?.TransactionResult ?? 'unknown');
      throw new Error(`Transfer transaction failed: ${code}`);
    }
    
    // 클라이언트 연결 종료
    await client.disconnect();
    console.log('Disconnected from XRPL Testnet');
    
    // 트랜잭션 해시
    const txHash = result.result.hash;
    const transferTxHash = transferResult.result.hash;
    console.log(`Transactions successful with hashes: ${txHash}, ${transferTxHash}`);
    
    // NFT ID 생성
    const nftId = `nft_pool_${poolId}_${enterpriseId}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    const tokenId = `POOL_NFT_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}_${pool.dataType.toUpperCase()}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    
    // Firebase에 NFT 정보 저장
    const nftData = {
      nftId,
      tokenId,
      type: 'pool',
      
      ownership: {
        currentOwner: enterpriseId,
        originalOwner: enterpriseId,
        transferHistory: []
      },
      
      source: {
        sourceType: 'data_pool',
        sourceId: poolId,
        enterpriseId,
        enterpriseName: enterprise.companyName,
        sharePercentage: enterpriseParticipation.sharePercentage
      },
      
      metadata: nftMetadata,
      
      valuation: {
        originalValue: enterpriseParticipation.contributionAmount,
        currentValue: enterpriseParticipation.contributionAmount,
        qualityMultiplier: pool.userParticipation.qualityAverage >= 85 ? 1.5 : (pool.userParticipation.qualityAverage >= 70 ? 1.0 : 0.7),
        marketValue: enterpriseParticipation.contributionAmount * (pool.userParticipation.qualityAverage >= 85 ? 1.5 : (pool.userParticipation.qualityAverage >= 70 ? 1.0 : 0.7))
      },
      
      dataAccess: {
        accessLevel: 'aggregate',
        allowedOperations: ['read', 'analyze', 'export'],
        restrictions: ['no_redistribution', 'research_only'],
        expiryDate: new Date(pool.schedule.activeEndDate.toDate().getTime() + (365 * 24 * 60 * 60 * 1000)) // 1년 후 만료
      },
      
      xrpl: {
        tokenTaxon: 2001,
        issuer: wallet.address,
        mintTxHash: txHash,
        transferTxHash,
        nftID,
        transferFee: 1000,
        flags: ['tfTransferable']
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    };
    
    // Firestore에 NFT 정보 저장
    const nftRef = await addDoc(collection(db, 'nfts'), nftData);
    console.log(`NFT document created with ID: ${nftRef.id}`);
    
    // 데이터 풀 정보 업데이트
    await updateDoc(poolRef, {
      'nftCollection.totalCollected': pool.nftCollection.totalCollected + 1,
      'nftCollection.collectedNFTs': [...(pool.nftCollection.collectedNFTs || []), {
        nftId,
        enterpriseId,
        issuedAt: Timestamp.now()
      }],
      'lastUpdated': Timestamp.now()
    });
    console.log(`Data pool ${poolId} updated with NFT information`);
    
    // 기업 통계 업데이트
    await updateDoc(enterpriseRef, {
      'stats.totalNFTsOwned': enterprise.stats.totalNFTsOwned + 1,
      'lastUpdated': Timestamp.now()
    });
    console.log(`Enterprise statistics updated for ${enterpriseId}`);
    
    // 트랜잭션 정보 저장
    const transactionData = {
      txHash,
      txType: 'pool_nft_issuance',
      status: 'confirmed',
      
      transaction: {
        fromWallet: wallet.address,
        toWallet: enterpriseWallet.address,
        amount: 0,
        fee: 0.012,
        memo: `Pool NFT issuance for ${poolId} to ${enterpriseId}`,
        sequence: (signed as any).tx_json?.Sequence,
        ledgerIndex: result.result.ledger_index
      },
      
      businessContext: {
        purpose: 'nft_issuance',
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
      transferTxHash,
      nftId,
      tokenId,
      nftID,
      poolId,
      enterpriseId
    };
  } catch (error) {
    console.error('Error issuing pool NFT:', error);
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
async function testPoolNFT() {
  // 테스트 지갑 정보 (실제 구현에서는 안전하게 관리해야 함)
  const platformWallet = {
    address: 'rSportiQueAdmin123456789ABCDEF',
    seed: 's3cr3t5e3dAdmin123456789ABCDEF'
  };
  
  const enterpriseWallet = {
    address: 'rEnterprise123456789ABCDEF'
  };
  
  // 테스트 파라미터
  const poolId = 'pool_glucose_202509';
  const enterpriseId = 'enterprise_123456';
  
  // 풀 NFT 발행
  const result = await issuePoolNFT(
    platformWallet,
    enterpriseWallet,
    poolId,
    enterpriseId
  );
  
  console.log('Pool NFT issuance result:', result);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testPoolNFT()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
