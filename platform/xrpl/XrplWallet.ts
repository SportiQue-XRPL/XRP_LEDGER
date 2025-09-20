/**
 * SportiQue - XRPL 지갑 관리 기능
 * 
 * XRPL 지갑 생성, 관리, 트랜잭션 서명을 담당하는 모듈
 */

import { Client, Wallet, dropsToXrp, xrpToDrops } from 'xrpl';
import * as CryptoJS from 'crypto-js';

// XRPL 테스트넷 서버 URL
const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

// 암호화 키 (실제 환경에서는 환경 변수로 관리)
const ENCRYPTION_KEY = 'sportique_secret_key_for_wallet_encryption';

/**
 * XRPL 클라이언트 연결 함수
 * 
 * @returns XRPL 클라이언트 인스턴스
 */
export const connectXrplClient = async (): Promise<Client> => {
  try {
    const client = new Client(TESTNET_URL);
    await client.connect();
    return client;
  } catch (error) {
    console.error('XRPL 클라이언트 연결 오류:', error);
    throw error;
  }
};

/**
 * XRPL 지갑 생성 함수
 * 
 * @returns 생성된 지갑 정보
 */
export const generateXrplWallet = async (): Promise<{ address: string, encryptedSeed: string }> => {
  try {
    const client = await connectXrplClient();
    
    // 새 지갑 생성
    const { wallet } = await client.fundWallet();
    
    // 시드 암호화
    const encryptedSeed = encryptSeed(wallet.seed);
    
    await client.disconnect();
    
    return {
      address: wallet.address,
      encryptedSeed
    };
  } catch (error) {
    console.error('XRPL 지갑 생성 오류:', error);
    throw error;
  }
};

/**
 * 시드 암호화 함수
 * 
 * @param seed 암호화할 시드
 * @returns 암호화된 시드
 */
export const encryptSeed = (seed: string): string => {
  try {
    return CryptoJS.AES.encrypt(seed, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('시드 암호화 오류:', error);
    throw error;
  }
};

/**
 * 시드 복호화 함수
 * 
 * @param encryptedSeed 복호화할 암호화된 시드
 * @returns 복호화된 시드
 */
export const decryptSeed = (encryptedSeed: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedSeed, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('시드 복호화 오류:', error);
    throw error;
  }
};

/**
 * 지갑 잔액 조회 함수
 * 
 * @param address 지갑 주소
 * @returns 지갑 잔액 (XRP)
 */
export const getWalletBalance = async (address: string): Promise<number> => {
  try {
    const client = await connectXrplClient();
    
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    
    await client.disconnect();
    
    // Drops를 XRP로 변환
    const balance = dropsToXrp(response.result.account_data.Balance);
    return parseFloat(balance);
  } catch (error) {
    console.error('지갑 잔액 조회 오류:', error);
    throw error;
  }
};

/**
 * XRP 전송 함수
 * 
 * @param fromWalletEncryptedSeed 보내는 지갑의 암호화된 시드
 * @param toAddress 받는 지갑 주소
 * @param amount 전송할 금액 (XRP)
 * @param memo 메모 (선택적)
 * @returns 트랜잭션 해시
 */
export const sendXrp = async (
  fromWalletEncryptedSeed: string,
  toAddress: string,
  amount: number,
  memo?: string
): Promise<string> => {
  try {
    const client = await connectXrplClient();
    
    // 시드 복호화
    const seed = decryptSeed(fromWalletEncryptedSeed);
    const wallet = Wallet.fromSeed(seed);
    
    // 트랜잭션 준비
    const prepared = await client.autofill({
      TransactionType: 'Payment',
      Account: wallet.address,
      Amount: xrpToDrops(amount),
      Destination: toAddress,
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
      throw new Error(`트랜잭션 실패: ${result.result.meta.TransactionResult}`);
    }
    
    return result.result.hash;
  } catch (error) {
    console.error('XRP 전송 오류:', error);
    throw error;
  }
};

/**
 * 트랜잭션 조회 함수
 * 
 * @param txHash 트랜잭션 해시
 * @returns 트랜잭션 정보
 */
export const getTransaction = async (txHash: string): Promise<any> => {
  try {
    const client = await connectXrplClient();
    
    const response = await client.request({
      command: 'tx',
      transaction: txHash
    });
    
    await client.disconnect();
    
    return response.result;
  } catch (error) {
    console.error('트랜잭션 조회 오류:', error);
    throw error;
  }
};

/**
 * 지갑 트랜잭션 내역 조회 함수
 * 
 * @param address 지갑 주소
 * @param limit 조회할 트랜잭션 수 (선택적)
 * @returns 트랜잭션 내역
 */
export const getWalletTransactions = async (address: string, limit: number = 20): Promise<any[]> => {
  try {
    const client = await connectXrplClient();
    
    const response = await client.request({
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit
    });
    
    await client.disconnect();
    
    return response.result.transactions;
  } catch (error) {
    console.error('지갑 트랜잭션 내역 조회 오류:', error);
    throw error;
  }
};

/**
 * 지갑 정보 조회 함수
 * 
 * @param address 지갑 주소
 * @returns 지갑 정보
 */
export const getWalletInfo = async (address: string): Promise<any> => {
  try {
    const client = await connectXrplClient();
    
    const accountInfo = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });
    
    const accountObjects = await client.request({
      command: 'account_objects',
      account: address,
      ledger_index: 'validated',
      type: 'escrow'
    });
    
    await client.disconnect();
    
    return {
      accountInfo: accountInfo.result.account_data,
      escrows: accountObjects.result.account_objects
    };
  } catch (error) {
    console.error('지갑 정보 조회 오류:', error);
    throw error;
  }
};
