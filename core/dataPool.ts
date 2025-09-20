/**
 * Data Pool Management Functions for SportiQue
 */

import { Wallet } from 'xrpl';
import { sendPaymentWithMetadata, distributePoolRewards } from './payment';
import { createEscrow, finishEscrow } from './escrow';
import { mintNFT } from './nft';
import { XRPLTransactionResult } from './types';
import { XRPL_CONFIG } from './config';

/**
 * Create a new data pool with escrow
 */
export async function createDataPool(
  poolCreatorWallet: Wallet,
  poolDetails: {
    id: string;
    name: string;
    totalFunding: number;
    targetParticipants: number;
    dataTypes: string[];
    duration: number; // in seconds
  }
): Promise<{
  escrowResult: XRPLTransactionResult;
  escrowId?: string;
  escrowSequence?: number;
}> {
  // Calculate finish after time
  const currentTime = Math.floor(Date.now() / 1000);
  const finishAfter = currentTime + poolDetails.duration;

  // Create escrow for pool funds
  const escrowResult = await createEscrow(
    poolCreatorWallet,
    poolCreatorWallet.address, // Self-escrow
    poolDetails.totalFunding,
    finishAfter
  );

  // Send notification payment with pool metadata
  if (escrowResult.result.success) {
    await sendPaymentWithMetadata(
      poolCreatorWallet,
      poolCreatorWallet.address,
      0.000001, // Minimal amount for notification
      {
        type: 'pool_reward',
        poolId: poolDetails.id,
        dataTypes: poolDetails.dataTypes,
        timestamp: Date.now()
      }
    );
  }

  return {
    escrowResult: escrowResult.result,
    escrowId: escrowResult.escrowId,
    escrowSequence: escrowResult.sequence
  };
}

/**
 * Join a data pool
 */
export async function joinDataPool(
  userWallet: Wallet,
  poolId: string,
  poolOwnerAddress: string
): Promise<XRPLTransactionResult> {
  // Send a minimal payment with pool participation metadata
  return sendPaymentWithMetadata(
    userWallet,
    poolOwnerAddress,
    0.000001, // Minimal amount
    {
      type: 'pool_reward',
      poolId,
      userId: userWallet.address,
      timestamp: Date.now()
    }
  );
}

/**
 * Mint pool participation NFT
 */
export async function mintPoolNFT(
  issuerWallet: Wallet,
  participantAddress: string,
  poolId: string,
  dataTypes: string[]
): Promise<{
  result: XRPLTransactionResult;
  nftId?: string;
}> {
  // Create NFT metadata
  const metadata = {
    name: `SportiQue Pool NFT - ${poolId}`,
    description: `Participation NFT for data pool ${poolId}`,
    image: 'https://api.sportique.biz/nft/pool-default.png',
    attributes: {
      poolId,
      dataTypes,
      participant: participantAddress,
      timestamp: Date.now()
    }
  };

  const metadataURI = `data:application/json,${encodeURIComponent(JSON.stringify(metadata))}`;

  return mintNFT(
    issuerWallet,
    metadataURI,
    XRPL_CONFIG.NFT.taxons.POOL
  );
}

/**
 * Complete pool and distribute rewards
 */
export async function completeDataPool(
  poolOwnerWallet: Wallet,
  escrowSequence: number,
  participants: { address: string; amount: number; userId: string }[],
  poolId: string
): Promise<{
  escrowResult: XRPLTransactionResult;
  distributionResults: {
    results: XRPLTransactionResult[];
    failedRecipients: string[];
  };
}> {
  // Finish the escrow to release funds
  const escrowResult = await finishEscrow(
    poolOwnerWallet,
    poolOwnerWallet.address,
    escrowSequence
  );

  // Distribute rewards to participants
  const distributionResults = await distributePoolRewards(
    poolOwnerWallet,
    participants,
    poolId
  );

  return {
    escrowResult,
    distributionResults
  };
}

/**
 * Calculate reward per participant
 */
export function calculateRewardPerParticipant(
  totalFunding: number,
  participantCount: number,
  platformFee: number = 0.05 // 5% platform fee
): number {
  const availableFunds = totalFunding * (1 - platformFee);
  return availableFunds / participantCount;
}

/**
 * Validate participant data quality
 */
export async function validateParticipantDataQuality(
  participantData: {
    userId: string;
    dataQualityScore: number;
    dataCompleteness: number;
  }[],
  minQualityThreshold: number = 70
): Promise<{
  qualified: string[];
  disqualified: string[];
}> {
  const qualified: string[] = [];
  const disqualified: string[] = [];

  for (const participant of participantData) {
    const overallScore = (participant.dataQualityScore + participant.dataCompleteness) / 2;

    if (overallScore >= minQualityThreshold) {
      qualified.push(participant.userId);
    } else {
      disqualified.push(participant.userId);
    }
  }

  return { qualified, disqualified };
}