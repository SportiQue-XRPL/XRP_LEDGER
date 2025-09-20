/**
 * XRPL Payment Functions for SportiQue
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';
import { getXRPLServerUrl } from './config';
import { XRPLTransactionResult } from './types';

/**
 * Send payment with metadata
 */
export async function sendPaymentWithMetadata(
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number,
  metadata: {
    type: 'subscription' | 'pool_reward' | 'data_payment';
    subscriptionId?: string;
    poolId?: string;
    userId?: string;
    dataTypes?: string[];
    timestamp?: number;
  }
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    // Create memo with metadata
    const memoData = JSON.stringify(metadata);
    const memoType = metadata.type;

    const payment = {
      TransactionType: 'Payment' as const,
      Account: senderWallet.address,
      Destination: destinationAddress,
      Amount: xrpToDrops(amount),
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from(memoType, 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(memoData, 'utf8').toString('hex').toUpperCase()
          }
        }
      ]
    };

    const prepared = await client.autofill(payment);
    const signed = senderWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    return {
      success: result.result.validated === true,
      hash: result.result.hash,
      resultCode: (result.result.meta as any)?.TransactionResult,
      resultMessage: (result.result.meta as any)?.TransactionResult,
      validated: result.result.validated
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Batch payment distribution for pool rewards
 */
export async function distributePoolRewards(
  senderWallet: Wallet,
  recipients: { address: string; amount: number; userId: string }[],
  poolId: string
): Promise<{ results: XRPLTransactionResult[]; failedRecipients: string[] }> {
  const results: XRPLTransactionResult[] = [];
  const failedRecipients: string[] = [];

  for (const recipient of recipients) {
    try {
      const result = await sendPaymentWithMetadata(
        senderWallet,
        recipient.address,
        recipient.amount,
        {
          type: 'pool_reward',
          poolId,
          userId: recipient.userId,
          timestamp: Date.now()
        }
      );

      results.push(result);

      if (!result.success) {
        failedRecipients.push(recipient.userId);
      }
    } catch (error) {
      console.error(`Failed to send reward to ${recipient.userId}:`, error);
      failedRecipients.push(recipient.userId);
      results.push({
        success: false,
        resultMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { results, failedRecipients };
}

/**
 * Create subscription payment
 */
export async function createSubscriptionPayment(
  enterpriseWallet: Wallet,
  userAddress: string,
  amount: number,
  subscriptionId: string,
  dataTypes: string[]
): Promise<XRPLTransactionResult> {
  return sendPaymentWithMetadata(
    enterpriseWallet,
    userAddress,
    amount,
    {
      type: 'subscription',
      subscriptionId,
      dataTypes,
      timestamp: Date.now()
    }
  );
}

/**
 * Parse payment memo
 */
export function parsePaymentMemo(memoData: string): any {
  try {
    // Convert hex to string
    const memoString = Buffer.from(memoData, 'hex').toString('utf8');
    return JSON.parse(memoString);
  } catch (error) {
    console.error('Error parsing memo:', error);
    return null;
  }
}

/**
 * Get payment history with memos
 */
export async function getPaymentHistory(
  address: string,
  limit: number = 20
): Promise<any[]> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit
    });

    const payments = [];

    if (response.result.transactions) {
      for (const tx of response.result.transactions) {
        if (tx.tx?.TransactionType === 'Payment') {
          const payment: any = {
            hash: tx.tx.hash,
            account: tx.tx.Account,
            destination: tx.tx.Destination,
            amount: tx.tx.Amount,
            timestamp: tx.tx.date,
            validated: tx.validated
          };

          // Parse memos if present
          if (tx.tx.Memos && tx.tx.Memos.length > 0) {
            const memo = tx.tx.Memos[0].Memo;
            if (memo.MemoData) {
              payment.metadata = parsePaymentMemo(memo.MemoData);
              payment.memoType = memo.MemoType ?
                Buffer.from(memo.MemoType, 'hex').toString('utf8') : null;
            }
          }

          payments.push(payment);
        }
      }
    }

    return payments;
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return [];
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}