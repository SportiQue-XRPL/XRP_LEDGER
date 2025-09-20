/**
 * XRPL Wallet Management Functions
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { getXRPLServerUrl, XRPL_CONFIG } from './config';
import { XRPLTransactionResult } from './types';

/**
 * Create a new XRPL wallet
 */
export async function createWallet(): Promise<{
  wallet: Wallet;
  address: string;
  seed: string;
  balance?: string;
}> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    // Generate new wallet
    const wallet = Wallet.generate();

    // For testnet, fund the wallet
    if (getXRPLServerUrl().includes('testnet')) {
      const fundResult = await client.fundWallet(wallet);
      console.log('Wallet funded:', fundResult);

      return {
        wallet,
        address: wallet.address,
        seed: wallet.seed!,
        balance: dropsToXrp(fundResult.balance.toString()).toString()
      };
    }

    return {
      wallet,
      address: wallet.address,
      seed: wallet.seed!
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Get wallet from seed
 */
export function getWalletFromSeed(seed: string): Wallet {
  return Wallet.fromSeed(seed);
}

/**
 * Get wallet from secret
 */
export function getWalletFromSecret(secret: string): Wallet {
  return Wallet.fromSecret(secret);
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(address: string): Promise<string> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    return dropsToXrp(response.result.account_data.Balance.toString()).toString();
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return '0';
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Send XRP payment
 */
export async function sendXRPPayment(
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number,
  memo?: string
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const payment: any = {
      TransactionType: 'Payment',
      Account: senderWallet.address,
      Destination: destinationAddress,
      Amount: xrpToDrops(amount)
    };

    // Add memo if provided
    if (memo) {
      payment.Memos = [
        {
          Memo: {
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
          }
        }
      ];
    }

    // Prepare transaction
    const prepared = await client.autofill(payment);

    // Sign transaction
    const signed = senderWallet.sign(prepared);

    // Submit transaction
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
 * Check if wallet exists (has been activated)
 */
export async function isWalletActivated(address: string): Promise<boolean> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated'
    });

    return true;
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return false;
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Set wallet trust line for tokens (for future token support)
 */
export async function setTrustLine(
  wallet: Wallet,
  issuerAddress: string,
  currencyCode: string,
  limit: string = '1000000'
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const trustSet = {
      TransactionType: 'TrustSet' as const,
      Account: wallet.address,
      LimitAmount: {
        currency: currencyCode,
        issuer: issuerAddress,
        value: limit
      }
    };

    const prepared = await client.autofill(trustSet);
    const signed = wallet.sign(prepared);
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
 * Get transaction history
 */
export async function getTransactionHistory(
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
      limit: limit
    });

    return response.result.transactions || [];
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return [];
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}