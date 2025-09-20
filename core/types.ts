/**
 * TypeScript Type Definitions for SportiQue XRPL Integration
 */

import { Timestamp } from 'firebase/firestore';

// Enterprise Profile
export interface EnterpriseProfile {
  id: string;
  name: string;
  email: string;
  industry: string;
  size: string;
  country: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'inactive' | 'suspended';
  walletAddress: string | null;
  xrpBalance: number;
  subscriptions: string[];
  dataPools: string[];
}

// User Profile
export interface UserProfile {
  id: string;
  anonymizedId: string;
  name: string;
  email: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  healthConditions: string[];
  dataQualityGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  dataConsistency: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: 'active' | 'inactive' | 'suspended';
  walletAddress: string | null;
  xrpBalance: number;
  subscriptions: string[];
  dataPools: string[];
}

// Anonymized Health Data
export interface AnonymizedHealthData {
  dataHash: string;
  anonymizedUserId: string;
  dataType: string;
  timestamp: Timestamp;
  encryptedContent: string;
  metadata: {
    device: string;
    accuracy: number;
    verified: boolean;
  };
  accessControl: {
    ownerUserId: string;
    allowedNfts: string[];
    expiresAt: Timestamp | null;
  };
}

// Subscription NFT
export interface SubscriptionNFT {
  id: string;
  tokenURI: string;
  name: string;
  description: string;
  imageUrl: string;
  issuer: string;
  owner: string;
  createdAt: Timestamp;
  validUntil: Timestamp;
  subscriptionId: string;
  accessRights: {
    userId: string;
    dataTypes: string[];
    startDate: Timestamp;
    endDate: Timestamp;
  };
  transactionHash: string;
}

// Pool NFT
export interface PoolNFT {
  id: string;
  tokenURI: string;
  name: string;
  description: string;
  imageUrl: string;
  issuer: string;
  owner: string;
  createdAt: Timestamp;
  validUntil: Timestamp;
  poolId: string;
  accessRights: {
    poolId: string;
    dataTypes: string[];
    startDate: Timestamp;
    endDate: Timestamp;
  };
  transactionHash: string;
}

// Subscription Contract
export interface Subscription {
  id: string;
  enterpriseId: string;
  userId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  createdAt: Timestamp;
  startDate: Timestamp | null;
  endDate: Timestamp | null;
  dataTypes: string[];
  paymentAmount: number;
  escrowId: string | null;
  nftId: string | null;
  insuranceRelation: {
    id: string;
    status: 'pending' | 'active' | 'completed';
    createdAt: Timestamp;
    terms: string;
  };
  transactions: {
    escrowCreate: string | null;
    nftMint: string | null;
    escrowFinish: string | null;
  };
}

// Data Pool
export interface DataPool {
  id: string;
  name: string;
  description: string;
  status: 'open' | 'closed' | 'completed';
  createdAt: Timestamp;
  startDate: Timestamp;
  endDate: Timestamp;
  dataTypes: string[];
  targetParticipants: number;
  currentParticipants: number;
  rewardPerParticipant: number;
  totalFunding: number;
  enterprises: string[];
  participants: string[];
  nftIds: string[];
  escrowId: string;
  transactions: {
    poolCreate: string;
    nftMint: string[];
    rewardDistribution: string | null;
  };
}

// XRPL Transaction Result
export interface XRPLTransactionResult {
  success: boolean;
  hash?: string;
  resultCode?: string;
  resultMessage?: string;
  validated?: boolean;
}

// NFT Metadata
export interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: {
    [key: string]: any;
  };
}

// Escrow Details
export interface EscrowDetails {
  id: string;
  owner: string;
  destination: string;
  amount: string;
  condition?: string;
  finishAfter?: number;
  cancelAfter?: number;
  sequence: number;
}