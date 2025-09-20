/**
 * SportiQue - 플랫폼 데이터 풀 관리 기능
 * 
 * SportiQue 플랫폼의 데이터 풀 생성, 관리, 조회를 담당하는 모듈
 */

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  Timestamp,
  DocumentReference
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getSystemConfig } from './SystemConfig';
import { createEscrow } from '../xrpl/XrplEscrow';
import { DataPool, DataPoolSchedule, DataPoolRequirements } from '../types/dataPool';

/**
 * 데이터 풀 생성 함수
 * 
 * @param name 데이터 풀 이름
 * @param description 데이터 풀 설명
 * @param dataType 데이터 유형
 * @param category 카테고리
 * @param schedule 일정
 * @param targets 목표
 * @param requirements 요구사항
 * @returns 생성된 데이터 풀 ID
 */
export const createDataPool = async (
  name: string,
  description: string,
  dataType: string,
  category: string,
  schedule: DataPoolSchedule,
  targets: { targetUsers: number, minEnterprises: number, maxEnterprises: number, estimatedBudgetMin: number, estimatedBudgetMax: number },
  requirements: DataPoolRequirements
): Promise<string> => {
  try {
    // 시스템 설정 조회
    const systemConfig = await getSystemConfig();
    
    // 데이터 풀 ID 생성
    const poolId = `pool_${dataType.toLowerCase()}_${new Date().toISOString().slice(0, 7).replace('-', '')}`;
    
    // Firestore에 데이터 풀 저장
    await addDoc(collection(db, 'data_pools'), {
      poolId,
      name,
      description,
      dataType,
      category,
      
      schedule: {
        createdAt: Timestamp.now(),
        formingStartDate: Timestamp.fromDate(new Date(schedule.formingStartDate)),
        formingEndDate: Timestamp.fromDate(new Date(schedule.formingEndDate)),
        activeStartDate: Timestamp.fromDate(new Date(schedule.activeStartDate)),
        activeEndDate: Timestamp.fromDate(new Date(schedule.activeEndDate)),
        distributionDate: Timestamp.fromDate(new Date(schedule.distributionDate))
      },
      
      targets,
      
      status: 'forming',
      currentPhase: 'enterprise_recruitment',
      
      requirements,
      
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
      
      nftCollection: {
        totalCollected: 0,
        qualityDistribution: {
          A: 0,
          B: 0,
          C: 0
        },
        averageQuality: 0,
        collectedNFTs: []
      },
      
      escrow: {
        escrowAddress: `rPool${poolId.substring(5, 15)}Escrow${Math.floor(Math.random() * 1000000)}`,
        totalAmount: 0,
        usedAmount: 0,
        remainingAmount: 0
      },
      
      platformFee: {
        feePercentage: systemConfig.platform.platformFeePercentage,
        estimatedFee: 0
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    return poolId;
  } catch (error) {
    console.error('데이터 풀 생성 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 상태 업데이트 함수
 * 
 * @param poolId 데이터 풀 ID
 */
export const updateDataPoolStatus = async (poolId: string): Promise<void> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    const now = new Date();
    
    // 상태 및 단계 업데이트
    let status = pool.status;
    let currentPhase = pool.currentPhase;
    
    // 형성 시작일이 지났는지 확인
    if (now >= pool.schedule.formingStartDate.toDate() && status === 'pending') {
      status = 'forming';
      currentPhase = 'enterprise_recruitment';
    }
    
    // 형성 종료일이 지났는지 확인
    if (now >= pool.schedule.formingEndDate.toDate() && status === 'forming') {
      // 최소 기업 수 확인
      if (pool.consortium.participatingEnterprises.length >= pool.targets.minEnterprises) {
        status = 'active';
        currentPhase = 'user_recruitment';
      } else {
        status = 'cancelled';
        currentPhase = 'cancelled_insufficient_enterprises';
      }
    }
    
    // 활성 시작일이 지났는지 확인
    if (now >= pool.schedule.activeStartDate.toDate() && status === 'active' && currentPhase === 'user_recruitment') {
      // 최소 사용자 수 확인
      if (pool.userParticipation.registeredUsers >= pool.targets.targetUsers * 0.5) {
        currentPhase = 'data_collection';
      } else {
        status = 'cancelled';
        currentPhase = 'cancelled_insufficient_users';
      }
    }
    
    // 활성 종료일이 지났는지 확인
    if (now >= pool.schedule.activeEndDate.toDate() && status === 'active' && currentPhase === 'data_collection') {
      currentPhase = 'data_processing';
    }
    
    // 배포일이 지났는지 확인
    if (now >= pool.schedule.distributionDate.toDate() && status === 'active' && currentPhase === 'data_processing') {
      currentPhase = 'completed';
      status = 'completed';
    }
    
    // 상태가 변경되었으면 업데이트
    if (status !== pool.status || currentPhase !== pool.currentPhase) {
      await updateDoc(poolDoc.ref, {
        status,
        currentPhase,
        lastUpdated: Timestamp.now()
      });
    }
  } catch (error) {
    console.error('데이터 풀 상태 업데이트 오류:', error);
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
export const getDataPools = async (status?: string, category?: string): Promise<DataPool[]> => {
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
    
    const pools: DataPool[] = [];
    snapshot.forEach(doc => {
      pools.push(doc.data() as DataPool);
    });
    
    return pools;
  } catch (error) {
    console.error('데이터 풀 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 상세 정보 조회 함수
 * 
 * @param poolId 데이터 풀 ID
 * @returns 데이터 풀 상세 정보
 */
export const getDataPoolDetails = async (poolId: string): Promise<DataPool> => {
  try {
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    return poolDoc.data() as DataPool;
  } catch (error) {
    console.error('데이터 풀 상세 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 기업에 데이터 풀 참여 권유 함수
 * 
 * @param poolId 데이터 풀 ID
 * @param enterpriseIds 권유할 기업 ID 목록
 * @returns 권유 성공 여부
 */
export const inviteEnterprisesToPool = async (poolId: string, enterpriseIds: string[]): Promise<boolean> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 풀 상태 확인
    if (pool.status !== 'forming') {
      throw new Error('형성 중인 데이터 풀만 초대할 수 있습니다.');
    }
    
    // 각 기업에 초대 알림 생성
    for (const enterpriseId of enterpriseIds) {
      await addDoc(collection(db, 'notifications'), {
        recipientId: enterpriseId,
        recipientType: 'enterprise',
        type: 'pool_invitation',
        title: '새로운 데이터 풀 참여 초대',
        message: `"${pool.name}" 데이터 풀에 참여해보세요. 예상 참여자 ${pool.targets.targetUsers}명, 예상 예산 ${pool.targets.estimatedBudgetMin}~${pool.targets.estimatedBudgetMax} XRP.`,
        data: {
          poolId,
          poolName: pool.name,
          dataType: pool.dataType,
          category: pool.category
        },
        isRead: false,
        createdAt: Timestamp.now()
      });
    }
    
    return true;
  } catch (error) {
    console.error('데이터 풀 참여 권유 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 집계 데이터 생성 함수
 * 
 * @param poolId 데이터 풀 ID
 * @param date 날짜
 * @returns 생성된 집계 데이터 ID
 */
export const generatePoolAggregateData = async (poolId: string, date: string): Promise<string> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 참여 사용자 목록 조회
    const userIds = pool.userParticipation.userList.map((p: any) => p.userId);
    
    // 해당 날짜의 건강 데이터 조회
    const healthDataRef = collection(db, 'health_data');
    const dataQuery = query(
      healthDataRef,
      where('userId', 'in', userIds),
      where('date', '==', date),
      where('dataType', '==', pool.dataType)
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    // 데이터 집계
    const dataPoints: any[] = [];
    let totalQualityScore = 0;
    
    dataSnapshot.forEach(doc => {
      const data = doc.data();
      dataPoints.push(data);
      totalQualityScore += data.quality.score;
    });
    
    const dataPointCount = dataPoints.length;
    const participantCount = new Set(dataPoints.map(dp => dp.userId)).size;
    const qualityAverage = dataPointCount > 0 ? totalQualityScore / dataPointCount : 0;
    
    // 데이터 유형별 집계
    const aggregates: any = {};
    
    if (pool.dataType === 'glucose') {
      const values = dataPoints.map(dp => dp.measurements.glucose.value);
      aggregates.glucose = {
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        median: values.sort((a, b) => a - b)[Math.floor(values.length / 2)]
      };
    } else if (pool.dataType === 'blood_pressure') {
      const systolicValues = dataPoints.map(dp => dp.measurements.blood_pressure.systolic);
      const diastolicValues = dataPoints.map(dp => dp.measurements.blood_pressure.diastolic);
      
      aggregates.blood_pressure = {
        averageSystolic: systolicValues.reduce((sum, val) => sum + val, 0) / systolicValues.length,
        averageDiastolic: diastolicValues.reduce((sum, val) => sum + val, 0) / diastolicValues.length,
        minSystolic: Math.min(...systolicValues),
        maxSystolic: Math.max(...systolicValues),
        minDiastolic: Math.min(...diastolicValues),
        maxDiastolic: Math.max(...diastolicValues)
      };
    } else if (pool.dataType === 'heart_rate') {
      const values = dataPoints.map(dp => dp.measurements.heart_rate.value);
      aggregates.heart_rate = {
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    }
    
    // 집계 데이터 ID 생성
    const aggregateId = `pool_data_${poolId.split('_')[1]}_${date.replace(/-/g, '')}`;
    
    // Firestore에 집계 데이터 저장
    await addDoc(collection(db, 'pool_data'), {
      aggregateId,
      poolId,
      date,
      dataType: pool.dataType,
      participantCount,
      dataPointCount,
      qualityAverage,
      aggregates,
      createdAt: Timestamp.now()
    });
    
    return aggregateId;
  } catch (error) {
    console.error('데이터 풀 집계 데이터 생성 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 완료 처리 함수
 * 
 * @param poolId 데이터 풀 ID
 * @returns 완료 성공 여부
 */
export const completeDataPool = async (poolId: string): Promise<boolean> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 풀 상태 확인
    if (pool.status !== 'active' || pool.currentPhase !== 'data_processing') {
      throw new Error('데이터 처리 중인 풀만 완료 처리할 수 있습니다.');
    }
    
    // 참여 기업 목록 조회
    const enterprises = pool.consortium.participatingEnterprises;
    
    // 각 기업에 NFT 발행 알림 생성
    for (const enterprise of enterprises) {
      await addDoc(collection(db, 'notifications'), {
        recipientId: enterprise.enterpriseId,
        recipientType: 'enterprise',
        type: 'pool_completed',
        title: '데이터 풀 완료 및 NFT 발행 가능',
        message: `"${pool.name}" 데이터 풀이 완료되었습니다. 이제 NFT를 발행하여 데이터에 접근할 수 있습니다.`,
        data: {
          poolId,
          poolName: pool.name,
          dataType: pool.dataType,
          sharePercentage: enterprise.sharePercentage
        },
        isRead: false,
        createdAt: Timestamp.now()
      });
    }
    
    // 데이터 풀 상태 업데이트
    await updateDoc(poolDoc.ref, {
      status: 'completed',
      currentPhase: 'completed',
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('데이터 풀 완료 처리 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 취소 함수
 * 
 * @param poolId 데이터 풀 ID
 * @param reason 취소 사유
 * @returns 취소 성공 여부
 */
export const cancelDataPool = async (poolId: string, reason: string): Promise<boolean> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 이미 취소되었는지 확인
    if (pool.status === 'cancelled') {
      throw new Error('이미 취소된 데이터 풀입니다.');
    }
    
    // 완료된 풀은 취소할 수 없음
    if (pool.status === 'completed') {
      throw new Error('완료된 데이터 풀은 취소할 수 없습니다.');
    }
    
    // 참여 기업 목록 조회
    const enterprises = pool.consortium.participatingEnterprises;
    
    // 각 기업에 취소 알림 생성
    for (const enterprise of enterprises) {
      await addDoc(collection(db, 'notifications'), {
        recipientId: enterprise.enterpriseId,
        recipientType: 'enterprise',
        type: 'pool_cancelled',
        title: '데이터 풀 취소',
        message: `"${pool.name}" 데이터 풀이 취소되었습니다. 사유: ${reason}`,
        data: {
          poolId,
          poolName: pool.name,
          reason
        },
        isRead: false,
        createdAt: Timestamp.now()
      });
    }
    
    // 데이터 풀 상태 업데이트
    await updateDoc(poolDoc.ref, {
      status: 'cancelled',
      currentPhase: 'cancelled_by_admin',
      cancellation: {
        cancelledAt: Timestamp.now(),
        reason
      },
      lastUpdated: Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('데이터 풀 취소 오류:', error);
    throw error;
  }
};
