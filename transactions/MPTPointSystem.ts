import { Client, Wallet } from 'xrpl';
import { MPTokenManager } from '../core/mpt';

/**
 * MPT 기반 포인트 시스템
 * SportiQue의 데이터 보상 포인트 시스템 구현
 */
export class MPTPointSystem {
  private client: Client;
  private mptManager: MPTokenManager;
  
  constructor(client: Client) {
    this.client = client;
    this.mptManager = new MPTokenManager(client);
  }
  
  /**
   * 구독 기반 포인트 시스템 초기화
   */
  async initializeSubscriptionPoints(
    enterpriseWallet: Wallet,
    userWallet: Wallet,
    enterpriseId: string,
    subscriptionId: string
  ): Promise<{
    tokenId: string;
    totalPossiblePoints: number;
    exchangeRate: number;
  }> {
    // 1. MPT 토큰 생성
    const tokenResult = await this.mptManager.createDataPointToken(
      enterpriseWallet,
      enterpriseId,
      {
        name: `SportiQue Data Points - ${enterpriseId}`,
        symbol: 'SDP',
        maxSupply: 1000000, // 100만 포인트
        decimals: 2
      }
    );
    
    // 2. 초기 포인트 지급 (가입 보너스)
    await this.mptManager.mintDataPoints(
      enterpriseWallet,
      tokenResult.tokenId,
      userWallet,
      100, // 가입 보너스 100포인트
      'Subscription bonus'
    );
    
    return {
      tokenId: tokenResult.tokenId,
      totalPossiblePoints: 5000, // 30일 × 100 + 보너스 2000
      exchangeRate: 100 // 100 포인트 = 1 XRP
    };
  }
  
  /**
   * 일일 데이터 제출 보상
   */
  async processDailyDataSubmission(
    enterpriseWallet: Wallet,
    userWallet: Wallet,
    tokenId: string,
    dataQuality: {
      accuracy: number;
      completeness: number;
      consistency: number;
    },
    dayNumber: number
  ): Promise<{
    pointsAwarded: number;
    grade: string;
    totalPoints: number;
  }> {
    // 1. 품질 기반 포인트 지급
    const qualityResult = await this.mptManager.mintConditionalPoints(
      enterpriseWallet,
      tokenId,
      userWallet,
      dataQuality
    );
    
    // 2. 연속 제출 보너스 (7일 연속 시)
    let streakBonus = 0;
    if (dayNumber % 7 === 0) {
      streakBonus = 500; // 7일 연속 보너스
      await this.mptManager.mintDataPoints(
        enterpriseWallet,
        tokenId,
        userWallet,
        streakBonus,
        `7-day streak bonus (Day ${dayNumber})`
      );
    }
    
    // 3. 30일 완료 보너스
    let completionBonus = 0;
    if (dayNumber === 30) {
      completionBonus = 2000; // 30일 완료 보너스
      await this.mptManager.mintDataPoints(
        enterpriseWallet,
        tokenId,
        userWallet,
        completionBonus,
        '30-day completion bonus'
      );
    }
    
    // 4. 총 포인트 계산
    const totalPointsAwarded = qualityResult.pointsAwarded + streakBonus + completionBonus;
    const totalBalance = await this.mptManager.getTokenBalance(userWallet.address, tokenId);
    
    return {
      pointsAwarded: totalPointsAwarded,
      grade: qualityResult.grade,
      totalPoints: totalBalance
    };
  }
  
  /**
   * 데이터 풀 참여 포인트 시스템
   */
  async processPoolParticipation(
    platformWallet: Wallet,
    participants: Array<{
      userWallet: Wallet;
      dataQuality: {
        accuracy: number;
        completeness: number;
        consistency: number;
      };
      contribution: number; // 기여도 (1-100)
    }>,
    poolId: string
  ): Promise<{
    batchResult: any;
    totalPointsDistributed: number;
    participantCount: number;
  }> {
    // 1. 풀용 MPT 토큰 생성
    const tokenResult = await this.mptManager.createDataPointToken(
      platformWallet,
      'platform',
      {
        name: `SportiQue Pool Points - ${poolId}`,
        symbol: 'SPP',
        maxSupply: 500000,
        decimals: 2
      }
    );
    
    // 2. 참여자별 포인트 계산 및 배치 발행
    const recipients = participants.map(participant => {
      // 기여도와 품질을 종합한 포인트 계산
      const qualityScore = (
        participant.dataQuality.accuracy + 
        participant.dataQuality.completeness + 
        participant.dataQuality.consistency
      ) / 3;
      
      const basePoints = 1000; // 기본 1000포인트
      const qualityMultiplier = qualityScore / 100;
      const contributionMultiplier = participant.contribution / 100;
      
      const finalPoints = Math.floor(
        basePoints * qualityMultiplier * contributionMultiplier
      );
      
      return {
        userWallet: participant.userWallet,
        amount: finalPoints,
        reason: `Pool participation - Quality: ${qualityScore.toFixed(1)}%, Contribution: ${participant.contribution}%`
      };
    });
    
    // 3. 배치 포인트 발행
    const batchResult = await this.mptManager.batchMintPoints(
      platformWallet,
      tokenResult.tokenId,
      recipients
    );
    
    return {
      batchResult,
      totalPointsDistributed: batchResult.totalPoints,
      participantCount: batchResult.successCount
    };
  }
  
  /**
   * 포인트 → XRP 교환
   */
  async exchangePointsToXRP(
    userWallet: Wallet,
    enterpriseWallet: Wallet,
    tokenId: string,
    points: number,
    exchangeRate: number = 100
  ): Promise<{
    xrpReceived: number;
    pointsBurned: number;
    transactionHash: string;
  }> {
    const exchangeResult = await this.mptManager.exchangePointsToXRP(
      userWallet,
      enterpriseWallet,
      tokenId,
      points,
      exchangeRate
    );
    
    return {
      xrpReceived: exchangeResult.xrpReceived,
      pointsBurned: exchangeResult.pointsBurned,
      transactionHash: exchangeResult.result.result.hash
    };
  }
  
  /**
   * 포인트 잔액 조회
   */
  async getUserPointBalance(
    userWallet: Wallet,
    tokenId: string
  ): Promise<{
    balance: number;
    tokenInfo: any;
  }> {
    const balance = await this.mptManager.getTokenBalance(userWallet.address, tokenId);
    const tokenInfo = await this.mptManager.getTokenInfo(tokenId);
    
    return {
      balance,
      tokenInfo
    };
  }
  
  /**
   * 포인트 이력 조회
   */
  async getPointHistory(
    userWallet: Wallet,
    tokenId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const response = await this.client.request({
        command: 'account_tx',
        account: userWallet.address,
        limit,
        ledger_index_min: -1,
        ledger_index_max: -1
      });
      
      // MPT 관련 트랜잭션만 필터링
      const mptTransactions = response.result.transactions.filter((tx: any) => {
        const txData = tx.tx;
        return txData.TransactionType === 'MPTokenIssuanceSet' ||
               txData.TransactionType === 'MPTokenIssuanceDestroy' ||
               txData.TransactionType === 'MPTokenIssuanceTransfer';
      });
      
      return mptTransactions;
    } catch (error) {
      console.error('포인트 이력 조회 오류:', error);
      return [];
    }
  }
  
  /**
   * 포인트 리더보드 (상위 사용자)
   */
  async getPointLeaderboard(
    tokenId: string,
    limit: number = 10
  ): Promise<Array<{
    address: string;
    balance: number;
    rank: number;
  }>> {
    try {
      // 모든 MPT 홀더 조회
      const response = await this.client.request({
        command: 'account_objects',
        type: 'mptoken_issuance'
      });
      
      const holders = response.result.account_objects
        .filter((obj: any) => obj.MPTokenIssuanceID === tokenId)
        .map((obj: any) => ({
          address: obj.Account,
          balance: parseInt(obj.Amount)
        }))
        .sort((a: any, b: any) => b.balance - a.balance)
        .slice(0, limit)
        .map((holder: any, index: number) => ({
          ...holder,
          rank: index + 1
        }));
      
      return holders;
    } catch (error) {
      console.error('리더보드 조회 오류:', error);
      return [];
    }
  }
  
  /**
   * 포인트 통계
   */
  async getPointStatistics(tokenId: string): Promise<{
    totalSupply: number;
    totalHolders: number;
    averageBalance: number;
    topHolder: {
      address: string;
      balance: number;
    };
  }> {
    try {
      const response = await this.client.request({
        command: 'account_objects',
        type: 'mptoken_issuance'
      });
      
      const holders = response.result.account_objects.filter(
        (obj: any) => obj.MPTokenIssuanceID === tokenId
      );
      
      const totalSupply = holders.reduce((sum: number, holder: any) => 
        sum + parseInt(holder.Amount), 0
      );
      
      const totalHolders = holders.length;
      const averageBalance = totalHolders > 0 ? totalSupply / totalHolders : 0;
      
      const topHolder = holders.reduce((max: any, holder: any) => 
        parseInt(holder.Amount) > parseInt(max.Amount) ? holder : max
      );
      
      return {
        totalSupply,
        totalHolders,
        averageBalance,
        topHolder: {
          address: topHolder.Account,
          balance: parseInt(topHolder.Amount)
        }
      };
    } catch (error) {
      console.error('포인트 통계 조회 오류:', error);
      return {
        totalSupply: 0,
        totalHolders: 0,
        averageBalance: 0,
        topHolder: { address: '', balance: 0 }
      };
    }
  }
}
