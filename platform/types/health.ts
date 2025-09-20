/**
 * SportiQue - 건강 데이터 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 혈당 데이터
 */
export interface GlucoseData {
  value: number;
  unit: 'mg/dL' | 'mmol/L';
  mealRelation: 'fasting' | 'before_meal' | 'after_meal' | 'bedtime' | 'random';
  notes?: string;
}

/**
 * 혈압 데이터
 */
export interface BloodPressureData {
  systolic: number;
  diastolic: number;
  unit: 'mmHg';
  position?: 'sitting' | 'standing' | 'lying';
  notes?: string;
}

/**
 * 심박수 데이터
 */
export interface HeartRateData {
  value: number;
  unit: 'bpm';
  activity?: 'resting' | 'active' | 'sleeping' | 'exercise';
  notes?: string;
}

/**
 * 운동 데이터
 */
export interface ExerciseData {
  type: string;
  duration: number;
  durationUnit: 'minutes' | 'hours';
  intensity: 'low' | 'moderate' | 'high';
  caloriesBurned?: number;
  distance?: number;
  distanceUnit?: 'km' | 'miles';
  notes?: string;
}

/**
 * 식이 데이터
 */
export interface DietData {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodItems: string[];
  calories?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  notes?: string;
}

/**
 * 수면 데이터
 */
export interface SleepData {
  duration: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  startTime: string;
  endTime: string;
  interruptions?: number;
  notes?: string;
}

/**
 * 약물 데이터
 */
export interface MedicationData {
  name: string;
  dosage: string;
  unit: string;
  time: string;
  taken: boolean;
  notes?: string;
}

/**
 * 건강 데이터 측정값
 */
export interface HealthMeasurements {
  [key: string]: any;
  glucose?: GlucoseData;
  blood_pressure?: BloodPressureData;
  heart_rate?: HeartRateData;
  exercise?: ExerciseData;
  diet?: DietData;
  sleep?: SleepData;
  medication?: MedicationData;
}

/**
 * 건강 데이터 컨텍스트
 */
export interface HealthContext {
  medication?: string[];
  exercise?: string;
  sleep?: string;
  stress?: 'none' | 'low' | 'moderate' | 'high';
  weather?: string;
}

/**
 * 데이터 품질 정보
 */
export interface DataQuality {
  grade: 'A' | 'B' | 'C' | 'D';
  score: number;
  completeness: number;
  accuracy: number;
  timeliness: number;
}

/**
 * 데이터 검증 정보
 */
export interface DataValidation {
  isValidated: boolean;
  validatedBy: 'system' | 'manual' | 'ai';
  validatedAt: Timestamp;
  anomalyFlags: string[];
}

/**
 * 데이터 보상 정보
 */
export interface DataReward {
  baseReward: number;
  qualityBonus: number;
  totalReward: number;
  paidAt: Timestamp | null;
  txHash: string | null;
}

/**
 * 건강 데이터
 */
export interface HealthData {
  dataId: string;
  userId: string;
  subscriptionId?: string;
  
  timestamp: Timestamp | string;
  date: string;
  dataType: 'glucose' | 'blood_pressure' | 'heart_rate' | 'exercise' | 'diet' | 'sleep' | 'medication';
  
  measurements: HealthMeasurements;
  context?: HealthContext;
  
  quality?: DataQuality;
  validation?: DataValidation;
  reward?: DataReward;
  
  createdAt: Timestamp | string;
}
