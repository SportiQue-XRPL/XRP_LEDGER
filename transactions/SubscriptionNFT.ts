/**
 * SportiQue - 구독 NFT 발행 트랜잭션
 * 
 * 구독 계약이 완료된 후 기업에게 NFT를 발행하는 트랜잭션
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
 * 구독 NFT 발행 함수
 * 
 * @param platformWallet 플랫폼 지갑 정보 (NFT 발행자)
 * @param enterpriseWallet 기업 지갑 정보 (NFT 수신자)
 * @param subscriptionId 구독 ID
 * @returns 트랜잭션 결과
 */
export async function issueSubscriptionNFT(
  platformWallet: { address: string, seed: string },
  enterpriseWallet: { address: string },
  subscriptionId: string
): Promise<any> {
  try {
    console.log(`Issuing subscription NFT for subscription ${subscriptionId}...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑 생성
    const wallet = Wallet.fromSeed(platformWallet.seed);
    
    // 구독 정보 조회 (Firebase에서)
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (!subscriptionDoc.exists()) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    const subscription = subscriptionDoc.data();
    console.log(`Subscription found: ${subscriptionId}`);
    
    // 구독 상태 확인
    if (subscription.status !== 'active') {
      throw new Error(`Cannot issue NFT for subscription with status: ${subscription.status}`);
    }
    
    // 사용자 정보 조회
    const userRef = doc(db, 'users', subscription.userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${subscription.userId} not found`);
    }
    
    const user = userDoc.data();
    
    // NFT URI 생성 (실제로는 IPFS나 다른 저장소에 메타데이터를 저장하고 URI를 사용해야 함)
    const nftURI = `https://sportique.biz/nft/subscription/${subscriptionId}`;
    
    // NFT 메타데이터
    const nftMetadata = {
      name: `${user.profile.displayName} 건강데이터 구독 NFT`,
      description: `${subscription.contract.duration}일간 ${subscription.requirements.dataTypes.map((dt: any) => dt.type).join('/')} 데이터 구독 NFT`,
      dataType: subscription.requirements.dataTypes.map((dt: any) => dt.type).join(', '),
      period: `${new Date(subscription.contract.startDate.toDate()).toISOString().slice(0, 10)} ~ ${new Date(subscription.contract.endDate.toDate()).toISOString().slice(0, 10)}`,
      quality: user.dataQuality.currentGrade,
      totalRecords: subscription.stats.totalDataPoints,
      averageQuality: subscription.stats.averageQuality || user.dataQuality.qualityScore
    };
    
    // NFT 발행 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: wallet.address,
      URI: convertStringToHex(nftURI),
      NFTokenTaxon: 1001, // 구독 NFT 분류
      Flags: 1, // tfTransferable
      TransferFee: 1000, // 10%
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'subscription_nft',
            subscriptionId,
            userId: subscription.userId,
            enterpriseId: subscription.enterpriseId,
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
    
    // 클라이언트 연결 종료
    await client.disconnect();
    console.log('Disconnected from XRPL Testnet');
    
    if (!transferResult.result.meta || typeof transferResult.result.meta === 'string' || transferResult.result.meta.TransactionResult !== 'tesSUCCESS') {
      const code = typeof transferResult.result.meta === 'string' ? transferResult.result.meta : (transferResult.result.meta?.TransactionResult ?? 'unknown');
      throw new Error(`Transfer transaction failed: ${code}`);
    }
    
    // 트랜잭션 해시
    const txHash = result.result.hash;
    const transferTxHash = transferResult.result.hash;
    console.log(`Transactions successful with hashes: ${txHash}, ${transferTxHash}`);
    
    // NFT ID 생성
    const nftId = `nft_sub_${subscriptionId}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    const tokenId = `SUB_NFT_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}_USER${subscription.userId.substring(5)}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    
    // Firebase에 NFT 정보 저장
    const nftData = {
      nftId,
      tokenId,
      type: 'subscription',
      
      ownership: {
        currentOwner: subscription.enterpriseId,
        originalOwner: subscription.enterpriseId,
        transferHistory: []
      },
      
      source: {
        sourceType: 'subscription',
        sourceId: subscriptionId,
        userId: subscription.userId,
        userName: user.profile.displayName,
        enterpriseId: subscription.enterpriseId
      },
      
      metadata: nftMetadata,
      
      valuation: {
        originalValue: subscription.escrow.totalAmount,
        currentValue: subscription.escrow.totalAmount,
        qualityMultiplier: user.dataQuality.currentGrade === 'A' ? 1.5 : (user.dataQuality.currentGrade === 'B' ? 1.0 : 0.7),
        marketValue: subscription.escrow.totalAmount * (user.dataQuality.currentGrade === 'A' ? 1.5 : (user.dataQuality.currentGrade === 'B' ? 1.0 : 0.7))
      },
      
      dataAccess: {
        accessLevel: 'full',
        allowedOperations: ['read', 'analyze', 'export'],
        restrictions: ['no_redistribution', 'research_only'],
        expiryDate: new Date(subscription.contract.endDate.toDate().getTime() + (365 * 24 * 60 * 60 * 1000)) // 1년 후 만료
      },
      
      xrpl: {
        tokenTaxon: 1001,
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
    
    // 구독 정보 업데이트
    await updateDoc(subscriptionRef, {
      'nft.nftId': nftId,
      'nft.issuedAt': Timestamp.now(),
      'lastUpdated': Timestamp.now()
    });
    console.log(`Subscription ${subscriptionId} updated with NFT information`);
    
    // 기업 통계 업데이트
    const enterpriseRef = doc(db, 'enterprises', subscription.enterpriseId);
    await updateDoc(enterpriseRef, {
      'stats.totalNFTsOwned': 1, // 실제로는 increment 연산을 사용해야 함
      'lastUpdated': Timestamp.now()
    });
    console.log(`Enterprise statistics updated for ${subscription.enterpriseId}`);
    
    // 트랜잭션 정보 저장
    const transactionData = {
      txHash,
      txType: 'subscription_nft_issuance',
      status: 'confirmed',
      
      transaction: {
        fromWallet: wallet.address,
        toWallet: enterpriseWallet.address,
        amount: 0,
        fee: 0.012,
        memo: `Subscription NFT issuance for ${subscriptionId}`,
        sequence: (signed as any).tx_json?.Sequence,
        ledgerIndex: result.result.ledger_index
      },
      
      businessContext: {
        purpose: 'nft_issuance',
        relatedType: 'subscription',
        relatedId: subscriptionId,
        enterpriseId: subscription.enterpriseId,
        userId: subscription.userId
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
      subscriptionId
    };
  } catch (error) {
    console.error('Error issuing subscription NFT:', error);
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
async function testSubscriptionNFT() {
  // 테스트 지갑 정보 (실제 구현에서는 안전하게 관리해야 함)
  const platformWallet = {
    address: 'rSportiQueAdmin123456789ABCDEF',
    seed: 's3cr3t5e3dAdmin123456789ABCDEF'
  };
  
  const enterpriseWallet = {
    address: 'rEnterprise123456789ABCDEF'
  };
  
  // 테스트 파라미터
  const subscriptionId = 'subscription_123456';
  
  // 구독 NFT 발행
  const result = await issueSubscriptionNFT(
    platformWallet,
    enterpriseWallet,
    subscriptionId
  );
  
  console.log('Subscription NFT issuance result:', result);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testSubscriptionNFT()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
