/**
 * SportiQue - 사용자 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 사용자 프로필 정보
 */
export interface UserProfile {
  displayName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  bloodType?: 'A' | 'B' | 'AB' | 'O' | 'unknown';
  profileImage?: string;
}

/**
 * 사용자 의료 정보
 */
export interface UserMedical {
  conditions: string[];
  medications: string[];
  allergies: string[];
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

/**
 * 사용자 개인정보 설정
 */
export interface UserPrivacy {
  dataSharing: boolean;
  anonymousMode: boolean;
  allowResearch: boolean;
  allowCommercial: boolean;
  dataRetentionPeriod?: number;
}

/**
 * 사용자 데이터 품질 정보
 */
export interface UserDataQuality {
  currentGrade: 'A' | 'B' | 'C' | 'D';
  qualityScore: number;
  completenessRate: number;
  consistencyScore: number;
  recentDataCount: number;
  longestStreak: number;
  currentStreak: number;
}

/**
 * 사용자 통계 정보
 */
export interface UserStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  totalPoolParticipations: number;
  totalDataPoints: number;
  totalEarnings: number;
}

/**
 * 사용자 인증 정보
 */
export interface UserAuth {
  firebaseUid: string;
  email: string;
  role: 'user';
  emailVerified: boolean;
  lastLogin: Timestamp;
}

/**
 * 사용자 XRPL 정보
 */
export interface UserXrpl {
  walletAddress: string;
  encryptedSeed: string;
  balance: number;
  totalEarned: number;
}

/**
 * 사용자 정보
 */
export interface User {
  userId: string;
  profile: UserProfile;
  medical: UserMedical;
  auth: UserAuth;
  xrpl: UserXrpl;
  dataQuality: UserDataQuality;
  privacy: UserPrivacy;
  stats: UserStats;
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}
