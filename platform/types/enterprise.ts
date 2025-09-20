/**
 * SportiQue - 기업 관련 타입 정의
 */

import { Timestamp } from 'firebase/firestore';

/**
 * 기업 프로필 정보
 */
export interface EnterpriseProfile {
  companyName: string;
  businessNumber: string;
  representative: string;
  phone: string;
  address?: string;
  website?: string;
  logo?: string;
}

/**
 * 기업 비즈니스 정보
 */
export interface EnterpriseBusiness {
  industry: string;
  businessType: 'corporation' | 'partnership' | 'sole_proprietorship' | 'non_profit' | 'government';
  establishedYear: number;
  employeeCount: number;
  dataInterests: string[];
  researchFocus: string[];
}

/**
 * 기업 설정
 */
export interface EnterpriseSettings {
  notifications: {
    poolAnnouncements: boolean;
    subscriptionUpdates: boolean;
    nftAvailable: boolean;
  };
  autoRenewal: boolean;
  maxMonthlyBudget: number;
  preferredDataTypes: string[];
}

/**
 * 기업 인증 정보
 */
export interface EnterpriseAuth {
  firebaseUid: string;
  role: 'enterprise';
  permissions: string[];
  lastLogin: Timestamp;
  loginCount: number;
}

/**
 * 기업 XRPL 정보
 */
export interface EnterpriseXrpl {
  masterWallet: string;
  encryptedSeed: string;
  balance: number;
  totalSpent: number;
  totalEarned: number;
  escrowBalance: number;
}

/**
 * 기업 통계 정보
 */
export interface EnterpriseStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  completedSubscriptions: number;
  totalPoolParticipations: number;
  totalNFTsOwned: number;
  averageUserSatisfaction: number;
  totalDataPointsCollected: number;
}

/**
 * 기업 인증 상태
 */
export interface EnterpriseVerification {
  isVerified: boolean;
  verifiedAt: Timestamp | null;
  verificationDocuments: string[];
  kycStatus: 'pending' | 'submitted' | 'verified' | 'rejected';
}

/**
 * 기업 정보
 */
export interface Enterprise {
  enterpriseId: string;
  companyName: string;
  email: string;
  businessNumber: string;
  representative: string;
  phone: string;
  address?: string;
  
  auth: EnterpriseAuth;
  xrpl: EnterpriseXrpl;
  business: EnterpriseBusiness;
  stats: EnterpriseStats;
  settings: EnterpriseSettings;
  verification: EnterpriseVerification;
  
  createdAt: Timestamp;
  lastUpdated: Timestamp;
}

/**
 * 기업 지갑 정보
 */
export interface EnterpriseWallet {
  walletId: string;
  walletType: 'master' | 'escrow' | 'operational';
  walletAddress: string;
  walletName: string;
  
  security: {
    encryptedSeed: string;
    encryptionMethod: string;
    keyDerivation: string;
    lastPasswordChange: Timestamp;
  };
  
  balance: {
    available: number;
    escrow: number;
    pending: number;
    total: number;
    lastUpdated: Timestamp;
  };
  
  limits: {
    dailyLimit: number;
    monthlyLimit: number;
    singleTransactionLimit: number;
  };
  
  isActive: boolean;
  createdAt: Timestamp;
}
