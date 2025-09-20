/**
 * SportiQue - 기업 인증 관련 기능
 * 
 * 기업 회원가입, 로그인, 인증 관리를 담당하는 모듈
 */

import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateXrplWallet } from '../xrpl/XrplWallet';
import { EnterpriseProfile, EnterpriseBusiness, EnterpriseSettings } from '../types/enterprise';

/**
 * 기업 회원가입 함수
 * 
 * @param email 기업 이메일
 * @param password 기업 비밀번호
 * @param profile 기업 프로필 정보
 * @param business 기업 비즈니스 정보
 * @param settings 기업 설정
 * @returns 생성된 기업 ID
 */
export const registerEnterprise = async (
  email: string,
  password: string,
  profile: EnterpriseProfile,
  business: EnterpriseBusiness,
  settings: EnterpriseSettings
): Promise<string> => {
  try {
    const auth = getAuth();
    
    // Firebase Auth로 기업 계정 생성
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // 기업 프로필 업데이트
    await updateProfile(firebaseUser, {
      displayName: profile.companyName
    });
    
    // XRPL 지갑 생성
    const wallet = await generateXrplWallet();
    
    // 기업 ID 생성
    const companyNameSlug = profile.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');
    const enterpriseId = `enterprise_${companyNameSlug}`;
    
    // Firestore에 기업 데이터 저장
    await setDoc(doc(db, 'enterprises', enterpriseId), {
      enterpriseId,
      companyName: profile.companyName,
      email,
      businessNumber: profile.businessNumber,
      representative: profile.representative,
      phone: profile.phone,
      address: profile.address,
      
      auth: {
        firebaseUid: firebaseUser.uid,
        role: 'enterprise',
        permissions: ['pool_participation', 'subscription_management', 'nft_purchase'],
        lastLogin: Timestamp.now(),
        loginCount: 1
      },
      
      xrpl: {
        masterWallet: wallet.address,
        encryptedSeed: wallet.encryptedSeed,
        balance: 0,
        totalSpent: 0,
        totalEarned: 0,
        escrowBalance: 0
      },
      
      business,
      
      stats: {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        completedSubscriptions: 0,
        totalPoolParticipations: 0,
        totalNFTsOwned: 0,
        averageUserSatisfaction: 0,
        totalDataPointsCollected: 0
      },
      
      settings,
      
      verification: {
        isVerified: false,
        verifiedAt: null,
        verificationDocuments: [],
        kycStatus: 'pending'
      },
      
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    // 기업 지갑 생성
    await setDoc(doc(db, 'enterprises', enterpriseId, 'wallets', 'wallet_master'), {
      walletId: 'wallet_master',
      walletType: 'master',
      walletAddress: wallet.address,
      walletName: `${profile.companyName} 메인 지갑`,
      
      security: {
        encryptedSeed: wallet.encryptedSeed,
        encryptionMethod: 'AES-256',
        keyDerivation: 'PBKDF2',
        lastPasswordChange: Timestamp.now()
      },
      
      balance: {
        available: 0,
        escrow: 0,
        pending: 0,
        total: 0,
        lastUpdated: Timestamp.now()
      },
      
      limits: {
        dailyLimit: 50000,
        monthlyLimit: 200000,
        singleTransactionLimit: 10000
      },
      
      isActive: true,
      createdAt: Timestamp.now()
    });
    
    return enterpriseId;
  } catch (error) {
    console.error('기업 등록 오류:', error);
    throw error;
  }
};

/**
 * 기업 로그인 함수
 * 
 * @param email 기업 이메일
 * @param password 기업 비밀번호
 * @returns 기업 정보
 */
export const loginEnterprise = async (email: string, password: string): Promise<{enterpriseId: string, user: FirebaseUser}> => {
  try {
    const auth = getAuth();
    
    // Firebase Auth로 로그인
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 기업 정보 조회
    const enterprisesRef = db.collection('enterprises');
    const snapshot = await enterprisesRef.where('auth.firebaseUid', '==', firebaseUser.uid).get();
    
    if (snapshot.empty) {
      throw new Error('기업 정보를 찾을 수 없습니다.');
    }
    
    const enterpriseId = snapshot.docs[0].id;
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    const enterpriseDoc = await getDoc(enterpriseRef);
    
    if (!enterpriseDoc.exists()) {
      throw new Error('기업 정보를 찾을 수 없습니다.');
    }
    
    const enterpriseData = enterpriseDoc.data();
    
    // 로그인 카운트 증가 및 마지막 로그인 시간 업데이트
    await updateDoc(enterpriseRef, {
      'auth.lastLogin': Timestamp.now(),
      'auth.loginCount': (enterpriseData.auth.loginCount || 0) + 1,
      'lastUpdated': Timestamp.now()
    });
    
    return { enterpriseId, user: firebaseUser };
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
};

/**
 * 기업 정보 조회 함수
 * 
 * @param enterpriseId 기업 ID
 * @returns 기업 정보
 */
export const getEnterpriseInfo = async (enterpriseId: string): Promise<any> => {
  try {
    const enterpriseDoc = await getDoc(doc(db, 'enterprises', enterpriseId));
    
    if (!enterpriseDoc.exists()) {
      throw new Error('기업 정보를 찾을 수 없습니다.');
    }
    
    return enterpriseDoc.data();
  } catch (error) {
    console.error('기업 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 기업 프로필 업데이트 함수
 * 
 * @param enterpriseId 기업 ID
 * @param profile 업데이트할 프로필 정보
 */
export const updateEnterpriseProfile = async (enterpriseId: string, profile: Partial<EnterpriseProfile>): Promise<void> => {
  try {
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    
    // 프로필 정보 업데이트
    await updateDoc(enterpriseRef, {
      ...profile,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 기업 비즈니스 정보 업데이트 함수
 * 
 * @param enterpriseId 기업 ID
 * @param business 업데이트할 비즈니스 정보
 */
export const updateEnterpriseBusiness = async (enterpriseId: string, business: Partial<EnterpriseBusiness>): Promise<void> => {
  try {
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    
    // 비즈니스 정보 업데이트
    await updateDoc(enterpriseRef, {
      'business': business,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('비즈니스 정보 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 기업 설정 업데이트 함수
 * 
 * @param enterpriseId 기업 ID
 * @param settings 업데이트할 설정
 */
export const updateEnterpriseSettings = async (enterpriseId: string, settings: Partial<EnterpriseSettings>): Promise<void> => {
  try {
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    
    // 설정 업데이트
    await updateDoc(enterpriseRef, {
      'settings': settings,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('설정 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 기업 인증 문서 업로드 함수
 * 
 * @param enterpriseId 기업 ID
 * @param documentType 문서 유형
 * @param documentUrl 문서 URL
 */
export const uploadVerificationDocument = async (
  enterpriseId: string,
  documentType: string,
  documentUrl: string
): Promise<void> => {
  try {
    const enterpriseRef = doc(db, 'enterprises', enterpriseId);
    const enterpriseDoc = await getDoc(enterpriseRef);
    
    if (!enterpriseDoc.exists()) {
      throw new Error('기업 정보를 찾을 수 없습니다.');
    }
    
    const enterpriseData = enterpriseDoc.data();
    const verificationDocuments = enterpriseData.verification.verificationDocuments || [];
    
    // 문서 추가
    await updateDoc(enterpriseRef, {
      'verification.verificationDocuments': [...verificationDocuments, documentType],
      'verification.kycStatus': 'submitted',
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('인증 문서 업로드 오류:', error);
    throw error;
  }
};
