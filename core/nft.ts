/**
 * XRPL NFT Management Functions
 */

import { Client, Wallet, convertStringToHex, NFTokenMintFlags } from 'xrpl';
import { getXRPLServerUrl, XRPL_CONFIG } from './config';
import { XRPLTransactionResult, NFTMetadata } from './types';

/**
 * Mint a new NFT
 */
export async function mintNFT(
  issuerWallet: Wallet,
  tokenURI: string,
  taxon: number = 0,
  transferFee: number = 0,
  flags?: number
): Promise<{
  result: XRPLTransactionResult;
  nftId?: string;
}> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const nftMint: any = {
      TransactionType: 'NFTokenMint',
      Account: issuerWallet.address,
      URI: convertStringToHex(tokenURI),
      NFTokenTaxon: taxon,
      TransferFee: transferFee
    };

    // Set flags
    if (flags !== undefined) {
      nftMint.Flags = flags;
    } else {
      nftMint.Flags = NFTokenMintFlags.tfTransferable;
    }

    const prepared = await client.autofill(nftMint);
    const signed = issuerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Extract NFT ID from the transaction result
    let nftId: string | undefined;
    if (result.result.validated) {
      const nftNodes = (result.result.meta as any)?.AffectedNodes?.filter((node: any) =>
        node.CreatedNode?.LedgerEntryType === 'NFTokenPage' ||
        node.ModifiedNode?.LedgerEntryType === 'NFTokenPage'
      );

      if (nftNodes && nftNodes.length > 0) {
        const nfTokens = nftNodes[0].CreatedNode?.NewFields?.NFTokens ||
                        nftNodes[0].ModifiedNode?.FinalFields?.NFTokens;
        if (nfTokens && nfTokens.length > 0) {
          nftId = nfTokens[nfTokens.length - 1].NFToken.NFTokenID;
        }
      }
    }

    return {
      result: {
        success: result.result.validated === true,
        hash: result.result.hash,
        resultCode: (result.result.meta as any)?.TransactionResult,
        resultMessage: (result.result.meta as any)?.TransactionResult,
        validated: result.result.validated
      },
      nftId
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Create NFT sell offer
 */
export async function createNFTSellOffer(
  sellerWallet: Wallet,
  nftId: string,
  amount: string,
  destination?: string
): Promise<{
  result: XRPLTransactionResult;
  offerId?: string;
}> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const offer: any = {
      TransactionType: 'NFTokenCreateOffer',
      Account: sellerWallet.address,
      NFTokenID: nftId,
      Amount: amount,
      Flags: 1 // tfSellNFToken
    };

    if (destination) {
      offer.Destination = destination;
    }

    const prepared = await client.autofill(offer);
    const signed = sellerWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    // Extract offer ID
    let offerId: string | undefined;
    if (result.result.validated) {
      const offerNodes = (result.result.meta as any)?.AffectedNodes?.filter((node: any) =>
        node.CreatedNode?.LedgerEntryType === 'NFTokenOffer'
      );

      if (offerNodes && offerNodes.length > 0) {
        offerId = offerNodes[0].CreatedNode?.LedgerIndex;
      }
    }

    return {
      result: {
        success: result.result.validated === true,
        hash: result.result.hash,
        resultCode: (result.result.meta as any)?.TransactionResult,
        resultMessage: (result.result.meta as any)?.TransactionResult,
        validated: result.result.validated
      },
      offerId
    };
  } finally {
    await client.disconnect();
  }
}

/**
 * Accept NFT sell offer
 */
export async function acceptNFTSellOffer(
  buyerWallet: Wallet,
  offerId: string
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const accept = {
      TransactionType: 'NFTokenAcceptOffer' as const,
      Account: buyerWallet.address,
      NFTokenSellOffer: offerId
    };

    const prepared = await client.autofill(accept);
    const signed = buyerWallet.sign(prepared);
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
 * Get NFTs owned by an address
 */
export async function getNFTs(address: string): Promise<any[]> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated'
    });

    return response.result.account_nfts || [];
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
 * Get NFT sell offers
 */
export async function getNFTSellOffers(nftId: string): Promise<any[]> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'nft_sell_offers',
      nft_id: nftId,
      ledger_index: 'validated'
    });

    return response.result.offers || [];
  } catch (error: any) {
    console.error('Error getting NFT sell offers:', error);
    return [];
  } finally {
    await client.disconnect();
  }
}

/**
 * Get NFT buy offers
 */
export async function getNFTBuyOffers(nftId: string): Promise<any[]> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const response = await client.request({
      command: 'nft_buy_offers',
      nft_id: nftId,
      ledger_index: 'validated'
    });

    return response.result.offers || [];
  } catch (error: any) {
    console.error('Error getting NFT buy offers:', error);
    return [];
  } finally {
    await client.disconnect();
  }
}

/**
 * Burn an NFT
 */
export async function burnNFT(
  ownerWallet: Wallet,
  nftId: string
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const burn = {
      TransactionType: 'NFTokenBurn' as const,
      Account: ownerWallet.address,
      NFTokenID: nftId
    };

    const prepared = await client.autofill(burn);
    const signed = ownerWallet.sign(prepared);
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
 * Cancel NFT offer
 */
export async function cancelNFTOffer(
  wallet: Wallet,
  offerIds: string[]
): Promise<XRPLTransactionResult> {
  const client = new Client(getXRPLServerUrl());

  try {
    await client.connect();

    const cancel = {
      TransactionType: 'NFTokenCancelOffer' as const,
      Account: wallet.address,
      NFTokenOffers: offerIds
    };

    const prepared = await client.autofill(cancel);
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
 * Create metadata URI for NFT (this would normally use IPFS)
 */
export function createMetadataURI(metadata: NFTMetadata): string {
  // In production, this would upload to IPFS and return the IPFS URI
  // For now, we'll create a data URI
  const metadataString = JSON.stringify(metadata);
  const base64 = Buffer.from(metadataString).toString('base64');
  return `data:application/json;base64,${base64}`;
}