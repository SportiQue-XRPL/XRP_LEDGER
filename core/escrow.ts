/**
 * XRPL Escrow Management Functions
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import { getXRPLServerUrl } from './config';
import { XRPLTransactionResult, EscrowDetails } from './types';
import * as crypto from 'crypto';

/**
 * Create an escrow
 */
export async function createEscrow(
  senderWallet: Wallet,
  destinationAddress: string,
  amount: number,
  finishAfter?: number, // Unix timestamp in seconds
  condition?: string
): Promise<{
  result: XRPLTransactionResult;
  escrowId?: string;
  sequence?: number;
}> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const escrowCreate: any = {
      TransactionType: 'EscrowCreate',
      Account: senderWallet.address,
      Destination: destinationAddress,
      Amount: xrpToDrops(amount)
    };

    // Add finish after condition
    if (finishAfter) {
      // Convert Unix timestamp to Ripple time (seconds since Jan 1, 2000 00:00:00)
      escrowCreate.FinishAfter = finishAfter - 946684800;
    }

    // Add crypto condition
    if (condition) {
      escrowCreate.Condition = condition;
    }

    const prepared = await client.autofill(escrowCreate);
    const signed = senderWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Get sequence number for escrow identification
    const sequence = (prepared as any).Sequence;

    return {
      result: {
        success: result.result.validated === true,
        hash: result.result.hash,
        resultCode: (result.result.meta as any)?.TransactionResult,
        resultMessage: (result.result.meta as any)?.TransactionResult,
        validated: result.result.validated
      },
      escrowId: result.result.hash,
      sequence
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Finish an escrow
 */
export async function finishEscrow(
  finisherWallet: Wallet,
  owner: string,
  escrowSequence: number,
  fulfillment?: string
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const escrowFinish: any = {
      TransactionType: 'EscrowFinish',
      Account: finisherWallet.address,
      Owner: owner,
      OfferSequence: escrowSequence
    };

    // Add fulfillment if provided
    if (fulfillment) {
      escrowFinish.Fulfillment = fulfillment;
    }

    const prepared = await client.autofill(escrowFinish);
    const signed = finisherWallet.sign(prepared);
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
 * Cancel an escrow
 */
export async function cancelEscrow(
  cancellerWallet: Wallet,
  owner: string,
  escrowSequence: number
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const escrowCancel = {
      TransactionType: 'EscrowCancel' as const,
      Account: cancellerWallet.address,
      Owner: owner,
      OfferSequence: escrowSequence
    };

    const prepared = await client.autofill(escrowCancel);
    const signed = cancellerWallet.sign(prepared);
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
 * Get escrows for an account
 */
export async function getEscrows(address: string): Promise<EscrowDetails[]> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'account_objects',
      account: address,
      ledger_index: 'validated',
      type: 'escrow'
    });

    const escrows: EscrowDetails[] = [];

    if (response.result.account_objects) {
      for (const obj of response.result.account_objects) {
        if (obj.LedgerEntryType === 'Escrow') {
          escrows.push({
            id: obj.index || '',
            owner: obj.Account,
            destination: obj.Destination,
            amount: dropsToXrp(obj.Amount.toString()).toString(),
            condition: obj.Condition,
            finishAfter: obj.FinishAfter ? obj.FinishAfter + 946684800 : undefined,
            cancelAfter: obj.CancelAfter ? obj.CancelAfter + 946684800 : undefined,
            sequence: (obj as any).OfferSequence || obj.PreviousTxnLgrSeq
          });
        }
      }
    }

    return escrows;
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return [];
    }
    throw error;
  } finally {
    await client.disconnect();
  }
}

/**
 * Create a crypto condition for data quality-based escrow
 */
export function createDataQualityCondition(dataQualityThreshold: number): {
  condition: string;
  fulfillment: string;
} {
  // Create a preimage based on data quality threshold
  const preimage = Buffer.from(`DataQuality:${dataQualityThreshold}:${Date.now()}`);

  // Create SHA-256 hash for condition
  const hash = crypto.createHash('sha256');
  hash.update(preimage);
  const condition = hash.digest('hex').toUpperCase();

  // The fulfillment is the preimage in hex
  const fulfillment = preimage.toString('hex').toUpperCase();

  return {
    condition,
    fulfillment
  };
}

/**
 * Verify data quality fulfillment
 */
export function verifyDataQualityFulfillment(
  condition: string,
  fulfillment: string
): boolean {
  try {
    // Convert fulfillment from hex to buffer
    const preimage = Buffer.from(fulfillment, 'hex');

    // Create hash of fulfillment
    const hash = crypto.createHash('sha256');
    hash.update(preimage);
    const calculatedCondition = hash.digest('hex').toUpperCase();

    // Check if calculated condition matches provided condition
    return calculatedCondition === condition;
  } catch (error) {
    console.error('Error verifying fulfillment:', error);
    return false;
  }
}