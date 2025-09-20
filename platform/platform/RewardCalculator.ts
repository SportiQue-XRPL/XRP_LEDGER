/**
 * SportiQue - 플랫폼 보상 계산 기능
 * 
 * 사용자 건강 데이터 제공에 대한 보상 계산을 담당하는 모듈
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getSystemConfig } from './SystemConfig';

/**
 * 보상 계산 함수
 * 
 * @param subscriptionId 구독 ID
 * @param dataType 데이터 유형
 * @param qualityGrade 품질 등급
 * @returns 계산된 보상 정보
 */
export const calculateReward = async (
  subscriptionId: string,
  dataType: string,
  qualityGrade: string
): Promise<{ baseReward: number, qualityBonus: number, totalReward: number }> => {
  try {
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 시스템 설정 조회
    const systemConfig = await getSystemConfig();
    
    // 데이터 유형에 맞는 요구사항 찾기
    const dataTypeRequirement = subscription.requirements.dataTypes.find(
      (dt: any) => dt.type === dataType
    );
    
    if (!dataTypeRequirement) {
      throw new Error(`구독에 ${dataType} 데이터 유형이 포함되어 있지 않습니다.`);
    }
    
    // 기본 보상 계산
    const baseReward = dataTypeRequirement.rewardPerEntry;
    
    // 품질 보너스 계산
    const qualityMultiplier = subscription.requirements.qualityBonus[qualityGrade] || 1.0;
    const qualityBonus = baseReward * (qualityMultiplier - 1);
    
    // 총 보상 계산
    const totalReward = baseReward + qualityBonus;
    
    return {
      baseReward,
      qualityBonus,
      totalReward
    };
  } catch (error) {
    console.error('보상 계산 오류:', error);
    throw error;
  }
};

/**
 * 데이터 풀 보상 계산 함수
 * 
 * @param poolId 데이터 풀 ID
 * @param userId 사용자 ID
 * @param dataCount 데이터 수
 * @param averageQuality 평균 품질
 * @returns 계산된 보상 정보
 */
export const calculatePoolReward = async (
  poolId: string,
  userId: string,
  dataCount: number,
  averageQuality: number
): Promise<{ baseReward: number, qualityBonus: number, totalReward: number }> => {
  try {
    // 데이터 풀 정보 조회
    const poolDoc = await getDoc(doc(db, 'data_pools', poolId));
    
    if (!poolDoc.exists()) {
      throw new Error('데이터 풀 정보를 찾을 수 없습니다.');
    }
    
    const pool = poolDoc.data();
    
    // 시스템 설정 조회
    const systemConfig = await getSystemConfig();
    
    // 데이터 유형에 맞는 보상 요율 찾기
    const rewardRate = systemConfig.rewardRates[pool.dataType] || { base: 1.0, premium: 2.0 };
    
    // 기본 보상 계산
    const baseReward = dataCount * rewardRate.base;
    
    // 품질 보너스 계산
    let qualityMultiplier = 1.0;
    if (averageQuality >= systemConfig.qualityGrades.A.minScore) {
      qualityMultiplier = systemConfig.qualityGrades.A.multiplier;
    } else if (averageQuality >= systemConfig.qualityGrades.B.minScore) {
      qualityMultiplier = systemConfig.qualityGrades.B.multiplier;
    } else if (averageQuality >= systemConfig.qualityGrades.C.minScore) {
      qualityMultiplier = systemConfig.qualityGrades.C.multiplier;
    }
    
    const qualityBonus = baseReward * (qualityMultiplier - 1);
    
    // 총 보상 계산
    const totalReward = baseReward + qualityBonus;
    
    return {
      baseReward,
      qualityBonus,
      totalReward
    };
  } catch (error) {
    console.error('데이터 풀 보상 계산 오류:', error);
    throw error;
  }
};

/**
 * 일일 보상 한도 확인 함수
 * 
 * @param userId 사용자 ID
 * @param date 날짜
 * @returns 일일 보상 정보
 */
export const checkDailyRewardLimit = async (userId: string, date: string): Promise<{ currentTotal: number, limit: number, remaining: number }> => {
  try {
    // 사용자 정보 조회
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userData = userDoc.data();
    
    // 시스템 설정 조회
    const systemConfig = await getSystemConfig();
    
    // 일일 보상 한도 (기본값: 50 XRP)
    const dailyLimit = userData.settings?.dailyRewardLimit || 50;
    
    // 해당 날짜의 보상 내역 조회
    const healthDataRef = collection(db, 'health_data');
    const dataQuery = query(
      healthDataRef,
      where('userId', '==', userId),
      where('date', '==', date),
      where('reward', '!=', null)
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    // 현재까지의 보상 합계 계산
    let currentTotal = 0;
    dataSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.reward && data.reward.totalReward) {
        currentTotal += data.reward.totalReward;
      }
    });
    
    // 남은 보상 한도 계산
    const remaining = Math.max(0, dailyLimit - currentTotal);
    
    return {
      currentTotal,
      limit: dailyLimit,
      remaining
    };
  } catch (error) {
    console.error('일일 보상 한도 확인 오류:', error);
    throw error;
  }
};

/**
 * 월간 보상 통계 계산 함수
 * 
 * @param userId 사용자 ID
 * @param year 연도
 * @param month 월
 * @returns 월간 보상 통계
 */
export const calculateMonthlyRewardStats = async (userId: string, year: number, month: number): Promise<any> => {
  try {
    // 해당 월의 시작일과 종료일 계산
    const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    // 해당 기간의 보상 내역 조회
    const healthDataRef = collection(db, 'health_data');
    const dataQuery = query(
      healthDataRef,
      where('userId', '==', userId),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      where('reward', '!=', null)
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    // 통계 계산
    let totalReward = 0;
    let totalDataPoints = 0;
    const dataTypeBreakdown: { [key: string]: { count: number, reward: number } } = {};
    const qualityBreakdown: { [key: string]: { count: number, reward: number } } = {};
    const dailyRewards: { [key: string]: number } = {};
    
    dataSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.reward && data.reward.totalReward) {
        // 총 보상 및 데이터 포인트 수 집계
        totalReward += data.reward.totalReward;
        totalDataPoints++;
        
        // 데이터 유형별 집계
        if (!dataTypeBreakdown[data.dataType]) {
          dataTypeBreakdown[data.dataType] = { count: 0, reward: 0 };
        }
        dataTypeBreakdown[data.dataType].count++;
        dataTypeBreakdown[data.dataType].reward += data.reward.totalReward;
        
        // 품질별 집계
        if (!qualityBreakdown[data.quality.grade]) {
          qualityBreakdown[data.quality.grade] = { count: 0, reward: 0 };
        }
        qualityBreakdown[data.quality.grade].count++;
        qualityBreakdown[data.quality.grade].reward += data.reward.totalReward;
        
        // 일별 집계
        if (!dailyRewards[data.date]) {
          dailyRewards[data.date] = 0;
        }
        dailyRewards[data.date] += data.reward.totalReward;
      }
    });
    
    // 일별 보상 배열로 변환
    const dailyRewardArray = Object.entries(dailyRewards).map(([date, reward]) => ({
      date,
      reward
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      userId,
      year,
      month,
      totalReward,
      totalDataPoints,
      dataTypeBreakdown,
      qualityBreakdown,
      dailyRewards: dailyRewardArray
    };
  } catch (error) {
    console.error('월간 보상 통계 계산 오류:', error);
    throw error;
  }
};
