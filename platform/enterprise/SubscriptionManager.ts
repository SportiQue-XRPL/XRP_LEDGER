/**
 * SportiQue - 기업 구독 관리 기능
 * 
 * 기업의 사용자 데이터 구독 생성, 관리, 조회를 담당하는 모듈
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
import { createEscrow, getEscrowStatus } from '../xrpl/XrplEscrow';
import { getUserInfo } from '../user/UserAuth';
import { getEnterpriseInfo } from './EnterpriseAuth';
import { generateSubscriptionNFT } from '../xrpl/NftGenerator';
import { SubscriptionContract, SubscriptionRequirement } from '../types/subscription';

/**
 * 구독 생성 함수
 * 
 * @param enterpriseId 기업 ID
 * @param userId 사용자 ID
 * @param contract 구독 계약 정보
 * @param requirements 구독 요구사항
 * @returns 생성된 구독 ID
 */
export const createSubscription = async (
  enterpriseId: string,
  userId: string,
  contract: SubscriptionContract,
  requirements: SubscriptionRequirement[]
): Promise<string> => {
  try {
    // 기업 정보 조회
    const enterpriseData = await getEnterpriseInfo(enterpriseId);
    
    // 사용자 정보 조회
    const userData = await getUserInfo(userId);
    
    // 구독 ID 생성
    const subscriptionId = `sub_${enterpriseId.split('_')[1]}_${userId.split('_')[1]}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // 총 에스크로 금액 계산
    const totalDailyReward = requirements.reduce((total, req) => {
      return total + (req.rewardPerEntry * req.frequency);
    }, 0);
    
    const totalAmount = totalDailyReward * contract.duration;
    
    // 에스크로 생성
    const escrowResult = await createEscrow(
      enterpriseData.xrpl.masterWallet,
      userData.xrpl.walletAddress,
      totalAmount,
      contract.duration,
      `Subscription escrow for ${subscriptionId}`
    );
    
    // Firestore에 구독 데이터 저장
    const subscriptionRef = await addDoc(collection(db, 'subscriptions'), {
      subscriptionId,
      enterpriseId,
      userId,
      
      contract: {
        type: contract.type,
        duration: contract.duration,
        startDate: Timestamp.fromDate(new Date(contract.startDate)),
        endDate: Timestamp.fromDate(new Date(contract.endDate)),
        status: 'active',
        autoRenewal: contract.autoRenewal
      },
      
      requirements: {
        dataTypes: requirements.map(req => ({
          type: req.type,
          frequency: req.frequency,
          minQuality: req.minQuality,
          rewardPerEntry: req.rewardPerEntry
        })),
        totalDailyReward,
        qualityBonus: {
          A: 1.5,
          B: 1.0,
          C: 0.7
        }
      },
      
      escrow: {
        totalAmount,
        usedAmount: 0,
        remainingAmount: totalAmount,
        escrowTxHash: escrowResult.txHash,
        escrowAddress: escrowResult.escrowAddress
      },
      
      performance: {
        totalDays: contract.duration,
        completedDays: 0,
        completionRate: 0,
        totalRecords: 0,
        qualityDistribution: {
          A: 0,
          B: 0,
          C: 0
        },
        averageQuality: 0,
        currentStreak: 0,
        missedDays: 0
      },
      
      nft: {
        willGenerateNFT: true,
        nftId: null,
        estimatedQuality: userData.dataQuality.currentGrade,
        estimatedValue: totalAmount
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    // 기업 통계 업데이트
    await updateDoc(doc(db, 'enterprises', enterpriseId), {
      'stats.totalSubscriptions': enterpriseData.stats.totalSubscriptions + 1,
      'stats.activeSubscriptions': enterpriseData.stats.activeSubscriptions + 1,
      'xrpl.totalSpent': enterpriseData.xrpl.totalSpent + totalAmount,
      'xrpl.escrowBalance': enterpriseData.xrpl.escrowBalance + totalAmount,
      'lastUpdated': Timestamp.now()
    });
    
    // 사용자 통계 업데이트
    await updateDoc(doc(db, 'users', userId), {
      'stats.totalSubscriptions': userData.stats.totalSubscriptions + 1,
      'stats.activeSubscriptions': userData.stats.activeSubscriptions + 1,
      'lastUpdated': Timestamp.now()
    });
    
    return subscriptionId;
  } catch (error) {
    console.error('구독 생성 오류:', error);
    throw error;
  }
};

/**
 * 구독 상태 업데이트 함수
 * 
 * @param subscriptionId 구독 ID
 */
export const updateSubscriptionStatus = async (subscriptionId: string): Promise<void> => {
  try {
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscriptionDocRef = subscriptionSnapshot.docs[0].ref;
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 현재 날짜 확인
    const now = new Date();
    const endDate = subscription.contract.endDate.toDate();
    
    // 종료 날짜가 지났는지 확인
    if (now > endDate) {
      // 에스크로 상태 확인
      const escrowStatus = await getEscrowStatus(subscription.escrow.escrowAddress);
      
      // 구독 완료 처리
      await updateDoc(subscriptionDocRef, {
        'contract.status': 'completed',
        'lastUpdated': Timestamp.now()
      });
      
      // NFT 생성
      if (subscription.nft.willGenerateNFT && !subscription.nft.nftId) {
        const nftResult = await generateSubscriptionNFT(
          subscription.enterpriseId,
          subscription.userId,
          subscriptionId,
          subscription.performance.totalRecords,
          subscription.performance.qualityDistribution
        );
        
        // NFT 정보 업데이트
        await updateDoc(subscriptionDocRef, {
          'nft.nftId': nftResult.nftId,
          'lastUpdated': Timestamp.now()
        });
      }
      
      // 기업 통계 업데이트
      const enterpriseRef = doc(db, 'enterprises', subscription.enterpriseId);
      const enterpriseDoc = await getDoc(enterpriseRef);
      
      if (enterpriseDoc.exists()) {
        const enterpriseData = enterpriseDoc.data();
        await updateDoc(enterpriseRef, {
          'stats.activeSubscriptions': enterpriseData.stats.activeSubscriptions - 1,
          'stats.completedSubscriptions': enterpriseData.stats.completedSubscriptions + 1,
          'lastUpdated': Timestamp.now()
        });
      }
      
      // 사용자 통계 업데이트
      const userRef = doc(db, 'users', subscription.userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await updateDoc(userRef, {
          'stats.activeSubscriptions': userData.stats.activeSubscriptions - 1,
          'lastUpdated': Timestamp.now()
        });
      }
    }
  } catch (error) {
    console.error('구독 상태 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 구독 취소 함수
 * 
 * @param subscriptionId 구독 ID
 * @param reason 취소 사유
 * @returns 취소 성공 여부
 */
export const cancelSubscription = async (subscriptionId: string, reason: string): Promise<boolean> => {
  try {
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscriptionDocRef = subscriptionSnapshot.docs[0].ref;
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 이미 취소되었는지 확인
    if (subscription.contract.status === 'cancelled') {
      throw new Error('이미 취소된 구독입니다.');
    }
    
    // 구독 취소 처리
    await updateDoc(subscriptionDocRef, {
      'contract.status': 'cancelled',
      'cancellation': {
        cancelledAt: Timestamp.now(),
        reason,
        refundAmount: subscription.escrow.remainingAmount
      },
      'lastUpdated': Timestamp.now()
    });
    
    // 기업 통계 업데이트
    const enterpriseRef = doc(db, 'enterprises', subscription.enterpriseId);
    const enterpriseDoc = await getDoc(enterpriseRef);
    
    if (enterpriseDoc.exists()) {
      const enterpriseData = enterpriseDoc.data();
      await updateDoc(enterpriseRef, {
        'stats.activeSubscriptions': enterpriseData.stats.activeSubscriptions - 1,
        'xrpl.escrowBalance': enterpriseData.xrpl.escrowBalance - subscription.escrow.remainingAmount,
        'lastUpdated': Timestamp.now()
      });
    }
    
    // 사용자 통계 업데이트
    const userRef = doc(db, 'users', subscription.userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      await updateDoc(userRef, {
        'stats.activeSubscriptions': userData.stats.activeSubscriptions - 1,
        'lastUpdated': Timestamp.now()
      });
    }
    
    return true;
  } catch (error) {
    console.error('구독 취소 오류:', error);
    throw error;
  }
};

/**
 * 기업 구독 목록 조회 함수
 * 
 * @param enterpriseId 기업 ID
 * @param status 구독 상태 (선택적)
 * @returns 구독 목록
 */
export const getEnterpriseSubscriptions = async (enterpriseId: string, status?: string): Promise<any[]> => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    let subscriptionQuery: any = query(subscriptionsRef, where('enterpriseId', '==', enterpriseId));
    
    if (status) {
      subscriptionQuery = query(subscriptionQuery, where('contract.status', '==', status));
    }
    
    subscriptionQuery = query(subscriptionQuery, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(subscriptionQuery);
    
    const subscriptions: any[] = [];
    snapshot.forEach(doc => {
      subscriptions.push(doc.data());
    });
    
    return subscriptions;
  } catch (error) {
    console.error('구독 목록 조회 오류:', error);
    throw error;
  }
};

/**
 * 구독 상세 정보 조회 함수
 * 
 * @param subscriptionId 구독 ID
 * @returns 구독 상세 정보
 */
export const getSubscriptionDetails = async (subscriptionId: string): Promise<any> => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 사용자 정보 조회
    const userData = await getUserInfo(subscription.userId);
    
    // 구독 데이터 조회
    const healthDataRef = collection(db, 'health_data');
    const dataQuery = query(
      healthDataRef,
      where('subscriptionId', '==', subscriptionId),
      orderBy('date', 'desc')
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    const healthData: any[] = [];
    dataSnapshot.forEach(doc => {
      healthData.push(doc.data());
    });
    
    return {
      subscription,
      user: {
        userId: userData.userId,
        displayName: userData.profile.displayName,
        age: userData.profile.age,
        gender: userData.profile.gender,
        dataQuality: userData.dataQuality
      },
      healthData
    };
  } catch (error) {
    console.error('구독 상세 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 구독 갱신 함수
 * 
 * @param subscriptionId 구독 ID
 * @param duration 갱신 기간
 * @returns 갱신된 구독 ID
 */
export const renewSubscription = async (subscriptionId: string, duration: number): Promise<string> => {
  try {
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 새 구독 계약 정보 생성
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration);
    
    const contract: SubscriptionContract = {
      type: subscription.contract.type,
      duration,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      autoRenewal: subscription.contract.autoRenewal
    };
    
    // 새 구독 생성
    const newSubscriptionId = await createSubscription(
      subscription.enterpriseId,
      subscription.userId,
      contract,
      subscription.requirements.dataTypes
    );
    
    return newSubscriptionId;
  } catch (error) {
    console.error('구독 갱신 오류:', error);
    throw error;
  }
};

/**
 * 구독 데이터 CSV 내보내기 함수
 * 
 * @param subscriptionId 구독 ID
 * @param startDate 시작일 (선택적)
 * @param endDate 종료일 (선택적)
 * @returns CSV 데이터
 */
export const exportSubscriptionDataToCsv = async (
  subscriptionId: string,
  startDate?: string,
  endDate?: string
): Promise<string> => {
  try {
    // 구독 정보 조회
    const subscriptionsRef = collection(db, 'subscriptions');
    const subscriptionQuery = query(subscriptionsRef, where('subscriptionId', '==', subscriptionId));
    const subscriptionSnapshot = await getDocs(subscriptionQuery);
    
    if (subscriptionSnapshot.empty) {
      throw new Error('구독 정보를 찾을 수 없습니다.');
    }
    
    const subscription = subscriptionSnapshot.docs[0].data();
    
    // 건강 데이터 조회
    const healthDataRef = collection(db, 'health_data');
    let dataQuery: any = query(
      healthDataRef,
      where('subscriptionId', '==', subscriptionId)
    );
    
    if (startDate) {
      dataQuery = query(dataQuery, where('date', '>=', startDate));
    }
    
    if (endDate) {
      dataQuery = query(dataQuery, where('date', '<=', endDate));
    }
    
    dataQuery = query(dataQuery, orderBy('date', 'asc'));
    
    const dataSnapshot = await getDocs(dataQuery);
    
    // CSV 헤더 생성
    let csvContent = 'Date,Time,DataType,';
    
    // 데이터 유형에 따른 헤더 추가
    const dataTypes = subscription.requirements.dataTypes.map((dt: any) => dt.type);
    
    if (dataTypes.includes('glucose')) {
      csvContent += 'Glucose (mg/dL),Meal Relation,';
    }
    
    if (dataTypes.includes('blood_pressure')) {
      csvContent += 'Systolic (mmHg),Diastolic (mmHg),Position,';
    }
    
    if (dataTypes.includes('heart_rate')) {
      csvContent += 'Heart Rate (bpm),Activity,';
    }
    
    csvContent += 'Quality Grade,Quality Score,Notes\n';
    
    // 데이터 행 추가
    dataSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date;
      const time = new Date(data.timestamp.seconds * 1000).toTimeString().split(' ')[0];
      const dataType = data.dataType;
      
      let row = `${date},${time},${dataType},`;
      
      // 데이터 유형에 따른 값 추가
      if (dataType === 'glucose' && data.measurements.glucose) {
        row += `${data.measurements.glucose.value},${data.measurements.glucose.mealRelation || 'N/A'},`;
      } else if (dataTypes.includes('glucose')) {
        row += 'N/A,N/A,';
      }
      
      if (dataType === 'blood_pressure' && data.measurements.blood_pressure) {
        row += `${data.measurements.blood_pressure.systolic},${data.measurements.blood_pressure.diastolic},${data.measurements.blood_pressure.position || 'N/A'},`;
      } else if (dataTypes.includes('blood_pressure')) {
        row += 'N/A,N/A,N/A,';
      }
      
      if (dataType === 'heart_rate' && data.measurements.heart_rate) {
        row += `${data.measurements.heart_rate.value},${data.measurements.heart_rate.activity || 'N/A'},`;
      } else if (dataTypes.includes('heart_rate')) {
        row += 'N/A,N/A,';
      }
      
      // 품질 정보 추가
      row += `${data.quality.grade},${data.quality.score},`;
      
      // 메모 추가
      const notes = data.measurements[dataType]?.notes || '';
      row += `"${notes.replace(/"/g, '""')}"\n`;
      
      csvContent += row;
    });
    
    return csvContent;
  } catch (error) {
    console.error('CSV 내보내기 오류:', error);
    throw error;
  }
};
