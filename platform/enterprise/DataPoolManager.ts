/**
 * SportiQue - 기업 데이터 풀 관리 기능
 * 
 * 기업의 데이터 풀 참여, 관리, 조회를 담당하는 모듈
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  Timestamp,
  DocumentReference,
  arrayUnion
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createEscrow } from '../xrpl/XrplEscrow';
import { getEnterpriseInfo } from './EnterpriseAuth';
import { generatePoolNFT } from '../xrpl/NftGenerator';

/**
 * 데이터 풀 참여 함수
 * 
 * @param enterpriseId 기업 ID
 * @param poolId 데이터 풀 ID
 * @param contributionAmount 기여 금액
 * @returns 참여 성공 여부
 */
export const joinDataPool = async (
  enterpriseId: string,
  poolId: string,
  contributionAmount: number
): Promise<boolean> => {
  try {
    // 데이터 풀 정보 조회
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 기업 정보 조회
    const enterpriseData = await getEnterpriseInfo(enterpriseId);
    
    // 참여 가능 여부 확인
    if (pool.status !== 'forming' && pool.status !== 'active') {
      throw new Error('참여할 수 없는 데이터 풀 상태입니다.');
    }
    
    if (pool.consortium.participatingEnterprises.length >= pool.targets.maxEnterprises) {
      throw new Error('데이터 풀 참여 기업 수가 최대치에 도달했습니다.');
    }
    
    // 이미 참여 중인지 확인
    const existingParticipation = pool.consortium.participatingEnterprises.find(
      (p: any) => p.enterpriseId === enterpriseId
    );
    
    if (existingParticipation) {
      throw new Error('이미 해당 데이터 풀에 참여 중입니다.');
    }
    
    // 기여 금액 확인
    if (contributionAmount < pool.targets.estimatedBudgetMin / pool.targets.maxEnterprises) {
      throw new Error(`최소 기여 금액(${pool.targets.estimatedBudgetMin / pool.targets.maxEnterprises} XRP)보다 작습니다.`);
    }
    
    // 지분 비율 계산
    const totalContribution = pool.consortium.totalContribution + contributionAmount;
    const sharePercentage = (contributionAmount / totalContribution) * 100;
    
    // 에스크로 생성
    const escrowResult = await createEscrow(
      enterpriseData.xrpl.masterWallet,
      pool.escrow ? pool.escrow.escrowAddress : 'rSportiQueAdmin123456789ABCDEF',
      contributionAmount,
      30, // 30일 에스크로
      `Pool participation for ${poolId}`
    );
    
    // 데이터 풀 업데이트
    await updateDoc(poolRef, {
      'consortium.participatingEnterprises': arrayUnion({
        enterpriseId,
        companyName: enterpriseData.companyName,
        contributionAmount,
        sharePercentage,
        joinedAt: Timestamp.now(),
        status: 'confirmed',
        escrowTxHash: escrowResult.txHash
      }),
      'consortium.totalContribution': totalContribution,
      'consortium.totalShares': pool.consortium.totalShares + sharePercentage,
      'consortium.remainingShares': 100 - (pool.consortium.totalShares + sharePercentage),
      'lastUpdated': Timestamp.now()
    });
    
    // 기업 통계 업데이트
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      'stats.totalPoolParticipations': enterpriseData.stats.totalPoolParticipations + 1,
      'xrpl.totalSpent': enterpriseData.xrpl.totalSpent + contributionAmount,
      'xrpl.escrowBalance': enterpriseData.xrpl.escrowBalance + contributionAmount,
      'lastUpdated': Timestamp.now()
    });
    
    // 트랜잭션 기록
    await addPoolTransaction(
      enterpriseId,
      poolId,
      'pool_join',
      contributionAmount,
      escrowResult.txHash
    );
    
    return true;
  } catch (error) {
    console.error('데이터 풀 참여 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 트랜잭션 추가 함수
 * 
 * @param enterpriseId 기업 ID
 * @param poolId 데이터 풀 ID
 * @param txType 트랜잭션 유형
 * @param amount 금액
 * @param txHash 트랜잭션 해시
 */
export const addPoolTransaction = async (
  enterpriseId: string,
  poolId: string,
  txType: string,
  amount: number,
  txHash: string
): Promise<void> => {
  try {
    await addDoc(collection(db, 'transactions'), {
      txHash,
      txType,
      status: 'confirmed',
      
      transaction: {
        fromWallet: enterpriseId,
        toWallet: poolId,
        amount,
        fee: 0.012,
        memo: `${txType} for pool ${poolId}`,
        sequence: Math.floor(Math.random() * 1000000),
        ledgerIndex: Math.floor(Math.random() * 1000000)
      },
      
      businessContext: {
        purpose: 'pool_participation',
        relatedType: 'data_pool',
        relatedId: poolId,
        enterpriseId,
        userId: null
      },
      
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('트랜잭션 기록 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 목록 조회 함수
 * 
 * @param status 풀 상태 (선택적)
 * @param category 풀 카테고리 (선택적)
 * @returns 데이터 풀 목록
 */
export const getDataPools = async (status?: string, category?: string): Promise<any[]> => {
  try {
    const poolsRef = collection(db, 'data_pools');
    let poolQuery: any = query(poolsRef);
    
    if (status) {
      poolQuery = query(poolQuery, where('status', '==', status));
    }
    
    if (category) {
      poolQuery = query(poolQuery, where('category', '==', category));
    }
    
    poolQuery = query(poolQuery, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(poolQuery);
    
    const pools: any[] = [];
    snapshot.forEach(doc => {
      pools.push(doc.data());
    });
    
    return pools;
  } catch (error) {
    console.error('데이터 풀 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 기업 참여 데이터 풀 목록 조회 함수
 * 
 * @param enterpriseId 기업 ID
 * @returns 참여 중인 데이터 풀 목록
 */
export const getEnterpriseDataPools = async (enterpriseId: string): Promise<any[]> => {
  try {
    const poolsRef = collection(db, 'data_pools');
    const poolQuery = query(
      poolsRef,
      where('consortium.participatingEnterprises', 'array-contains', { enterpriseId })
    );
    
    const snapshot = await getDocs(poolQuery);
    
    const pools: any[] = [];
    snapshot.forEach(doc => {
      pools.push(doc.data());
    });
    
    return pools;
  } catch (error) {
    console.error('기업 참여 데이터 풀 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 상세 정보 조회 함수
 * 
 * @param poolId 데이터 풀 ID
 * @returns 데이터 풀 상세 정보
 */
export const getDataPoolDetails = async (poolId: string): Promise<any> => {
  try {
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 참여 사용자 정보 조회
    const userIds = pool.userParticipation.userList.map((p: any) => p.userId);
    const usersData: any[] = [];
    
    for (const userId of userIds) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        usersData.push({
          userId: userData.userId,
          displayName: userData.profile.displayName,
          age: userData.profile.age,
          gender: userData.profile.gender,
          dataQuality: userData.dataQuality
        });
      }
    }
    
    return {
      pool,
      users: usersData
    };
  } catch (error) {
    console.error('데이터 풀 상세 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 NFT 생성 함수
 * 
 * @param enterpriseId 기업 ID
 * @param poolId 데이터 풀 ID
 * @returns 생성된 NFT ID
 */
export const createDataPoolNFT = async (enterpriseId: string, poolId: string): Promise<string> => {
  try {
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
    
    // NFT 생성
    const nftResult = await generatePoolNFT(
      enterpriseId,
      poolId,
      pool.name,
      enterpriseParticipation.sharePercentage,
      pool.userParticipation.registeredUsers
    );
    
    return nftResult.nftId;
  } catch (error) {
    console.error('데이터 풀 NFT 생성 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 데이터 CSV 내보내기 함수
 * 
 * @param enterpriseId 기업 ID
 * @param poolId 데이터 풀 ID
 * @returns CSV 데이터
 */
export const exportPoolDataToCsv = async (enterpriseId: string, poolId: string): Promise<string> => {
  try {
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
    
    // 풀 데이터 조회
    const poolDataRef = collection(db, 'pool_data');
    const dataQuery = query(
      poolDataRef,
      where('poolId', '==', poolId),
      orderBy('date', 'asc')
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    // CSV 헤더 생성
    let csvContent = 'Date,DataType,ParticipantCount,';
    
    // 데이터 유형에 따른 헤더 추가
    if (pool.dataType === 'glucose') {
      csvContent += 'AverageGlucose,MinGlucose,MaxGlucose,MedianGlucose,';
    } else if (pool.dataType === 'blood_pressure') {
      csvContent += 'AverageSystolic,AverageDiastolic,MinSystolic,MaxSystolic,MinDiastolic,MaxDiastolic,';
    } else if (pool.dataType === 'heart_rate') {
      csvContent += 'AverageHeartRate,MinHeartRate,MaxHeartRate,';
    }
    
    csvContent += 'AverageQualityScore,DataPointCount\n';
    
    // 데이터 행 추가
    dataSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const dataType = data.dataType;
      const participantCount = data.participantCount;
      
      let row = `${date},${dataType},${participantCount},`;
      
      // 데이터 유형에 따른 값 추가
      if (dataType === 'glucose' && data.aggregates.glucose) {
        row += `${data.aggregates.glucose.average},${data.aggregates.glucose.min},${data.aggregates.glucose.max},${data.aggregates.glucose.median},`;
      } else if (dataType === 'blood_pressure' && data.aggregates.blood_pressure) {
        row += `${data.aggregates.blood_pressure.averageSystolic},${data.aggregates.blood_pressure.averageDiastolic},`;
        row += `${data.aggregates.blood_pressure.minSystolic},${data.aggregates.blood_pressure.maxSystolic},`;
        row += `${data.aggregates.blood_pressure.minDiastolic},${data.aggregates.blood_pressure.maxDiastolic},`;
      } else if (dataType === 'heart_rate' && data.aggregates.heart_rate) {
        row += `${data.aggregates.heart_rate.average},${data.aggregates.heart_rate.min},${data.aggregates.heart_rate.max},`;
      }
      
      // 품질 정보 및 데이터 포인트 수 추가
      row += `${data.qualityAverage},${data.dataPointCount}\n`;
      
      csvContent += row;
    });
    
    return csvContent;
  } catch (error) {
    console.error('CSV 내보내기 오류:', error);
    throw error;
  }
};
