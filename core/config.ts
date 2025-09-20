/**
 * Configuration for XRPL Integration
 */

// XRPL Network Configuration
export const XRPL_CONFIG = {
  // Testnet Configuration
  TESTNET: {
    server: 'wss://s.altnet.rippletest.net:51233',
    explorer: 'https://testnet.xrpl.org'
  },
  // Mainnet Configuration (for production)
  MAINNET: {
    server: 'wss://xrplcluster.com',
    explorer: 'https://livenet.xrpl.org'
  },
  // Current network to use
  CURRENT_NETWORK: 'TESTNET' as 'TESTNET' | 'MAINNET',

  // Transaction Configuration
  TRANSACTION: {
    maxLedgerVersionOffset: 20,
    maxFee: '1000', // in drops
    timeout: 30000 // 30 seconds
  },

  // NFT Configuration
  NFT: {
    taxons: {
      SUBSCRIPTION: 0,
      POOL: 1,
      ACHIEVEMENT: 2
    },
    transferFee: 0, // No transfer fee for now
    flags: {
      transferable: 8, // tfTransferable
      burnable: 1 // tfBurnable
    }
  },

  // Escrow Configuration
  ESCROW: {
    defaultDuration: 86400, // 24 hours in seconds
    minFinishAfter: 3600, // 1 hour minimum
    dataQualityThreshold: 80 // 80% quality required
  }
};

// SportiQue Platform Wallets
export const PLATFORM_WALLETS = {
  // Main SportiQue wallet
  SPORTIQUE_MAIN: process.env.SPORTIQUE_MAIN_WALLET || '',
  SPORTIQUE_MAIN_SECRET: process.env.SPORTIQUE_MAIN_SECRET || '',

  // Escrow management wallet
  ESCROW_MANAGER: process.env.ESCROW_MANAGER_WALLET || '',
  ESCROW_MANAGER_SECRET: process.env.ESCROW_MANAGER_SECRET || '',

  // NFT issuer wallet
  NFT_ISSUER: process.env.NFT_ISSUER_WALLET || '',
  NFT_ISSUER_SECRET: process.env.NFT_ISSUER_SECRET || ''
};

// Firebase Configuration
export const FIREBASE_CONFIG = {
  collections: {
    USERS: 'users',
    ENTERPRISES: 'enterprises',
    SPORTIQUE: 'sportique',
    ANONYMIZED_HEALTH_DATA: 'anonymized_health_data',
    NFT_REGISTRY: 'nft_registry',
    DOMAINS: 'domains',
    ISSUANCES: 'issuances',
    SYNC_STATUS: 'sync_status',
    ADMINS: 'admins'
  }
};

// IPFS Configuration for NFT Metadata
export const IPFS_CONFIG = {
  gateway: 'https://ipfs.io/ipfs/',
  pinataApiKey: process.env.PINATA_API_KEY || '',
  pinataSecretKey: process.env.PINATA_SECRET_KEY || ''
};

// Get current XRPL server URL
export function getXRPLServerUrl(): string {
  return XRPL_CONFIG[XRPL_CONFIG.CURRENT_NETWORK].server;
}

// Get current XRPL explorer URL
export function getXRPLExplorerUrl(): string {
  return XRPL_CONFIG[XRPL_CONFIG.CURRENT_NETWORK].explorer;
}