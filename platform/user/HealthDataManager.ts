/**
 * SportiQue - 사용자 건강 데이터 관리 기능
 * 
 * 사용자의 건강 데이터 업로드, 조회, 관리를 담당하는 모듈
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
  limit, 
  updateDoc, 
  Timestamp,
  DocumentReference
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  HealthData, 
  GlucoseData, 
  BloodPressureData, 
  HeartRateData,
  DataQuality
} from '../types/health';
import { evaluateDataQuality } from '../data/QualityEvaluator';
import { calculateReward } from '../platform/RewardCalculator';
import { processXrplReward } from '../xrpl/XrplTransaction';

/**
 * 건강 데이터 업로드 함수
 * 
 * @param userId 사용자 ID
 * @param data 건강 데이터
 * @returns 생성된 데이터 ID
 */
export const uploadHealthData = async (
  userId: string,
  data: HealthData
): Promise<string> => {
  try {
    // 데이터 품질 평가
    const quality = evaluateDataQuality(data);
    
    // 데이터 ID 생성
    const dataId = `data_${userId.split('_')[1]}_${data.date.replace(/-/g, '')}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // 활성 구독 확인
    const subscriptionsRef = collection(db, 'subscriptions');
    const activeSubscriptionsQuery = query(
      subscriptionsRef,
      where('userId', '==', userId),
      where('contract.status', '==', 'active')
    );
    const subscriptionsSnapshot = await getDocs(activeSubscriptionsQuery);
    
    let subscriptionId = null;
    if (!subscriptionsSnapshot.empty) {
      subscriptionId = subscriptionsSnapshot.docs[0].id;
    }
    
    // 보상 계산
    const reward = subscriptionId ? await calculateReward(subscriptionId, data.dataType, quality.grade) : null;
    
    // Firestore에 건강 데이터 저장
    await addDoc(collection(db, 'health_data'), {
      dataId,
      userId,
      subscriptionId,
      timestamp: Timestamp.now(),
      date: data.date,
      dataType: data.dataType,
      measurements: data.measurements,
      context: data.context,
      quality,
      validation: {
        isValidated: true,
        validatedBy: 'system',
        validatedAt: Timestamp.now(),
        anomalyFlags: []
      },
      reward: reward ? {
        baseReward: reward.baseReward,
        qualityBonus: reward.qualityBonus,
        totalReward: reward.totalReward,
        paidAt: null,
        txHash: null
      } : null,
      createdAt: Timestamp.now()
    });
    
    // 사용자 데이터 품질 점수 업데이트
    await updateUserDataQuality(userId);
    
    // 구독이 있는 경우 보상 처리
    if (subscriptionId && reward) {
      await processSubscriptionReward(userId, subscriptionId, dataId, reward);
    }
    
    return dataId;
  } catch (error) {
    console.error('건강 데이터 업로드 오류:', error);
    throw error;
  }
};

/**
 * 사용자 데이터 품질 업데이트 함수
 * 
 * @param userId 사용자 ID
 */
export const updateUserDataQuality = async (userId: string): Promise<void> => {
  try {
    // 최근 30일 데이터 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const healthDataRef = collection(db, 'health_data');
    const recentDataQuery = query(
      healthDataRef,
      where('userId', '==', userId),
      where('timestamp', '>=', Timestamp.fromDate(thirtyDaysAgo)),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(recentDataQuery);
    
    if (snapshot.empty) {
      return;
    }
    
    // 데이터 품질 계산
    let totalQualityScore = 0;
    let totalCompleteness = 0;
    let totalConsistency = 0;
    let dataCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      totalQualityScore += data.quality.score;
      totalCompleteness += data.quality.completeness;
      totalConsistency += data.quality.accuracy;
      dataCount++;
    });
    
    const averageQualityScore = Math.round(totalQualityScore / dataCount);
    const averageCompleteness = Math.round(totalCompleteness / dataCount);
    const averageConsistency = Math.round(totalConsistency / dataCount);
    
    // 등급 결정
    let grade = 'C';
    if (averageQualityScore >= 85) {
      grade = 'A';
    } else if (averageQualityScore >= 70) {
      grade = 'B';
    }
    
    // 현재 연속 기록 계산
    const dates = new Set<string>();
    snapshot.forEach(doc => {
      dates.add(doc.data().date);
    });
    
    const sortedDates = Array.from(dates).sort();
    let currentStreak = 0;
    
    if (sortedDates.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      if (sortedDates[sortedDates.length - 1] === today || sortedDates[sortedDates.length - 1] === yesterdayStr) {
        currentStreak = 1;
        
        for (let i = sortedDates.length - 2; i >= 0; i--) {
          const currentDate = new Date(sortedDates[i + 1]);
          const prevDate = new Date(sortedDates[i]);
          
          const diffTime = Math.abs(currentDate.getTime() - prevDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }
    
    // 사용자 데이터 품질 업데이트
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const longestStreak = Math.max(userData.dataQuality?.longestStreak || 0, currentStreak);
      
      await updateDoc(userRef, {
        'dataQuality': {
          currentGrade: grade,
          qualityScore: averageQualityScore,
          completenessRate: averageCompleteness,
          consistencyScore: averageConsistency,
          recentDataCount: dataCount,
          longestStreak,
          currentStreak
        },
        'lastUpdated': Timestamp.now()
      });
    }
  } catch (error) {
    console.error('사용자 데이터 품질 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 구독 보상 처리 함수
 * 
 * @param userId 사용자 ID
 * @param subscriptionId 구독 ID
 * @param dataId 데이터 ID
 * @param reward 보상 정보
 */
export const processSubscriptionReward = async (
  userId: string,
  subscriptionId: string,
  dataId: string,
  reward: { baseReward: number, qualityBonus: number, totalReward: number }
): Promise<void> => {
  try {
    // 구독 정보 조회
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (!subscriptionDoc.exists()) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionDoc.data();
    
    // 에스크로에서 보상 지급
    const txHash = await processXrplReward(
      subscription.escrow.escrowAddress,
      userId,
      reward.totalReward,
      `Reward for data ${dataId}`
    );
    
    // 건강 데이터 보상 정보 업데이트
    const healthDataRef = collection(db, 'health_data');
    const dataQuery = query(healthDataRef, where('dataId', '==', dataId));
    const dataSnapshot = await getDocs(dataQuery);
    
    if (!dataSnapshot.empty) {
      const dataDocRef = dataSnapshot.docs[0].ref;
      await updateDoc(dataDocRef, {
        'reward.paidAt': Timestamp.now(),
        'reward.txHash': txHash
      });
    }
    
    // 구독 사용 금액 업데이트
    await updateDoc(subscriptionRef, {
      'escrow.usedAmount': subscription.escrow.usedAmount + reward.totalReward,
      'escrow.remainingAmount': subscription.escrow.remainingAmount - reward.totalReward,
      'performance.totalRecords': subscription.performance.totalRecords + 1,
      'performance.qualityDistribution': {
        ...subscription.performance.qualityDistribution,
        [reward.qualityBonus > 0 ? 'A' : (reward.qualityBonus < 0 ? 'C' : 'B')]: 
          subscription.performance.qualityDistribution[reward.qualityBonus > 0 ? 'A' : (reward.qualityBonus < 0 ? 'C' : 'B')] + 1
      },
      'lastUpdated': Timestamp.now()
    });
    
    // 사용자 통계 업데이트
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      await updateDoc(userRef, {
        'xrpl.balance': userData.xrpl.balance + reward.totalReward,
        'xrpl.totalEarned': userData.xrpl.totalEarned + reward.totalReward,
        'stats.totalDataPoints': userData.stats.totalDataPoints + 1,
        'stats.totalEarnings': userData.stats.totalEarnings + reward.totalReward,
        'lastUpdated': Timestamp.now()
      });
    }
  } catch (error) {
    console.error('구독 보상 처리 오류:', error);
    throw error;
  }
};

/**
 * 사용자 건강 데이터 조회 함수
 * 
 * @param userId 사용자 ID
 * @param dataType 데이터 유형 (선택적)
 * @param startDate 시작일 (선택적)
 * @param endDate 종료일 (선택적)
 * @returns 건강 데이터 목록
 */
export const getUserHealthData = async (
  userId: string,
  dataType?: string,
  startDate?: string,
  endDate?: string
): Promise<HealthData[]> => {
  try {
    const healthDataRef = collection(db, 'health_data');
    let dataQuery: any = query(healthDataRef, where('userId', '==', userId));
    
    if (dataType) {
      dataQuery = query(dataQuery, where('dataType', '==', dataType));
    }
    
    if (startDate) {
      dataQuery = query(dataQuery, where('date', '>=', startDate));
    }
    
    if (endDate) {
      dataQuery = query(dataQuery, where('date', '<=', endDate));
    }
    
    dataQuery = query(dataQuery, orderBy('date', 'desc'), orderBy('timestamp', 'desc'));
    
    const snapshot = await getDocs(dataQuery);
    
    const healthData: HealthData[] = [];
    snapshot.forEach(doc => {
      const data = doc.data() as HealthData;
      healthData.push(data);
    });
    
    return healthData;
  } catch (error) {
    console.error('건강 데이터 조회 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 참여 신청 함수
 * 
 * @param userId 사용자 ID
 * @param poolId 데이터 풀 ID
 * @returns 참여 성공 여부
 */
export const joinDataPool = async (userId: string, poolId: string): Promise<boolean> => {
  try {
    // 데이터 풀 정보 조회
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 사용자 정보 조회
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const user = userDoc.data();
    
    // 데이터 품질 확인
    if (user.dataQuality.currentGrade < pool.requirements.minQualityGrade) {
      throw new Error(`최소 품질 등급(${pool.requirements.minQualityGrade})을 충족하지 않습니다.`);
    }
    
    // 이미 참여 중인지 확인
    const userList = pool.userParticipation.userList || [];
    const existingParticipation = userList.find((p: any) => p.userId === userId);
    
    if (existingParticipation) {
      throw new Error('이미 해당 데이터 풀에 참여 중입니다.');
    }
    
    // 참여자 추가
    const updatedUserList = [
      ...userList,
      {
        userId,
        joinedAt: Timestamp.now(),
        dataSubmitted: 0,
        qualityAverage: user.dataQuality.qualityScore,
        status: 'active'
      }
    ];
    
    // 데이터 풀 업데이트
    await updateDoc(poolRef, {
      'userParticipation.registeredUsers': pool.userParticipation.registeredUsers + 1,
      'userParticipation.activeUsers': pool.userParticipation.activeUsers + 1,
      'userParticipation.userList': updatedUserList,
      'lastUpdated': Timestamp.now()
    });
    
    // 사용자 통계 업데이트
    await updateDoc(userRef, {
      'stats.totalPoolParticipations': user.stats.totalPoolParticipations + 1,
      'lastUpdated': Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('데이터 풀 참여 신청 오류:', error);
    throw error;
  }
};
