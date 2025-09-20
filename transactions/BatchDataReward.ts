import { Client, Wallet, xrpToDrops, Transaction } from 'xrpl';

/**
 * Batch를 활용한 대량 리워드 분배 시스템
 * 데이터 풀 참여자들에게 한번에 리워드 지급
 */
export class BatchDataReward {
  private client: Client;
  
  constructor(client: Client) {
    this.client = client;
  }
  
  /**
   * Batch를 사용한 데이터 풀 리워드 일괄 분배
   * 기존 개별 Payment 대신 Batch로 한번에 처리
   */
  async distributePoolRewardsBatch(
    platformWallet: Wallet,
    poolId: string,
    participants: Array<{
      userId: string;
      walletAddress: string;
      qualityScore: number;
      dataCount: number;
      baseAmount: number;
    }>
  ): Promise<{
    batchTxHash: string;
    totalDistributed: number;
    participantCount: number;
  }> {
    // 리워드 계산 및 트랜잭션 배열 생성
    const transactions: Transaction[] = [];
    let totalDistributed = 0;
    
    for (const participant of participants) {
      // 품질 기반 리워드 계산
      const rewardAmount = this.calculateReward(
        participant.baseAmount,
        participant.qualityScore
      );
      
      totalDistributed += rewardAmount;
      
      // Payment 트랜잭션 생성
      const paymentTx: Transaction = {
        TransactionType: "Payment",
        Account: platformWallet.address,
        Destination: participant.walletAddress,
        Amount: xrpToDrops(rewardAmount),
        Memos: [{
          Memo: {
            MemoType: Buffer.from('pool_reward', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              poolId,
              userId: participant.userId,
              qualityScore: participant.qualityScore,
              dataCount: participant.dataCount,
              timestamp: new Date().toISOString()
            }), 'utf8').toString('hex').toUpperCase()
          }
        }]
      };
      
      transactions.push(paymentTx);
    }
    
    // Batch 트랜잭션으로 묶어서 제출
    const batchTx: any = {
      TransactionType: "Batch",
      Account: platformWallet.address,
      Transactions: transactions,
      BatchType: 2, // Parallel execution for speed
      Memos: [{
        Memo: {
          MemoType: Buffer.from('batch_pool_distribution', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            poolId,
            participantCount: participants.length,
            totalAmount: totalDistributed,
            timestamp: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    // 트랜잭션 제출
    const prepared = await this.client.autofill(batchTx);
    const signed = platformWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      batchTxHash: result.result.hash,
      totalDistributed,
      participantCount: participants.length
    };
  }
  
  /**
   * Batch NFT 발행 - 풀 참여 증명 NFT
   * 모든 참여자에게 한번에 NFT 발행
   */
  async batchMintParticipationNFTs(
    platformWallet: Wallet,
    poolId: string,
    participants: Array<{
      userId: string;
      walletAddress: string;
      qualityGrade: string;
    }>
  ): Promise<{
    batchTxHash: string;
    nftCount: number;
  }> {
    const transactions: Transaction[] = [];
    
    for (const participant of participants) {
      // NFT 메타데이터
      const metadata = {
        poolId,
        userId: participant.userId,
        qualityGrade: participant.qualityGrade,
        issueDate: new Date().toISOString(),
        type: 'POOL_PARTICIPATION_CERTIFICATE'
      };
      
      const nftTx: Transaction = {
        TransactionType: "NFTokenMint",
        Account: platformWallet.address,
        URI: Buffer.from(JSON.stringify(metadata), 'utf8').toString('hex').toUpperCase(),
        Flags: 8, // Transferable
        TransferFee: 0,
        NFTokenTaxon: 3 // Pool participation NFT
      };
      
      transactions.push(nftTx);
    }
    
    // Batch로 묶어서 제출
    const batchTx: any = {
      TransactionType: "Batch",
      Account: platformWallet.address,
      Transactions: transactions,
      BatchType: 2 // Parallel
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = platformWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return {
      batchTxHash: result.result.hash,
      nftCount: participants.length
    };
  }
  
  /**
   * Batch 구독 갱신 - 여러 구독을 한번에 갱신
   */
  async batchRenewSubscriptions(
    enterpriseWallet: Wallet,
    subscriptions: Array<{
      userId: string;
      userWallet: string;
      amount: number;
      duration: number;
    }>
  ): Promise<{
    batchTxHash: string;
    escrowIds: string[];
  }> {
    const transactions: Transaction[] = [];
    
    for (const sub of subscriptions) {
      const finishAfter = Math.floor(Date.now() / 1000) + sub.duration;
      
      const escrowTx: Transaction = {
        TransactionType: "EscrowCreate",
        Account: enterpriseWallet.address,
        Destination: sub.userWallet,
        Amount: xrpToDrops(sub.amount),
        FinishAfter: finishAfter,
        DestinationTag: 1001 // Subscription renewal tag
      };
      
      transactions.push(escrowTx);
    }
    
    // Batch 트랜잭션
    const batchTx: any = {
      TransactionType: "Batch",
      Account: enterpriseWallet.address,
      Transactions: transactions,
      BatchType: 1, // Sequential for escrows
      Memos: [{
        Memo: {
          MemoType: Buffer.from('batch_subscription_renewal', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(JSON.stringify({
            count: subscriptions.length,
            timestamp: new Date().toISOString()
          }), 'utf8').toString('hex').toUpperCase()
        }
      }]
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = enterpriseWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    // Extract escrow IDs from result
    const escrowIds = this.extractEscrowIds(result);
    
    return {
      batchTxHash: result.result.hash,
      escrowIds
    };
  }
  
  /**
   * 리워드 계산 로직
   */
  private calculateReward(baseAmount: number, qualityScore: number): number {
    const qualityMultiplier = qualityScore / 100;
    return Math.round(baseAmount * qualityMultiplier * 100) / 100;
  }
  
  /**
   * Escrow ID 추출
   */
  private extractEscrowIds(result: any): string[] {
    const ids: string[] = [];
    if (result.result.meta?.CreatedNodes) {
      for (const node of result.result.meta.CreatedNodes) {
        if (node.CreatedNode?.LedgerEntryType === 'Escrow') {
          ids.push(node.CreatedNode.LedgerIndex);
        }
      }
    }
    return ids;
  }
}
