/**
 * SportiQue - 플랫폼 시스템 설정 기능
 * 
 * SportiQue 플랫폼의 시스템 설정 관리를 담당하는 모듈
 */

import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { SystemConfig } from '../types/system';

/**
 * 시스템 설정 조회 함수
 * 
 * @returns 시스템 설정
 */
export const getSystemConfig = async (): Promise<SystemConfig> => {
  try {
    const configDoc = await getDoc(doc(db, 'system_config', 'platform_settings'));
    
    if (!configDoc.exists()) {
      throw new Error('시스템 설정을 찾을 수 없습니다.');
    }
    
    return configDoc.data() as SystemConfig;
  } catch (error) {
    console.error('시스템 설정 조회 오류:', error);
    throw error;
  }
};

/**
 * 플랫폼 설정 업데이트 함수
 * 
 * @param platformSettings 업데이트할 플랫폼 설정
 */
export const updatePlatformSettings = async (platformSettings: Partial<SystemConfig['platform']>): Promise<void> => {
  try {
    const configRef = doc(db, 'system_config', 'platform_settings');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      throw new Error('시스템 설정을 찾을 수 없습니다.');
    }
    
    await updateDoc(configRef, {
      'platform': {
        ...configDoc.data().platform,
        ...platformSettings
      },
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('플랫폼 설정 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 품질 등급 설정 업데이트 함수
 * 
 * @param qualityGrades 업데이트할 품질 등급 설정
 */
export const updateQualityGrades = async (qualityGrades: Partial<SystemConfig['qualityGrades']>): Promise<void> => {
  try {
    const configRef = doc(db, 'system_config', 'platform_settings');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      throw new Error('시스템 설정을 찾을 수 없습니다.');
    }
    
    await updateDoc(configRef, {
      'qualityGrades': {
        ...configDoc.data().qualityGrades,
        ...qualityGrades
      },
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('품질 등급 설정 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 지원 데이터 유형 업데이트 함수
 * 
 * @param supportedDataTypes 업데이트할 지원 데이터 유형
 */
export const updateSupportedDataTypes = async (supportedDataTypes: string[]): Promise<void> => {
  try {
    const configRef = doc(db, 'system_config', 'platform_settings');
    
    await updateDoc(configRef, {
      'supportedDataTypes': supportedDataTypes,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('지원 데이터 유형 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 보상 요율 업데이트 함수
 * 
 * @param rewardRates 업데이트할 보상 요율
 */
export const updateRewardRates = async (rewardRates: Partial<SystemConfig['rewardRates']>): Promise<void> => {
  try {
    const configRef = doc(db, 'system_config', 'platform_settings');
    const configDoc = await getDoc(configRef);
    
    if (!configDoc.exists()) {
      throw new Error('시스템 설정을 찾을 수 없습니다.');
    }
    
    await updateDoc(configRef, {
      'rewardRates': {
        ...configDoc.data().rewardRates,
        ...rewardRates
      },
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('보상 요율 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 시스템 설정 초기화 함수
 * 
 * @returns 초기화 성공 여부
 */
export const initializeSystemConfig = async (): Promise<boolean> => {
  try {
    const configRef = doc(db, 'system_config', 'platform_settings');
    
    // 기본 시스템 설정
    await updateDoc(configRef, {
      'platform': {
        'version': '1.0.0',
        'adminWallet': 'rSportiQueAdmin123456789ABCDEF',
        'platformFeePercentage': 5.0,
        'minPoolBudget': 1000,
        'maxPoolDuration': 90
      },
      
      'qualityGrades': {
        'A': { 'multiplier': 1.5, 'minScore': 85 },
        'B': { 'multiplier': 1.0, 'minScore': 70 },
        'C': { 'multiplier': 0.7, 'minScore': 50 }
      },
      
      'supportedDataTypes': [
        'glucose',
        'blood_pressure', 
        'heart_rate',
        'exercise',
        'diet',
        'sleep',
        'medication'
      ],
      
      'rewardRates': {
        'glucose': { 'base': 3.0, 'premium': 5.0 },
        'blood_pressure': { 'base': 2.5, 'premium': 4.0 },
        'heart_rate': { 'base': 2.0, 'premium': 3.0 },
        'exercise': { 'base': 1.5, 'premium': 2.5 }
      },
      
      'lastUpdated': Timestamp.now()
    });
    
    return true;
  } catch (error) {
    console.error('시스템 설정 초기화 오류:', error);
    throw error;
  }
};
