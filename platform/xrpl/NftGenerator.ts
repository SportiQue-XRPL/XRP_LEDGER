/**
 * SportiQue - NFT 생성 및 관리 기능
 * 
 * XRPL NFT 생성, 전송, 조회를 담당하는 모듈
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';
import { connectXrplClient, decryptSeed } from './XrplWallet';
import { doc, collection, addDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getUserInfo } from '../user/UserAuth';
import { getEnterpriseInfo } from '../enterprise/EnterpriseAuth';

/**
 * 구독 NFT 생성 함수
 * 
 * @param enterpriseId 기업 ID
 * @param userId 사용자 ID
 * @param subscriptionId 구독 ID
 * @param totalRecords 총 레코드 수
 * @param qualityDistribution 품질 분포
 * @returns 생성된 NFT 정보
 */
export const generateSubscriptionNFT = async (
  enterpriseId: string,
  userId: string,
  subscriptionId: string,
  totalRecords: number,
  qualityDistribution: { A: number, B: number, C: number }
): Promise<{ nftId: string, tokenId: string }> => {
  try {
    // 기업 정보 조회
    const enterpriseData = await getEnterpriseInfo(enterpriseId);
    
    // 사용자 정보 조회
    const userData = await getUserInfo(userId);
    
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 품질 등급 계산
    let quality = 'C';
    const totalQualityPoints = qualityDistribution.A * 3 + qualityDistribution.B * 2 + qualityDistribution.C * 1;
    const averageQuality = totalQualityPoints / totalRecords;
    
    if (averageQuality >= 2.5) {
      quality = 'A';
    } else if (averageQuality >= 1.5) {
      quality = 'B';
    }
    
    // NFT ID 생성
    const nftId = `nft_sub_${enterpriseId.split('_')[1]}_${userId.split('_')[1]}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    const tokenId = `SUB_NFT_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}_${userId.split('_')[1].toUpperCase()}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    
    // 지갑 정보 조회
    const walletRef = doc(db, 'enterprises', enterpriseId, 'wallets', 'wallet_master');
    const walletDoc = await getDoc(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error('지갑 정보를 찾을 수 없습니다.');
    }
    
    const walletData = walletDoc.data();
    
    // 시드 복호화
    const seed = decryptSeed(walletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // XRPL NFT 발행 (실제로는 XRPL API를 사용하여 NFT를 발행해야 함)
    const client = await connectXrplClient();
    
    // NFTokenMint 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: wallet.address,
      NFTokenTaxon: 1001, // 구독 NFT 유형
      URI: Buffer.from(`https://sportique.io/nft/${nftId}`).toString('hex'),
      Flags: 1, // tfTransferable
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'subscription',
            subscriptionId,
            userId,
            enterpriseId,
            quality,
            totalRecords,
            period: `${subscription.contract.startDate} ~ ${subscription.contract.endDate}`
          }), 'utf8').toString('hex')
        }
      }]
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`NFT 발행 실패: ${result.result.meta.TransactionResult}`);
    }
    
    // NFT 정보 저장
    await addDoc(collection(db, 'nfts'), {
      nftId,
      tokenId,
      type: 'subscription',
      
      ownership: {
        currentOwner: enterpriseId,
        originalOwner: enterpriseId,
        transferHistory: []
      },
      
      source: {
        sourceType: 'subscription',
        sourceId: subscriptionId,
        userId,
        userName: userData.profile.displayName,
        enterpriseId
      },
      
      metadata: {
        name: `${userData.profile.displayName} 건강데이터 구독 NFT`,
        description: `${subscription.contract.duration}일간 ${subscription.requirements.dataTypes.map((dt: any) => dt.type).join('/')} 데이터 구독 NFT`,
        dataType: subscription.requirements.dataTypes.map((dt: any) => dt.type).join(', '),
        period: `${new Date(subscription.contract.startDate.seconds * 1000).toISOString().split('T')[0]} ~ ${new Date(subscription.contract.endDate.seconds * 1000).toISOString().split('T')[0]}`,
        quality,
        totalRecords,
        averageQuality: averageQuality.toFixed(1)
      },
      
      valuation: {
        originalValue: subscription.escrow.totalAmount,
        currentValue: subscription.escrow.totalAmount,
        qualityMultiplier: quality === 'A' ? 1.5 : (quality === 'B' ? 1.0 : 0.7),
        marketValue: subscription.escrow.totalAmount * (quality === 'A' ? 1.5 : (quality === 'B' ? 1.0 : 0.7))
      },
      
      dataAccess: {
        accessLevel: 'full',
        allowedOperations: ['read', 'analyze', 'export'],
        restrictions: ['no_redistribution', 'research_only'],
        expiryDate: Timestamp.fromDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))
      },
      
      xrpl: {
        tokenTaxon: 1001,
        issuer: wallet.address,
        mintTxHash: result.result.hash,
        transferFee: 1000,
        flags: ['tfTransferable']
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    // 구독 정보 업데이트
    await updateDoc(subscriptionSnapshot.docs[0].ref, {
      'nft.nftId': nftId,
      'lastUpdated': Timestamp.now()
    });
    
    // 기업 통계 업데이트
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      'stats.totalNFTsOwned': enterpriseData.stats.totalNFTsOwned + 1,
      'lastUpdated': Timestamp.now()
    });
    
    return { nftId, tokenId };
  } catch (error) {
    console.error('구독 NFT 생성 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 NFT 생성 함수
 * 
 * @param enterpriseId 기업 ID
 * @param poolId 데이터 풀 ID
 * @param poolName 데이터 풀 이름
 * @param sharePercentage 지분 비율
 * @param participants 참여자 수
 * @returns 생성된 NFT 정보
 */
export const generatePoolNFT = async (
  enterpriseId: string,
  poolId: string,
  poolName: string,
  sharePercentage: number,
  participants: number
): Promise<{ nftId: string, tokenId: string }> => {
  try {
    // 기업 정보 조회
    const enterpriseData = await getEnterpriseInfo(enterpriseId);
    
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 기업 참여 정보 확인
    const enterpriseParticipation = pool.consortium.participatingEnterprises.find(
      (p: any) => p.enterpriseId === enterpriseId
    );
    
    if (!enterpriseParticipation) {
      throw new Error('해당 데이터 풀에 참여하지 않은 기업입니다.');
    }
    
    // NFT ID 생성
    const nftId = `nft_pool_${poolId.split('_')[2]}_${new Date().toISOString().slice(0, 7).replace('-', '')}_${enterpriseId.split('_')[1]}`;
    const tokenId = `POOL_NFT_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}_${poolId.split('_')[2].toUpperCase()}_${new Date().toISOString().slice(0, 7).replace('-', '')}_${enterpriseId.split('_')[1].toUpperCase()}`;
    
    // 지갑 정보 조회
    const walletRef = doc(db, 'enterprises', enterpriseId, 'wallets', 'wallet_master');
    const walletDoc = await getDoc(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error('지갑 정보를 찾을 수 없습니다.');
    }
    
    const walletData = walletDoc.data();
    
    // 시드 복호화
    const seed = decryptSeed(walletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // XRPL NFT 발행 (실제로는 XRPL API를 사용하여 NFT를 발행해야 함)
    const client = await connectXrplClient();
    
    // NFTokenMint 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'NFTokenMint',
      Account: wallet.address,
      NFTokenTaxon: 2001, // 풀 NFT 유형
      URI: Buffer.from(`https://sportique.io/nft/${nftId}`).toString('hex'),
      Flags: 1, // tfTransferable
      Memos: [{
        Memo: {
          MemoData: Buffer.from(JSON.stringify({
            type: 'pool',
            poolId,
            enterpriseId,
            sharePercentage,
            participants
          }), 'utf8').toString('hex')
        }
      }]
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`NFT 발행 실패: ${result.result.meta.TransactionResult}`);
    }
    
    // NFT 정보 저장
    await addDoc(collection(db, 'nfts'), {
      nftId,
      tokenId,
      type: 'pool',
      
      ownership: {
        currentOwner: enterpriseId,
        originalOwner: enterpriseId,
        transferHistory: []
      },
      
      source: {
        sourceType: 'pool',
        sourceId: poolId,
        poolName,
        enterpriseId,
        sharePercentage
      },
      
      metadata: {
        name: `${poolName} NFT (${sharePercentage.toFixed(1)}% 지분)`,
        description: `${participants}명 참여자의 ${pool.dataType} 데이터 집계 NFT`,
        dataType: pool.dataType,
        period: `${new Date(pool.schedule.activeStartDate.seconds * 1000).toISOString().split('T')[0]} ~ ${new Date(pool.schedule.activeEndDate.seconds * 1000).toISOString().split('T')[0]}`,
        participants,
        totalRecords: pool.userParticipation.registeredUsers * 30, // 예상 레코드 수
        averageQuality: pool.userParticipation.qualityAverage || 4.0
      },
      
      valuation: {
        originalInvestment: enterpriseParticipation.contributionAmount,
        sharePercentage,
        totalPoolValue: pool.consortium.totalContribution,
        currentValue: enterpriseParticipation.contributionAmount
      },
      
      dataAccess: {
        accessLevel: 'aggregated',
        allowedOperations: ['read', 'analyze', 'export', 'research'],
        restrictions: ['no_individual_identification'],
        expiryDate: Timestamp.fromDate(new Date(new Date().setFullYear(new Date().getFullYear() + 2)))
      },
      
      xrpl: {
        tokenTaxon: 2001,
        issuer: wallet.address,
        mintTxHash: result.result.hash,
        transferFee: 1000,
        flags: ['tfTransferable']
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    // 기업 통계 업데이트
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      'stats.totalNFTsOwned': enterpriseData.stats.totalNFTsOwned + 1,
      'lastUpdated': Timestamp.now()
    });
    
    return { nftId, tokenId };
  } catch (error) {
    console.error('데이터 풀 NFT 생성 오류:', error);
    throw error;
  }
};

/**
 * NFT 전송 함수
 * 
 * @param nftId NFT ID
 * @param fromEnterpriseId 보내는 기업 ID
 * @param toEnterpriseId 받는 기업 ID
 * @returns 트랜잭션 해시
 */
export const transferNFT = async (
  nftId: string,
  fromEnterpriseId: string,
  toEnterpriseId: string
): Promise<string> => {
  try {
    // NFT 정보 조회
    const nftsRef = collection(db, 'nfts');
    const nftQuery = query(nftsRef, where('nftId', '==', nftId));
    const nftSnapshot = await getDocs(nftQuery);
    
    if (nftSnapshot.empty) {
      throw new Error('NFT 정보를 찾을 수 없습니다.');
    }
    
    const nftDocRef = nftSnapshot.docs[0].ref;
    const nft = nftSnapshot.docs[0].data();
    
    // 소유권 확인
    if (nft.ownership.currentOwner !== fromEnterpriseId) {
      throw new Error('NFT의 소유자가 아닙니다.');
    }
    
    // 보내는 기업 지갑 정보 조회
    const fromWalletRef = doc(db, 'enterprises', fromEnterpriseId, 'wallets', 'wallet_master');
    const fromWalletDoc = await getDoc(fromWalletRef);
    
    if (!fromWalletDoc.exists()) {
      throw new Error('보내는 기업의 지갑 정보를 찾을 수 없습니다.');
    }
    
    const fromWalletData = fromWalletDoc.data();
    
    // 받는 기업 정보 조회
    const toEnterpriseData = await getEnterpriseInfo(toEnterpriseId);
    
    // 시드 복호화
    const seed = decryptSeed(fromWalletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // XRPL NFT 전송 (실제로는 XRPL API를 사용하여 NFT를 전송해야 함)
    const client = await connectXrplClient();
    
    // NFTokenCreateOffer 트랜잭션 준비 (판매 오퍼)
    const sellOfferPrepared = await client.autofill({
      TransactionType: 'NFTokenCreateOffer',
      Account: wallet.address,
      NFTokenID: nft.xrpl.tokenId,
      Amount: xrpToDrops(nft.valuation.currentValue),
      Destination: toEnterpriseData.xrpl.masterWallet,
      Flags: 1 // tfSellToken
    });
    
    // 트랜잭션 서명
    const sellOfferSigned = wallet.sign(sellOfferPrepared);
    
    // 트랜잭션 제출
    const sellOfferResult = await client.submitAndWait(sellOfferSigned.tx_blob);
    
    if (sellOfferResult.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`NFT 판매 오퍼 생성 실패: ${sellOfferResult.result.meta.TransactionResult}`);
    }
    
    // NFT 소유권 업데이트
    await updateDoc(nftDocRef, {
      'ownership.currentOwner': toEnterpriseId,
      'ownership.transferHistory': arrayUnion({
        fromOwner: fromEnterpriseId,
        toOwner: toEnterpriseId,
        transferredAt: Timestamp.now(),
        txHash: sellOfferResult.result.hash
      }),
      'lastUpdated': Timestamp.now()
    });
    
    // 보내는 기업 통계 업데이트
    const fromEnterpriseRef = doc(db, 'enterprises', fromEnterpriseId);
    const fromEnterpriseDoc = await getDoc(fromEnterpriseRef);
    
    if (fromEnterpriseDoc.exists()) {
      const fromEnterpriseData = fromEnterpriseDoc.data();
      await updateDoc(fromEnterpriseRef, {
        'stats.totalNFTsOwned': fromEnterpriseData.stats.totalNFTsOwned - 1,
        'lastUpdated': Timestamp.now()
      });
    }
    
    // 받는 기업 통계 업데이트
    await updateDoc(doc(db, 'enterprises', toEnterpriseId), {
      'stats.totalNFTsOwned': toEnterpriseData.stats.totalNFTsOwned + 1,
      'lastUpdated': Timestamp.now()
    });
    
    await client.disconnect();
    
    return sellOfferResult.result.hash;
  } catch (error) {
    console.error('NFT 전송 오류:', error);
    throw error;
  }
};

/**
 * NFT 목록 조회 함수
 * 
 * @param enterpriseId 기업 ID
 * @param type NFT 유형 (선택적)
 * @returns NFT 목록
 */
export const getEnterpriseNFTs = async (enterpriseId: string, type?: string): Promise<any[]> => {
  try {
    const nftsRef = collection(db, 'nfts');
    let nftQuery: any = query(nftsRef, where('ownership.currentOwner', '==', enterpriseId));
    
    if (type) {
      nftQuery = query(nftQuery, where('type', '==', type));
    }
    
    nftQuery = query(nftQuery, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(nftQuery);
    
    const nfts: any[] = [];
    snapshot.forEach(doc => {
      nfts.push(doc.data());
    });
    
    return nfts;
  } catch (error) {
    console.error('NFT 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * NFT 상세 정보 조회 함수
 * 
 * @param nftId NFT ID
 * @returns NFT 상세 정보
 */
export const getNFTDetails = async (nftId: string): Promise<any> => {
  try {
    const nftsRef = collection(db, 'nfts');
    const nftQuery = query(nftsRef, where('nftId', '==', nftId));
    const nftSnapshot = await getDocs(nftQuery);
    
    if (nftSnapshot.empty) {
      throw new Error('NFT 정보를 찾을 수 없습니다.');
    }
    
    const nft = nftSnapshot.docs[0].data();
    
    // NFT 유형에 따라 추가 정보 조회
    if (nft.type === 'subscription') {
      // 구독 정보 조회
      const subscriptionsRef = collection(db, 'subscriptions');
      const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', nft.source.sourceId));
      const subscriptionSnapshot = await getDocs(subscriptionQuery);
      
      if (!subscriptionSnapshot.empty) {
        const subscription = subscriptionSnapshot.docs[0].data();
        
        // 사용자 정보 조회
        const userData = await getUserInfo(nft.source.userId);
        
        return {
          nft,
          subscription,
          user: {
            userId: userData.userId,
            displayName: userData.profile.displayName,
            age: userData.profile.age,
            gender: userData.profile.gender,
            dataQuality: userData.dataQuality
          }
        };
      }
    } else if (nft.type === 'pool') {
      // 데이터 풀 정보 조회
      const poolDoc = await getDoc(doc(db, 'data_pools', nft.source.sourceId));
      
      if (poolDoc.exists()) {
        const pool = poolDoc.data();
        
        return {
          nft,
          pool
        };
      }
    }
    
    return { nft };
  } catch (error) {
    console.error('NFT 상세 정보 조회 오류:', error);
    throw error;
  }
};
