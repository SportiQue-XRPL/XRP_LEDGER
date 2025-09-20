/**
 * Firebase Integration Functions for SportiQue
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import {
  UserProfile,
  EnterpriseProfile,
  Subscription,
  DataPool,
  SubscriptionNFT,
  PoolNFT,
  AnonymizedHealthData
} from './types';
import { FIREBASE_CONFIG } from './config';

// Firebase configuration (should be in environment variables)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || 'sportique-platform',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/**
 * Save user wallet to Firebase
 */
export async function saveUserWallet(
  userId: string,
  walletAddress: string,
  encryptedSeed?: string
): Promise<void> {
  const userRef = doc(db, FIREBASE_CONFIG.collections.USERS, userId);
  await updateDoc(userRef, {
    walletAddress,
    walletSeed: encryptedSeed || null,
    updatedAt: Timestamp.now()
  });
}

/**
 * Save enterprise wallet to Firebase
 */
export async function saveEnterpriseWallet(
  enterpriseId: string,
  walletAddress: string,
  encryptedSeed?: string
): Promise<void> {
  const enterpriseRef = doc(db, FIREBASE_CONFIG.collections.ENTERPRISES, enterpriseId);
  await updateDoc(enterpriseRef, {
    walletAddress,
    walletSeed: encryptedSeed || null,
    updatedAt: Timestamp.now()
  });
}

/**
 * Save subscription NFT to Firebase
 */
export async function saveSubscriptionNFT(nft: SubscriptionNFT): Promise<void> {
  const nftRef = doc(
    db,
    FIREBASE_CONFIG.collections.NFT_REGISTRY,
    'subscription_nfts',
    nft.id
  );
  await setDoc(nftRef, nft);
}

/**
 * Save pool NFT to Firebase
 */
export async function savePoolNFT(nft: PoolNFT): Promise<void> {
  const nftRef = doc(
    db,
    FIREBASE_CONFIG.collections.NFT_REGISTRY,
    'pool_nfts',
    nft.id
  );
  await setDoc(nftRef, nft);
}

/**
 * Update subscription status
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  enterpriseId: string,
  status: Subscription['status'],
  additionalData?: Partial<Subscription>
): Promise<void> {
  const subscriptionRef = doc(
    db,
    FIREBASE_CONFIG.collections.ENTERPRISES,
    enterpriseId,
    'subscriptions',
    subscriptionId
  );

  await updateDoc(subscriptionRef, {
    status,
    ...additionalData,
    updatedAt: Timestamp.now()
  });
}

/**
 * Update data pool status
 */
export async function updateDataPoolStatus(
  poolId: string,
  status: DataPool['status'],
  additionalData?: Partial<DataPool>
): Promise<void> {
  const poolRef = doc(
    db,
    FIREBASE_CONFIG.collections.SPORTIQUE,
    'datapools',
    poolId
  );

  await updateDoc(poolRef, {
    status,
    ...additionalData,
    updatedAt: Timestamp.now()
  });
}

/**
 * Add NFT to allowed list for health data
 */
export async function addNFTToHealthDataAccess(
  dataHash: string,
  nftId: string
): Promise<void> {
  const dataRef = doc(
    db,
    FIREBASE_CONFIG.collections.ANONYMIZED_HEALTH_DATA,
    dataHash
  );

  await updateDoc(dataRef, {
    'accessControl.allowedNfts': arrayUnion(nftId)
  });
}

/**
 * Remove NFT from allowed list for health data
 */
export async function removeNFTFromHealthDataAccess(
  dataHash: string,
  nftId: string
): Promise<void> {
  const dataRef = doc(
    db,
    FIREBASE_CONFIG.collections.ANONYMIZED_HEALTH_DATA,
    dataHash
  );

  await updateDoc(dataRef, {
    'accessControl.allowedNfts': arrayRemove(nftId)
  });
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, FIREBASE_CONFIG.collections.USERS, userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
}

/**
 * Get enterprise profile
 */
export async function getEnterpriseProfile(enterpriseId: string): Promise<EnterpriseProfile | null> {
  const enterpriseRef = doc(db, FIREBASE_CONFIG.collections.ENTERPRISES, enterpriseId);
  const enterpriseSnap = await getDoc(enterpriseRef);

  if (enterpriseSnap.exists()) {
    return enterpriseSnap.data() as EnterpriseProfile;
  }
  return null;
}

/**
 * Get active subscriptions for enterprise
 */
export async function getActiveSubscriptions(enterpriseId: string): Promise<Subscription[]> {
  const subscriptionsRef = collection(
    db,
    FIREBASE_CONFIG.collections.ENTERPRISES,
    enterpriseId,
    'subscriptions'
  );

  const q = query(subscriptionsRef, where('status', '==', 'active'));
  const querySnapshot = await getDocs(q);

  const subscriptions: Subscription[] = [];
  querySnapshot.forEach((doc) => {
    subscriptions.push({ id: doc.id, ...doc.data() } as Subscription);
  });

  return subscriptions;
}

/**
 * Get data pool participants
 */
export async function getDataPoolParticipants(poolId: string): Promise<string[]> {
  const poolRef = doc(
    db,
    FIREBASE_CONFIG.collections.SPORTIQUE,
    'datapools',
    poolId
  );

  const poolSnap = await getDoc(poolRef);

  if (poolSnap.exists()) {
    const pool = poolSnap.data() as DataPool;
    return pool.participants || [];
  }

  return [];
}

/**
 * Add participant to data pool
 */
export async function addParticipantToPool(
  poolId: string,
  userId: string
): Promise<void> {
  const poolRef = doc(
    db,
    FIREBASE_CONFIG.collections.SPORTIQUE,
    'datapools',
    poolId
  );

  await updateDoc(poolRef, {
    participants: arrayUnion(userId),
    currentParticipants: (await getDoc(poolRef)).data()?.currentParticipants + 1 || 1,
    updatedAt: Timestamp.now()
  });
}

/**
 * Update user XRP balance
 */
export async function updateUserXRPBalance(
  userId: string,
  balance: number
): Promise<void> {
  const userRef = doc(db, FIREBASE_CONFIG.collections.USERS, userId);
  await updateDoc(userRef, {
    xrpBalance: balance,
    updatedAt: Timestamp.now()
  });
}

/**
 * Update enterprise XRP balance
 */
export async function updateEnterpriseXRPBalance(
  enterpriseId: string,
  balance: number
): Promise<void> {
  const enterpriseRef = doc(db, FIREBASE_CONFIG.collections.ENTERPRISES, enterpriseId);
  await updateDoc(enterpriseRef, {
    xrpBalance: balance,
    updatedAt: Timestamp.now()
  });
}

/**
 * Get health data by NFT access
 */
export async function getHealthDataByNFT(nftId: string): Promise<AnonymizedHealthData[]> {
  const healthDataRef = collection(db, FIREBASE_CONFIG.collections.ANONYMIZED_HEALTH_DATA);
  const q = query(
    healthDataRef,
    where('accessControl.allowedNfts', 'array-contains', nftId)
  );

  const querySnapshot = await getDocs(q);
  const healthData: AnonymizedHealthData[] = [];

  querySnapshot.forEach((doc) => {
    healthData.push({ dataHash: doc.id, ...doc.data() } as AnonymizedHealthData);
  });

  return healthData;
}