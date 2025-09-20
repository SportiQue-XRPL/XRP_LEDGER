/**
 * SportiQue - 데이터 품질 평가 기능
 * 
 * 건강 데이터의 품질을 평가하는 모듈
 */

import { HealthData, DataQuality } from '../types/health';
import { getSystemConfig } from '../platform/SystemConfig';

/**
 * 데이터 품질 평가 함수
 * 
 * @param data 건강 데이터
 * @returns 품질 평가 결과
 */
export const evaluateDataQuality = (data: HealthData): DataQuality => {
  try {
    // 완전성 점수 계산
    const completeness = calculateCompleteness(data);
    
    // 정확성 점수 계산
    const accuracy = calculateAccuracy(data);
    
    // 적시성 점수 계산
    const timeliness = calculateTimeliness(data);
    
    // 총 품질 점수 계산
    const score = Math.round((completeness * 0.4) + (accuracy * 0.4) + (timeliness * 0.2));
    
    // 등급 결정
    let grade = 'C';
    if (score >= 85) {
      grade = 'A';
    } else if (score >= 70) {
      grade = 'B';
    }
    
    return {
      grade,
      score,
      completeness,
      accuracy,
      timeliness
    };
  } catch (error) {
    console.error('데이터 품질 평가 오류:', error);
    
    // 오류 발생 시 기본 품질 반환
    return {
      grade: 'C',
      score: 50,
      completeness: 50,
      accuracy: 50,
      timeliness: 50
    };
  }
};

/**
 * 데이터 완전성 계산 함수
 * 
 * @param data 건강 데이터
 * @returns 완전성 점수 (0-100)
 */
const calculateCompleteness = (data: HealthData): number => {
  let requiredFields: string[] = [];
  let optionalFields: string[] = [];
  
  // 데이터 유형에 따른 필수 및 선택 필드 설정
  switch (data.dataType) {
    case 'glucose':
      requiredFields = ['value', 'unit', 'mealRelation'];
      optionalFields = ['notes'];
      break;
    case 'blood_pressure':
      requiredFields = ['systolic', 'diastolic', 'unit'];
      optionalFields = ['position', 'notes'];
      break;
    case 'heart_rate':
      requiredFields = ['value', 'unit'];
      optionalFields = ['activity', 'notes'];
      break;
    default:
      return 50; // 알 수 없는 데이터 유형
  }
  
  // 필수 필드 확인
  let requiredCount = 0;
  for (const field of requiredFields) {
    if (data.measurements[data.dataType] && data.measurements[data.dataType][field] !== undefined) {
      requiredCount++;
    }
  }
  
  // 선택 필드 확인
  let optionalCount = 0;
  for (const field of optionalFields) {
    if (data.measurements[data.dataType] && data.measurements[data.dataType][field] !== undefined) {
      optionalCount++;
    }
  }
  
  // 컨텍스트 정보 확인
  let contextCount = 0;
  const contextFields = ['medication', 'exercise', 'sleep', 'stress', 'weather'];
  for (const field of contextFields) {
    if (data.context && data.context[field] !== undefined) {
      contextCount++;
    }
  }
  
  // 완전성 점수 계산
  const requiredScore = requiredFields.length > 0 ? (requiredCount / requiredFields.length) * 70 : 0;
  const optionalScore = optionalFields.length > 0 ? (optionalCount / optionalFields.length) * 15 : 0;
  const contextScore = (contextCount / contextFields.length) * 15;
  
  return Math.round(requiredScore + optionalScore + contextScore);
};

/**
 * 데이터 정확성 계산 함수
 * 
 * @param data 건강 데이터
 * @returns 정확성 점수 (0-100)
 */
const calculateAccuracy = (data: HealthData): number => {
  let score = 100;
  
  // 데이터 유형에 따른 유효성 검사
  switch (data.dataType) {
    case 'glucose':
      if (data.measurements.glucose) {
        const value = data.measurements.glucose.value;
        
        // 정상 범위 확인 (일반적으로 70-180 mg/dL)
        if (value < 30 || value > 500) {
          score -= 50; // 극단적인 값
        } else if (value < 50 || value > 300) {
          score -= 20; // 비정상적인 값
        }
        
        // 단위 확인
        if (data.measurements.glucose.unit !== 'mg/dL' && data.measurements.glucose.unit !== 'mmol/L') {
          score -= 10;
        }
      }
      break;
    
    case 'blood_pressure':
      if (data.measurements.blood_pressure) {
        const systolic = data.measurements.blood_pressure.systolic;
        const diastolic = data.measurements.blood_pressure.diastolic;
        
        // 정상 범위 확인
        if (systolic < 70 || systolic > 220) {
          score -= 30;
        }
        
        if (diastolic < 40 || diastolic > 120) {
          score -= 30;
        }
        
        // 수축기/이완기 관계 확인
        if (systolic <= diastolic) {
          score -= 50;
        }
        
        // 단위 확인
        if (data.measurements.blood_pressure.unit !== 'mmHg') {
          score -= 10;
        }
      }
      break;
    
    case 'heart_rate':
      if (data.measurements.heart_rate) {
        const value = data.measurements.heart_rate.value;
        
        // 정상 범위 확인
        if (value < 30 || value > 220) {
          score -= 50;
        } else if (value < 40 || value > 180) {
          score -= 20;
        }
        
        // 단위 확인
        if (data.measurements.heart_rate.unit !== 'bpm') {
          score -= 10;
        }
      }
      break;
  }
  
  return Math.max(0, score);
};

/**
 * 데이터 적시성 계산 함수
 * 
 * @param data 건강 데이터
 * @returns 적시성 점수 (0-100)
 */
const calculateTimeliness = (data: HealthData): number => {
  // 현재 시간과 데이터 타임스탬프의 차이 계산
  const now = new Date();
  const dataTime = new Date(data.timestamp);
  const diffHours = Math.abs(now.getTime() - dataTime.getTime()) / (1000 * 60 * 60);
  
  // 데이터가 당일 기록인지 확인
  const today = new Date().toISOString().split('T')[0];
  const dataDate = data.date;
  
  if (dataDate === today) {
    // 당일 데이터는 시간 차이에 따라 점수 부여
    if (diffHours <= 1) {
      return 100; // 1시간 이내
    } else if (diffHours <= 3) {
      return 90; // 3시간 이내
    } else if (diffHours <= 6) {
      return 80; // 6시간 이내
    } else if (diffHours <= 12) {
      return 70; // 12시간 이내
    } else {
      return 60; // 당일 내
    }
  } else {
    // 과거 데이터는 기본 점수 부여
    return 50;
  }
};

/**
 * 사용자 데이터 품질 등급 계산 함수
 * 
 * @param qualityScores 품질 점수 배열
 * @returns 품질 등급
 */
export const calculateUserQualityGrade = async (qualityScores: number[]): Promise<string> => {
  try {
    // 시스템 설정 조회
    const systemConfig = await getSystemConfig();
    
    // 평균 품질 점수 계산
    const averageScore = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
    
    // 등급 결정
    if (averageScore >= systemConfig.qualityGrades.A.minScore) {
      return 'A';
    } else if (averageScore >= systemConfig.qualityGrades.B.minScore) {
      return 'B';
    } else if (averageScore >= systemConfig.qualityGrades.C.minScore) {
      return 'C';
    } else {
      return 'D';
    }
  } catch (error) {
    console.error('사용자 품질 등급 계산 오류:', error);
    return 'C'; // 기본 등급
  }
};

/**
 * 이상치 감지 함수
 * 
 * @param data 건강 데이터
 * @param userHistory 사용자 이력 데이터
 * @returns 이상치 감지 결과
 */
export const detectAnomalies = (data: HealthData, userHistory: HealthData[]): { isAnomaly: boolean, anomalyFlags: string[] } => {
  const anomalyFlags: string[] = [];
  
  // 데이터 유형에 따른 이상치 감지
  switch (data.dataType) {
    case 'glucose':
      if (data.measurements.glucose) {
        const value = data.measurements.glucose.value;
        
        // 극단적인 값 확인
        if (value < 50) {
          anomalyFlags.push('severe_hypoglycemia');
        } else if (value > 250) {
          anomalyFlags.push('severe_hyperglycemia');
        }
        
        // 이전 데이터와 비교
        if (userHistory.length > 0) {
          const recentValues = userHistory
            .filter(h => h.dataType === 'glucose')
            .map(h => h.measurements.glucose.value)
            .slice(0, 5);
          
          if (recentValues.length > 0) {
            const avgRecent = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
            
            // 급격한 변화 확인
            if (value < avgRecent * 0.7) {
              anomalyFlags.push('rapid_decrease');
            } else if (value > avgRecent * 1.3) {
              anomalyFlags.push('rapid_increase');
            }
          }
        }
      }
      break;
    
    case 'blood_pressure':
      if (data.measurements.blood_pressure) {
        const systolic = data.measurements.blood_pressure.systolic;
        const diastolic = data.measurements.blood_pressure.diastolic;
        
        // 극단적인 값 확인
        if (systolic > 180 || diastolic > 120) {
          anomalyFlags.push('hypertensive_crisis');
        } else if (systolic < 90 || diastolic < 60) {
          anomalyFlags.push('hypotension');
        }
      }
      break;
    
    case 'heart_rate':
      if (data.measurements.heart_rate) {
        const value = data.measurements.heart_rate.value;
        
        // 극단적인 값 확인
        if (value > 120 && data.measurements.heart_rate.activity === 'resting') {
          anomalyFlags.push('tachycardia');
        } else if (value < 50 && data.measurements.heart_rate.activity === 'resting') {
          anomalyFlags.push('bradycardia');
        }
      }
      break;
  }
  
  return {
    isAnomaly: anomalyFlags.length > 0,
    anomalyFlags
  };
};
