import { Client, Transaction, Wallet, xrpToDrops } from 'xrpl';

/**
 * MPT (Multi-Purpose Token) v1 Implementation
 * XRPL의 새로운 토큰 표준을 활용한 포인트 기반 보상 시스템
 */
export class MPTokenManager {
  private client: Client;
  
  constructor(client: Client) {
    this.client = client;
  }
  
  /**
   * MPT 토큰 생성 - 기업별 데이터 포인트 토큰
   */
  async createDataPointToken(
    enterpriseWallet: Wallet,
    enterpriseId: string,
    options: {
      name: string;
      symbol: string;
      maxSupply: number;
      decimals?: number;
    }
  ): Promise<{
    result: any;
    tokenId: string;
  }> {
    const tokenId = this.generateTokenID(enterpriseId);
    
    const mptCreate: Transaction = {
      TransactionType: 'MPTokenIssuanceCreate',
      Account: enterpriseWallet.address,
      MPTokenIssuanceID: tokenId,
      Flags: {
        tfMPTCanLock: true,        // 잠금 가능
        tfMPTRequireAuth: true,    // 인증 필요
        tfMPTCanEscrow: true,      // 에스크로 가능
        tfMPTCanTrade: false,      // 거래 불가 (포인트용)
        tfMPTCanClawback: true     // 회수 가능
      },
      MaximumAmount: String(options.maxSupply),
      TransferFee: 0,              // 전송 수수료 없음
      MPTokenMetadata: {
        name: options.name,
        symbol: options.symbol,
        decimals: options.decimals || 2,
        issuer: enterpriseId,
        purpose: 'data_rewards',
        version: '1.0'
      },
      Memos: [{
        Memo: {
          MemoType: Buffer.from('mpt_creation', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            enterpriseId,
            tokenType: 'data_points',
            createdAt: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(mptCreate);
    const signed = enterpriseWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      result,
      tokenId
    };
  }
  
  /**
   * MPT 토큰 발행 - 사용자에게 포인트 지급
   */
  async mintDataPoints(
    enterpriseWallet: Wallet,
    tokenId: string,
    userWallet: Wallet,
    amount: number,
    reason: string
  ): Promise<{
    result: any;
    newBalance: number;
  }> {
    const mintTx: Transaction = {
      TransactionType: 'MPTokenIssuanceSet',
      Account: enterpriseWallet.address,
      MPTokenIssuanceID: tokenId,
      MPTokenHolder: userWallet.address,
      Amount: String(amount),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('point_reward', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            reason,
            amount,
            timestamp: new Date().toISOString(),
            type: 'data_reward'
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(mintTx);
    const signed = enterpriseWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    // 잔액 조회
    const balance = await this.getTokenBalance(userWallet.address, tokenId);
    
    return {
      result,
      newBalance: balance
    };
  }
  
  /**
   * MPT 토큰 소각 - 포인트를 XRP로 교환할 때
   */
  async burnDataPoints(
    userWallet: Wallet,
    tokenId: string,
    amount: number,
    exchangeRate: number = 100
  ): Promise<{
    result: any;
    xrpAmount: number;
  }> {
    const xrpAmount = amount / exchangeRate;
    
    const burnTx: Transaction = {
      TransactionType: 'MPTokenIssuanceDestroy',
      Account: userWallet.address,
      MPTokenIssuanceID: tokenId,
      Amount: String(amount),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('point_exchange', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            burnedPoints: amount,
            xrpAmount,
            exchangeRate,
            timestamp: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(burnTx);
    const signed = userWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      result,
      xrpAmount
    };
  }
  
  /**
   * MPT 토큰 잔액 조회
   */
  async getTokenBalance(
    walletAddress: string,
    tokenId: string
  ): Promise<number> {
    try {
      const response = await this.client.request({
        command: 'account_objects',
        account: walletAddress,
        type: 'mptoken_issuance'
      });
      
      const token = response.result.account_objects.find(
        (obj: any) => obj.MPTokenIssuanceID === tokenId
      );
      
      return token ? parseInt(token.Amount) : 0;
    } catch (error) {
      console.error('토큰 잔액 조회 오류:', error);
      return 0;
    }
  }
  
  /**
   * MPT 토큰 정보 조회
   */
  async getTokenInfo(tokenId: string): Promise<any> {
    try {
      const response = await this.client.request({
        command: 'account_objects',
        type: 'mptoken_issuance'
      });
      
      return response.result.account_objects.find(
        (obj: any) => obj.MPTokenIssuanceID === tokenId
      );
    } catch (error) {
      console.error('토큰 정보 조회 오류:', error);
      return null;
    }
  }
  
  /**
   * 조건부 MPT 발행 - 데이터 품질에 따른 차등 보상
   */
  async mintConditionalPoints(
    enterpriseWallet: Wallet,
    tokenId: string,
    userWallet: Wallet,
    dataQuality: {
      accuracy: number;
      completeness: number;
      consistency: number;
    }
  ): Promise<{
    result: any;
    pointsAwarded: number;
    grade: string;
  }> {
    // 품질 점수 계산
    const qualityScore = (dataQuality.accuracy + dataQuality.completeness + dataQuality.consistency) / 3;
    
    // 등급별 포인트
    let points: number;
    let grade: string;
    
    if (qualityScore >= 90) {
      points = 150;
      grade = 'A';
    } else if (qualityScore >= 80) {
      points = 120;
      grade = 'B';
    } else if (qualityScore >= 70) {
      points = 100;
      grade = 'C';
    } else {
      points = 50;
      grade = 'D';
    }
    
    const result = await this.mintDataPoints(
      enterpriseWallet,
      tokenId,
      userWallet,
      points,
      `Quality reward - Grade ${grade}`
    );
    
    return {
      result: result.result,
      pointsAwarded: points,
      grade
    };
  }
  
  /**
   * MPT 배치 발행 - 여러 사용자에게 동시 포인트 지급
   */
  async batchMintPoints(
    enterpriseWallet: Wallet,
    tokenId: string,
    recipients: Array<{
      userWallet: Wallet;
      amount: number;
      reason: string;
    }>
  ): Promise<{
    results: any[];
    totalPoints: number;
    successCount: number;
  }> {
    const results = [];
    let totalPoints = 0;
    let successCount = 0;
    
    // 병렬 처리로 빠른 배치 발행
    const promises = recipients.map(async (recipient) => {
      try {
        const result = await this.mintDataPoints(
          enterpriseWallet,
          tokenId,
          recipient.userWallet,
          recipient.amount,
          recipient.reason
        );
        
        totalPoints += recipient.amount;
        successCount++;
        
        return {
          success: true,
          result,
          userAddress: recipient.userWallet.address,
          amount: recipient.amount
        };
      } catch (error) {
        console.error(`포인트 발행 실패 (${recipient.userWallet.address}):`, error);
        return {
          success: false,
          error,
          userAddress: recipient.userWallet.address,
          amount: recipient.amount
        };
      }
    });
    
    const batchResults = await Promise.all(promises);
    
    return {
      results: batchResults,
      totalPoints,
      successCount
    };
  }
  
  /**
   * 포인트 → XRP 교환 시스템
   */
  async exchangePointsToXRP(
    userWallet: Wallet,
    enterpriseWallet: Wallet,
    tokenId: string,
    points: number,
    exchangeRate: number = 100
  ): Promise<{
    result: any;
    xrpReceived: number;
    pointsBurned: number;
  }> {
    // 1. 포인트 소각
    const burnResult = await this.burnDataPoints(
      userWallet,
      tokenId,
      points,
      exchangeRate
    );
    
    // 2. XRP 지급
    const paymentTx: Transaction = {
      TransactionType: 'Payment',
      Account: enterpriseWallet.address,
      Destination: userWallet.address,
      Amount: xrpToDrops(burnResult.xrpAmount),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('point_exchange', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            pointsExchanged: points,
            xrpReceived: burnResult.xrpAmount,
            exchangeRate,
            timestamp: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(paymentTx);
    const signed = enterpriseWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      result,
      xrpReceived: burnResult.xrpAmount,
      pointsBurned: points
    };
  }
  
  /**
   * 토큰 ID 생성
   */
  private generateTokenID(enterpriseId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${enterpriseId}_${timestamp}_${random}`.toUpperCase();
  }
  
  /**
   * MPT 토큰 전송 (사용자 간 포인트 이전)
   */
  async transferPoints(
    fromWallet: Wallet,
    toWallet: Wallet,
    tokenId: string,
    amount: number,
    reason: string
  ): Promise<any> {
    const transferTx: Transaction = {
      TransactionType: 'MPTokenIssuanceTransfer',
      Account: fromWallet.address,
      MPTokenIssuanceID: tokenId,
      Destination: toWallet.address,
      Amount: String(amount),
      Memos: [{
        Memo: {
          MemoType: Buffer.from('point_transfer', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            reason,
            amount,
            timestamp: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(transferTx);
    const signed = fromWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return result;
  }
}
