import { Client, Transaction, Wallet, xrpToDrops } from 'xrpl';

/**
 * Batch Transaction Manager for XRPL
 * Batch 트랜잭션을 통해 여러 작업을 한번에 처리
 */
export class BatchTransactionManager {
  private client: Client;
  
  constructor(client: Client) {
    this.client = client;
  }
  
  /**
   * Batch Payment Transaction
   * 여러 사용자에게 동시에 리워드 지급
   */
  async batchPaymentTransaction(
    senderWallet: Wallet,
    recipients: Array<{
      address: string;
      amount: number;
      memo?: string;
    }>
  ): Promise<string[]> {
    const transactions: Transaction[] = [];
    
    // 각 수신자에 대한 트랜잭션 생성
    for (const recipient of recipients) {
      const tx: Transaction = {
        TransactionType: "Payment",
        Account: senderWallet.address,
        Destination: recipient.address,
        Amount: xrpToDrops(recipient.amount),
        Memos: recipient.memo ? [{
          Memo: {
            MemoType: Buffer.from('batch_payment', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(recipient.memo, 'utf8').toString('hex').toUpperCase()
          }
        }] : undefined
      };
      transactions.push(tx);
    }
    
    // Batch 트랜잭션으로 묶어서 제출
    const batchTx = {
      TransactionType: "Batch",
      Account: senderWallet.address,
      Transactions: transactions,
      Flags: 0
    };
    
    // 트랜잭션 서명 및 제출
    const prepared = await this.client.autofill(batchTx);
    const signed = senderWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return [result.result.hash];
  }
  
  /**
   * Batch NFT Minting
   * 여러 NFT를 한번에 발행
   */
  async batchNFTMinting(
    issuerWallet: Wallet,
    nftMetadata: Array<{
      uri: string;
      transferFee: number;
      taxon: number;
      recipient?: string;
    }>
  ): Promise<string[]> {
    const transactions: Transaction[] = [];
    
    for (const nft of nftMetadata) {
      const mintTx: Transaction = {
        TransactionType: "NFTokenMint",
        Account: issuerWallet.address,
        URI: Buffer.from(nft.uri, 'utf8').toString('hex').toUpperCase(),
        NFTokenTaxon: nft.taxon,
        TransferFee: nft.transferFee,
        Flags: 8 // tfTransferable
      };
      
      transactions.push(mintTx);
    }
    
    // Batch로 묶어서 제출
    const batchTx = {
      TransactionType: "Batch",
      Account: issuerWallet.address,
      Transactions: transactions,
      BatchType: 1 // Sequential execution
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = issuerWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return this.extractNFTokenIDs(result);
  }
  
  /**
   * Batch Escrow Creation
   * 여러 에스크로를 한번에 생성
   */
  async batchEscrowCreation(
    creatorWallet: Wallet,
    escrows: Array<{
      destination: string;
      amount: number;
      finishAfter: number;
      condition?: string;
    }>
  ): Promise<string[]> {
    const transactions: Transaction[] = [];
    
    for (const escrow of escrows) {
      const escrowTx: Transaction = {
        TransactionType: "EscrowCreate",
        Account: creatorWallet.address,
        Destination: escrow.destination,
        Amount: xrpToDrops(escrow.amount),
        FinishAfter: escrow.finishAfter,
        Condition: escrow.condition
      };
      
      transactions.push(escrowTx);
    }
    
    // Batch 트랜잭션으로 묶어서 제출
    const batchTx = {
      TransactionType: "Batch",
      Account: creatorWallet.address,
      Transactions: transactions,
      BatchType: 2, // Parallel execution
      MaxFee: xrpToDrops(1) // Maximum fee for batch
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = creatorWallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return this.extractEscrowIDs(result);
  }
  
  /**
   * Batch Trust Line Setup
   * 여러 트러스트 라인을 한번에 설정
   */
  async batchTrustLineSetup(
    wallet: Wallet,
    trustLines: Array<{
      currency: string;
      issuer: string;
      limit: string;
    }>
  ): Promise<string> {
    const transactions: Transaction[] = [];
    
    for (const trustLine of trustLines) {
      const trustTx: Transaction = {
        TransactionType: "TrustSet",
        Account: wallet.address,
        LimitAmount: {
          currency: trustLine.currency,
          issuer: trustLine.issuer,
          value: trustLine.limit
        },
        Flags: 0
      };
      
      transactions.push(trustTx);
    }
    
    const batchTx = {
      TransactionType: "Batch",
      Account: wallet.address,
      Transactions: transactions,
      BatchType: 1 // Sequential
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return result.result.hash;
  }
  
  /**
   * Batch Account Settings Update
   * 여러 계정 설정을 한번에 업데이트
   */
  async batchAccountSettings(
    wallet: Wallet,
    settings: {
      domain?: string;
      emailHash?: string;
      messageKey?: string;
      transferRate?: number;
      tickSize?: number;
    }[]
  ): Promise<string> {
    const transactions: Transaction[] = [];
    
    for (const setting of settings) {
      const settingTx: Transaction = {
        TransactionType: "AccountSet",
        Account: wallet.address,
        Domain: setting.domain ? Buffer.from(setting.domain, 'utf8').toString('hex') : undefined,
        EmailHash: setting.emailHash,
        MessageKey: setting.messageKey,
        TransferRate: setting.transferRate,
        TickSize: setting.tickSize
      };
      
      transactions.push(settingTx);
    }
    
    const batchTx = {
      TransactionType: "Batch",
      Account: wallet.address,
      Transactions: transactions,
      BatchType: 1
    };
    
    const prepared = await this.client.autofill(batchTx);
    const signed = wallet.sign(prepared);
    const result = await this.client.submitAndWait(signed.tx_blob);
    
    return result.result.hash;
  }
  
  /**
   * NFToken ID 추출
   */
  private extractNFTokenIDs(result: any): string[] {
    const nftIds: string[] = [];
    if (result.result.meta && result.result.meta.CreatedNFTokens) {
      for (const nft of result.result.meta.CreatedNFTokens) {
        nftIds.push(nft.NFTokenID);
      }
    }
    return nftIds;
  }
  
  /**
   * Escrow ID 추출
   */
  private extractEscrowIDs(result: any): string[] {
    const escrowIds: string[] = [];
    if (result.result.meta && result.result.meta.CreatedNodes) {
      for (const node of result.result.meta.CreatedNodes) {
        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'Escrow') {
          escrowIds.push(node.CreatedNode.LedgerIndex);
        }
      }
    }
    return escrowIds;
  }
}
