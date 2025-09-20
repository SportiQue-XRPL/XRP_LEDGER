/**
 * SportiQue - 사용자 인증 관련 기능
 * 
 * 사용자 회원가입, 로그인, 인증 관리를 담당하는 모듈
 */

import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile,
  sendEmailVerification,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { generateXrplWallet } from '../xrpl/XrplWallet';
import { UserProfile, UserMedical, UserPrivacy } from '../types/user';

/**
 * 사용자 회원가입 함수
 * 
 * @param email 사용자 이메일
 * @param password 사용자 비밀번호
 * @param profile 사용자 프로필 정보
 * @param medical 사용자 의료 정보
 * @param privacy 사용자 개인정보 설정
 * @returns 생성된 사용자 ID
 */
export const registerUser = async (
  email: string,
  password: string,
  profile: UserProfile,
  medical: UserMedical,
  privacy: UserPrivacy
): Promise<string> => {
  try {
    const auth = getAuth();
    
    // Firebase Auth로 사용자 생성
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // 사용자 프로필 업데이트
    await updateProfile(firebaseUser, {
      displayName: profile.displayName
    });
    
    // 이메일 인증 발송
    await sendEmailVerification(firebaseUser);
    
    // XRPL 지갑 생성
    const wallet = await generateXrplWallet();
    
    // 사용자 ID 생성 (이름 기반)
    const nameParts = profile.displayName.split(' ');
    const lastName = nameParts[0].toLowerCase();
    const firstName = nameParts.length > 1 ? nameParts[1].toLowerCase() : '';
    const userId = `user_${lastName}_${firstName}_${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    // Firestore에 사용자 데이터 저장
    await setDoc(doc(db, 'users', userId), {
      userId,
      auth: {
        firebaseUid: firebaseUser.uid,
        email,
        role: 'user',
        emailVerified: false,
        lastLogin: Timestamp.now()
      },
      profile,
      medical,
      xrpl: {
        walletAddress: wallet.address,
        encryptedSeed: wallet.encryptedSeed,
        balance: 0,
        totalEarned: 0
      },
      dataQuality: {
        currentGrade: 'C',
        qualityScore: 50,
        completenessRate: 0,
        consistencyScore: 0,
        recentDataCount: 0,
        longestStreak: 0,
        currentStreak: 0
      },
      privacy,
      stats: {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalPoolParticipations: 0,
        totalDataPoints: 0,
        totalEarnings: 0
      },
      createdAt: Timestamp.now(),
      lastUpdated: Timestamp.now()
    });
    
    return userId;
  } catch (error) {
    console.error('사용자 등록 오류:', error);
    throw error;
  }
};

/**
 * 사용자 로그인 함수
 * 
 * @param email 사용자 이메일
 * @param password 사용자 비밀번호
 * @returns 사용자 정보
 */
export const loginUser = async (email: string, password: string): Promise<{userId: string, user: FirebaseUser}> => {
  try {
    const auth = getAuth();
    
    // Firebase Auth로 로그인
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    
    // Firestore에서 사용자 정보 조회
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('auth.firebaseUid', '==', firebaseUser.uid).get();
    
    if (snapshot.empty) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    const userId = snapshot.docs[0].id;
    
    // 마지막 로그인 시간 업데이트
    await updateDoc(doc(db, 'users', userId), {
      'auth.lastLogin': Timestamp.now(),
      'lastUpdated': Timestamp.now()
    });
    
    return { userId, user: firebaseUser };
  } catch (error) {
    console.error('로그인 오류:', error);
    throw error;
  }
};

/**
 * 사용자 정보 조회 함수
 * 
 * @param userId 사용자 ID
 * @returns 사용자 정보
 */
export const getUserInfo = async (userId: string): Promise<any> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      throw new Error('사용자 정보를 찾을 수 없습니다.');
    }
    
    return userDoc.data();
  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    throw error;
  }
};

/**
 * 사용자 프로필 업데이트 함수
 * 
 * @param userId 사용자 ID
 * @param profile 업데이트할 프로필 정보
 */
export const updateUserProfile = async (userId: string, profile: Partial<UserProfile>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // 프로필 정보 업데이트
    await updateDoc(userRef, {
      'profile': profile,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('프로필 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 사용자 의료 정보 업데이트 함수
 * 
 * @param userId 사용자 ID
 * @param medical 업데이트할 의료 정보
 */
export const updateUserMedical = async (userId: string, medical: Partial<UserMedical>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // 의료 정보 업데이트
    await updateDoc(userRef, {
      'medical': medical,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('의료 정보 업데이트 오류:', error);
    throw error;
  }
};

/**
 * 사용자 개인정보 설정 업데이트 함수
 * 
 * @param userId 사용자 ID
 * @param privacy 업데이트할 개인정보 설정
 */
export const updateUserPrivacy = async (userId: string, privacy: Partial<UserPrivacy>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // 개인정보 설정 업데이트
    await updateDoc(userRef, {
      'privacy': privacy,
      'lastUpdated': Timestamp.now()
    });
  } catch (error) {
    console.error('개인정보 설정 업데이트 오류:', error);
    throw error;
  }
};
