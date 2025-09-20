/**
 * SportiQue - XRPL 에스크로 관리 기능
 * 
 * XRPL 에스크로 생성, 실행, 취소를 담당하는 모듈
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { connectXrplClient, decryptSeed } from './XrplWallet';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * 에스크로 생성 함수
 * 
 * @param fromWalletAddress 보내는 지갑 주소
 * @param toWalletAddress 받는 지갑 주소
 * @param amount 에스크로 금액 (XRP)
 * @param duration 에스크로 기간 (일)
 * @param memo 메모 (선택적)
 * @returns 에스크로 정보
 */
export const createEscrow = async (
  fromWalletAddress: string,
  toWalletAddress: string,
  amount: number,
  duration: number,
  memo?: string
): Promise<{ txHash: string, escrowAddress: string }> => {
  try {
    const client = await connectXrplClient();
    
    // 지갑 정보 조회
    const walletRef = db.collection('enterprises').doc(fromWalletAddress.split('_')[1]).collection('wallets').doc('wallet_master');
    const walletDoc = await getDoc(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error('지갑 정보를 찾을 수 없습니다.');
    }
    
    const walletData = walletDoc.data();
    
    // 시드 복호화
    const seed = decryptSeed(walletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // 종료 시간 계산 (현재 시간 + duration일)
    const finishAfter = Math.floor(Date.now() / 1000) + (duration * 24 * 60 * 60);
    
    // 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'EscrowCreate',
      Account: wallet.address,
      Destination: toWalletAddress,
      Amount: xrpToDrops(amount),
      FinishAfter: finishAfter,
      Condition: null, // 조건 없음
      Memos: memo ? [{
        Memo: {
          MemoData: Buffer.from(memo, 'utf8').toString('hex')
        }
      }] : undefined
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`에스크로 생성 실패: ${result.result.meta.TransactionResult}`);
    }
    
    // 에스크로 주소 생성 (실제로는 에스크로 ID를 사용해야 함)
    const escrowAddress = `r${wallet.address.substring(1, 10)}Escrow${Math.floor(Math.random() * 1000000)}`;
    
    // 지갑 잔액 업데이트
    await updateDoc(walletRef, {
      'balance.available': walletData.balance.available - amount,
      'balance.escrow': walletData.balance.escrow + amount,
      'balance.total': walletData.balance.total,
      'balance.lastUpdated': Timestamp.now()
    });
    
    return {
      txHash: result.result.hash,
      escrowAddress
    };
  } catch (error) {
    console.error('에스크로 생성 오류:', error);
    throw error;
  }
};

/**
 * 에스크로 실행 함수
 * 
 * @param escrowAddress 에스크로 주소
 * @param ownerWalletAddress 에스크로 소유자 지갑 주소
 * @returns 트랜잭션 해시
 */
export const executeEscrow = async (
  escrowAddress: string,
  ownerWalletAddress: string
): Promise<string> => {
  try {
    const client = await connectXrplClient();
    
    // 지갑 정보 조회
    const walletRef = db.collection('enterprises').doc(ownerWalletAddress.split('_')[1]).collection('wallets').doc('wallet_master');
    const walletDoc = await getDoc(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error('지갑 정보를 찾을 수 없습니다.');
    }
    
    const walletData = walletDoc.data();
    
    // 시드 복호화
    const seed = decryptSeed(walletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // 에스크로 정보 조회 (실제로는 에스크로 ID를 사용해야 함)
    const escrowSequence = 123456; // 예시 값
    
    // 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'EscrowFinish',
      Account: wallet.address,
      Owner: ownerWalletAddress,
      OfferSequence: escrowSequence
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`에스크로 실행 실패: ${result.result.meta.TransactionResult}`);
    }
    
    return result.result.hash;
  } catch (error) {
    console.error('에스크로 실행 오류:', error);
    throw error;
  }
};

/**
 * 에스크로 취소 함수
 * 
 * @param escrowAddress 에스크로 주소
 * @param ownerWalletAddress 에스크로 소유자 지갑 주소
 * @returns 트랜잭션 해시
 */
export const cancelEscrow = async (
  escrowAddress: string,
  ownerWalletAddress: string
): Promise<string> => {
  try {
    const client = await connectXrplClient();
    
    // 지갑 정보 조회
    const walletRef = db.collection('enterprises').doc(ownerWalletAddress.split('_')[1]).collection('wallets').doc('wallet_master');
    const walletDoc = await getDoc(walletRef);
    
    if (!walletDoc.exists()) {
      throw new Error('지갑 정보를 찾을 수 없습니다.');
    }
    
    const walletData = walletDoc.data();
    
    // 시드 복호화
    const seed = decryptSeed(walletData.security.encryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // 에스크로 정보 조회 (실제로는 에스크로 ID를 사용해야 함)
    const escrowSequence = 123456; // 예시 값
    
    // 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'EscrowCancel',
      Account: wallet.address,
      Owner: ownerWalletAddress,
      OfferSequence: escrowSequence
    });
    
    // 트랜잭션 서명
    const signed = wallet.sign(prepared);
    
    // 트랜잭션 제출
    const result = await client.submitAndWait(signed.tx_blob);
    
    await client.disconnect();
    
    if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`에스크로 취소 실패: ${result.result.meta.TransactionResult}`);
    }
    
    return result.result.hash;
  } catch (error) {
    console.error('에스크로 취소 오류:', error);
    throw error;
  }
};

/**
 * 에스크로 상태 조회 함수
 * 
 * @param escrowAddress 에스크로 주소
 * @returns 에스크로 상태
 */
export const getEscrowStatus = async (escrowAddress: string): Promise<any> => {
  try {
    // 실제로는 XRPL API를 사용하여 에스크로 상태를 조회해야 함
    // 여기서는 예시 데이터 반환
    return {
      status: 'active',
      amount: 1000,
      remainingAmount: 750,
      usedAmount: 250,
      finishAfter: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
      owner: 'rSomeOwnerAddress123456789',
      destination: 'rSomeDestinationAddress123456789'
    };
  } catch (error) {
    console.error('에스크로 상태 조회 오류:', error);
    throw error;
  }
};

/**
 * 에스크로에서 보상 지급 함수
 * 
 * @param escrowAddress 에스크로 주소
 * @param toWalletAddress 받는 지갑 주소
 * @param amount 지급할 금액 (XRP)
 * @param memo 메모 (선택적)
 * @returns 트랜잭션 해시
 */
export const processXrplReward = async (
  escrowAddress: string,
  toWalletAddress: string,
  amount: number,
  memo?: string
): Promise<string> => {
  try {
    // 실제로는 XRPL API를 사용하여 에스크로에서 보상을 지급해야 함
    // 여기서는 예시 트랜잭션 해시 반환
    return `REWARD_TX_${Math.floor(Math.random() * 1000000000).toString(16)}`;
  } catch (error) {
    console.error('보상 지급 오류:', error);
    throw error;
  }
};
