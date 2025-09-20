/**
 * SportiQue - NFT 기반 데이터 접근 제어
 * 
 * NFT 소유권을 확인하여 데이터 접근 권한을 제어하는 시스템
 */

import { Client, Wallet } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, getDoc, Timestamp, addDoc } from 'firebase/firestore';

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBlkthPW-3LCSVvyXg4k8yYZ7lx_5RZg3E",
  authDomain: "xrplhackathon-9bf0a.firebaseapp.com",
  projectId: "xrplhackathon-9bf0a",
  storageBucket: "xrplhackathon-9bf0a.appspot.com",
  messagingSenderId: "235937752656",
  appId: "1:235937752656:web:abcdef1234567890abcdef"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// XRPL 테스트넷 서버 URL
const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

/**
 * 지갑의 NFT 소유권 확인 함수
 * 
 * @param walletAddress XRPL 지갑 주소
 * @returns 소유한 NFT 목록
 */
export async function checkNFTOwnership(walletAddress: string): Promise<any> {
  try {
    console.log(`Checking NFT ownership for wallet ${walletAddress}...`);
    
    // XRPL 클라이언트 연결
    const client = new Client(TESTNET_URL);
    await client.connect();
    console.log('Connected to XRPL Testnet');
    
    // 지갑의 NFT 목록 조회
    const nfts = await client.request({
      command: 'account_nfts',
      account: walletAddress
    });
    
    // 클라이언트 연결 종료
    await client.disconnect();
    console.log('Disconnected from XRPL Testnet');
    
    console.log(`Found ${nfts.result.account_nfts.length} NFTs for wallet ${walletAddress}`);
    
    // Firebase에서 NFT 정보 조회
    const nftQuery = query(collection(db, 'nfts'), where('ownership.currentOwner', '==', walletAddress));
    const nftSnapshot = await getDocs(nftQuery);
    
    const ownedNFTs = [];
    
    for (const doc of nftSnapshot.docs) {
      const nft = doc.data();
      ownedNFTs.push({
        nftId: nft.nftId,
        tokenId: nft.tokenId,
        type: nft.type,
        source: nft.source,
        metadata: nft.metadata,
        dataAccess: nft.dataAccess,
        xrpl: nft.xrpl
      });
    }
    
    console.log(`Found ${ownedNFTs.length} NFTs in Firebase for wallet ${walletAddress}`);
    
    return {
      success: true,
      walletAddress,
      xrplNFTs: nfts.result.account_nfts,
      ownedNFTs
    };
  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 구독 NFT 기반 데이터 접근 함수
 * 
 * @param enterpriseId 기업 ID
 * @param nftId NFT ID
 * @returns 접근 가능한 데이터
 */
export async function accessSubscriptionData(enterpriseId: string, nftId: string): Promise<any> {
  try {
    console.log(`Accessing subscription data for enterprise ${enterpriseId} with NFT ${nftId}...`);
    
    // NFT 정보 조회
    const nftQuery = query(
      collection(db, 'nfts'),
      where('nftId', '==', nftId),
      where('ownership.currentOwner', '==', enterpriseId),
      where('type', '==', 'subscription')
    );
    
    const nftSnapshot = await getDocs(nftQuery);
    
    if (nftSnapshot.empty) {
      throw new Error(`NFT ${nftId} not found or not owned by enterprise ${enterpriseId}`);
    }
    
    const nft = nftSnapshot.docs[0].data();
    console.log(`NFT found: ${nft.tokenId}`);
    
    // 접근 권한 확인
    if (nft.dataAccess.accessLevel !== 'full') {
      throw new Error(`NFT ${nftId} does not have full access level`);
    }
    
    // 만료 확인
    if (nft.dataAccess.expiryDate.toDate() < new Date()) {
      throw new Error(`NFT ${nftId} access has expired on ${nft.dataAccess.expiryDate.toDate()}`);
    }
    
    // 구독 정보 조회
    const subscriptionId = nft.source.sourceId;
    const subscriptionRef = doc(db, 'subscriptions', subscriptionId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    
    if (!subscriptionDoc.exists()) {
      throw new Error(`Subscription ${subscriptionId} not found`);
    }
    
    const subscription = subscriptionDoc.data();
    console.log(`Subscription found: ${subscriptionId}`);
    
    // 사용자 정보 조회
    const userId = subscription.userId;
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error(`User ${userId} not found`);
    }
    
    const user = userDoc.data();
    
    // 익명화된 사용자 정보
    const anonymizedUser = {
      age: user.profile.age,
      gender: user.profile.gender,
      height: user.profile.height,
      weight: user.profile.weight,
      bloodType: user.profile.bloodType,
      conditions: user.medical.conditions,
      medications: user.medical.medications,
      allergies: user.medical.allergies,
      dataQuality: user.dataQuality
    };
    
    // 건강 데이터 조회
    const dataQuery = query(
      collection(db, 'health_data'),
      where('userId', '==', userId),
      where('subscriptionId', '==', subscriptionId)
    );
    
    const dataSnapshot = await getDocs(dataQuery);
    
    const healthData = [];
    
    for (const doc of dataSnapshot.docs) {
      const data = doc.data();
      
      // 데이터 익명화
      const anonymizedData = {
        dataId: data.dataId,
        timestamp: data.timestamp,
        date: data.date,
        dataType: data.dataType,
        measurements: data.measurements,
        context: data.context,
        quality: data.quality
      };
      
      healthData.push(anonymizedData);
    }
    
    console.log(`Found ${healthData.length} health data records for subscription ${subscriptionId}`);
    
    // 접근 로그 기록
    const accessLog = {
      nftId,
      enterpriseId,
      subscriptionId,
      userId,
      accessTime: Timestamp.now(),
      dataCount: healthData.length
    };
    
    await addDoc(collection(db, 'access_logs'), accessLog);
    console.log(`Access log created for NFT ${nftId}`);
    
    return {
      success: true,
      nftId,
      subscriptionId,
      anonymizedUser,
      healthData,
      accessTime: accessLog.accessTime
    };
  } catch (error) {
    console.error('Error accessing subscription data:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 풀 NFT 기반 데이터 접근 함수
 * 
 * @param enterpriseId 기업 ID
 * @param nftId NFT ID
 * @returns 접근 가능한 데이터
 */
export async function accessPoolData(enterpriseId: string, nftId: string): Promise<any> {
  try {
    console.log(`Accessing pool data for enterprise ${enterpriseId} with NFT ${nftId}...`);
    
    // NFT 정보 조회
    const nftQuery = query(
      collection(db, 'nfts'),
      where('nftId', '==', nftId),
      where('ownership.currentOwner', '==', enterpriseId),
      where('type', '==', 'pool')
    );
    
    const nftSnapshot = await getDocs(nftQuery);
    
    if (nftSnapshot.empty) {
      throw new Error(`NFT ${nftId} not found or not owned by enterprise ${enterpriseId}`);
    }
    
    const nft = nftSnapshot.docs[0].data();
    console.log(`NFT found: ${nft.tokenId}`);
    
    // 접근 권한 확인
    if (nft.dataAccess.accessLevel !== 'aggregate') {
      throw new Error(`NFT ${nftId} does not have aggregate access level`);
    }
    
    // 만료 확인
    if (nft.dataAccess.expiryDate.toDate() < new Date()) {
      throw new Error(`NFT ${nftId} access has expired on ${nft.dataAccess.expiryDate.toDate()}`);
    }
    
    // 풀 정보 조회
    const poolId = nft.source.sourceId;
    const poolRef = doc(db, 'data_pools', poolId);
    const poolDoc = await getDoc(poolRef);
    
    if (!poolDoc.exists()) {
      throw new Error(`Data pool ${poolId} not found`);
    }
    
    const pool = poolDoc.data();
    console.log(`Data pool found: ${poolId}`);
    
    // 풀 데이터 조회
    const poolDataQuery = query(
      collection(db, 'pool_data'),
      where('poolId', '==', poolId)
    );
    
    const poolDataSnapshot = await getDocs(poolDataQuery);
    
    const aggregateData = [];
    
    for (const doc of poolDataSnapshot.docs) {
      const data = doc.data();
      aggregateData.push({
        date: data.date,
        dataType: data.dataType,
        participantCount: data.participantCount,
        dataPointCount: data.dataPointCount,
        qualityAverage: data.qualityAverage,
        aggregates: data.aggregates
      });
    }
    
    console.log(`Found ${aggregateData.length} aggregate data records for pool ${poolId}`);
    
    // 접근 로그 기록
    const accessLog = {
      nftId,
      enterpriseId,
      poolId,
      accessTime: Timestamp.now(),
      dataCount: aggregateData.length
    };
    
    await addDoc(collection(db, 'access_logs'), accessLog);
    console.log(`Access log created for NFT ${nftId}`);
    
    return {
      success: true,
      nftId,
      poolId,
      poolInfo: {
        name: pool.name,
        description: pool.description,
        dataType: pool.dataType,
        category: pool.category,
        period: {
          start: pool.schedule.activeStartDate,
          end: pool.schedule.activeEndDate
        },
        participants: pool.userParticipation.registeredUsers,
        completedUsers: pool.userParticipation.completedUsers,
        qualityAverage: pool.userParticipation.qualityAverage
      },
      aggregateData,
      accessTime: accessLog.accessTime
    };
  } catch (error) {
    console.error('Error accessing pool data:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 데이터 CSV 내보내기 함수
 * 
 * @param enterpriseId 기업 ID
 * @param nftId NFT ID
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns CSV 데이터
 */
export async function exportDataToCSV(
  enterpriseId: string,
  nftId: string,
  startDate: string,
  endDate: string
): Promise<any> {
  try {
    console.log(`Exporting data to CSV for enterprise ${enterpriseId} with NFT ${nftId}...`);
    
    // NFT 정보 조회
    const nftQuery = query(
      collection(db, 'nfts'),
      where('nftId', '==', nftId),
      where('ownership.currentOwner', '==', enterpriseId)
    );
    
    const nftSnapshot = await getDocs(nftQuery);
    
    if (nftSnapshot.empty) {
      throw new Error(`NFT ${nftId} not found or not owned by enterprise ${enterpriseId}`);
    }
    
    const nft = nftSnapshot.docs[0].data();
    console.log(`NFT found: ${nft.tokenId}`);
    
    // 접근 권한 확인
    if (!nft.dataAccess.allowedOperations.includes('export')) {
      throw new Error(`NFT ${nftId} does not have export permission`);
    }
    
    // 만료 확인
    if (nft.dataAccess.expiryDate.toDate() < new Date()) {
      throw new Error(`NFT ${nftId} access has expired on ${nft.dataAccess.expiryDate.toDate()}`);
    }
    
    let csvData = '';
    
    // NFT 유형에 따라 다른 처리
    if (nft.type === 'subscription') {
      // 구독 NFT인 경우
      const subscriptionId = nft.source.sourceId;
      const userId = nft.source.userId;
      
      // 건강 데이터 조회
      const dataQuery = query(
        collection(db, 'health_data'),
        where('userId', '==', userId),
        where('subscriptionId', '==', subscriptionId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const dataSnapshot = await getDocs(dataQuery);
      
      // CSV 헤더
      csvData = 'Date,DataType,Value,Unit,MealRelation,Quality,Grade\n';
      
      // CSV 데이터 생성
      for (const doc of dataSnapshot.docs) {
        const data = doc.data();
        
        // 데이터 유형에 따라 다른 처리
        if (data.dataType === 'glucose') {
          csvData += `${data.date},${data.dataType},${data.measurements.glucose.value},${data.measurements.glucose.unit},${data.measurements.glucose.mealRelation},${data.quality.score},${data.quality.grade}\n`;
        } else if (data.dataType === 'blood_pressure') {
          csvData += `${data.date},${data.dataType},${data.measurements.blood_pressure.systolic}/${data.measurements.blood_pressure.diastolic},mmHg,${data.measurements.blood_pressure.position},${data.quality.score},${data.quality.grade}\n`;
        } else if (data.dataType === 'heart_rate') {
          csvData += `${data.date},${data.dataType},${data.measurements.heart_rate.value},bpm,${data.measurements.heart_rate.activity},${data.quality.score},${data.quality.grade}\n`;
        }
      }
      
      console.log(`Generated CSV with ${dataSnapshot.size} records for subscription ${subscriptionId}`);
    } else if (nft.type === 'pool') {
      // 풀 NFT인 경우
      const poolId = nft.source.sourceId;
      
      // 풀 데이터 조회
      const poolDataQuery = query(
        collection(db, 'pool_data'),
        where('poolId', '==', poolId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const poolDataSnapshot = await getDocs(poolDataQuery);
      
      // CSV 헤더
      csvData = 'Date,DataType,ParticipantCount,DataPointCount,QualityAverage,Average,Min,Max,Median\n';
      
      // CSV 데이터 생성
      for (const doc of poolDataSnapshot.docs) {
        const data = doc.data();
        
        // 데이터 유형에 따라 다른 처리
        if (data.dataType === 'glucose') {
          csvData += `${data.date},${data.dataType},${data.participantCount},${data.dataPointCount},${data.qualityAverage},${data.aggregates.glucose.average},${data.aggregates.glucose.min},${data.aggregates.glucose.max},${data.aggregates.glucose.median}\n`;
        } else if (data.dataType === 'blood_pressure') {
          csvData += `${data.date},${data.dataType},${data.participantCount},${data.dataPointCount},${data.qualityAverage},${data.aggregates.blood_pressure.systolic_avg}/${data.aggregates.blood_pressure.diastolic_avg},${data.aggregates.blood_pressure.systolic_min}/${data.aggregates.blood_pressure.diastolic_min},${data.aggregates.blood_pressure.systolic_max}/${data.aggregates.blood_pressure.diastolic_max},${data.aggregates.blood_pressure.systolic_median}/${data.aggregates.blood_pressure.diastolic_median}\n`;
        } else if (data.dataType === 'heart_rate') {
          csvData += `${data.date},${data.dataType},${data.participantCount},${data.dataPointCount},${data.qualityAverage},${data.aggregates.heart_rate.average},${data.aggregates.heart_rate.min},${data.aggregates.heart_rate.max},${data.aggregates.heart_rate.median}\n`;
        }
      }
      
      console.log(`Generated CSV with ${poolDataSnapshot.size} records for pool ${poolId}`);
    } else {
      throw new Error(`Unknown NFT type: ${nft.type}`);
    }
    
    // 접근 로그 기록
    const accessLog = {
      nftId,
      enterpriseId,
      sourceId: nft.source.sourceId,
      sourceType: nft.source.sourceType,
      accessType: 'export_csv',
      accessTime: Timestamp.now(),
      dateRange: {
        startDate,
        endDate
      }
    };
    
    await addDoc(collection(db, 'access_logs'), accessLog);
    console.log(`Access log created for NFT ${nftId}`);
    
    return {
      success: true,
      nftId,
      sourceType: nft.type,
      sourceId: nft.source.sourceId,
      csvData,
      dateRange: {
        startDate,
        endDate
      },
      accessTime: accessLog.accessTime
    };
  } catch (error) {
    console.error('Error exporting data to CSV:', error);
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message
    };
  }
}

/**
 * 테스트 실행 함수
 */
async function testNFTAccessControl() {
  // 테스트 파라미터
  const walletAddress = 'rEnterprise123456789ABCDEF';
  const enterpriseId = 'enterprise_123456';
  const subscriptionNftId = 'nft_sub_123456_202509';
  const poolNftId = 'nft_pool_glucose_202509_enterprise_123456_202509';
  const startDate = '2025-09-01';
  const endDate = '2025-09-30';
  
  // NFT 소유권 확인
  console.log('Testing NFT ownership check...');
  const ownershipResult = await checkNFTOwnership(walletAddress);
  console.log('NFT ownership result:', ownershipResult);
  
  // 구독 데이터 접근
  console.log('\nTesting subscription data access...');
  const subscriptionResult = await accessSubscriptionData(enterpriseId, subscriptionNftId);
  console.log('Subscription data access result:', subscriptionResult);
  
  // 풀 데이터 접근
  console.log('\nTesting pool data access...');
  const poolResult = await accessPoolData(enterpriseId, poolNftId);
  console.log('Pool data access result:', poolResult);
  
  // 데이터 CSV 내보내기
  console.log('\nTesting data export to CSV...');
  const exportResult = await exportDataToCSV(enterpriseId, subscriptionNftId, startDate, endDate);
  console.log('Data export result:', exportResult);
}

// 직접 실행 시 테스트 함수 호출
if (require.main === module) {
  testNFTAccessControl()
    .then(() => console.log('Test completed'))
    .catch(error => console.error('Test failed:', error));
}
