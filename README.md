# SportiQue - XRPL Blockchain Healthcare Data Marketplace

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![XRPL](https://img.shields.io/badge/XRPL-Mainnet-brightgreen)](https://xrpl.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

**A blockchain-based healthcare data marketplace that tokenizes health data as NFTs and enables secure trading through XRPL Escrow**

SportiQue leverages XRP Ledger's NFTokens, Escrow, and MPT (Multi-Purpose Tokens) to return data ownership to users while enabling transparent and secure data trading.

## 📄 Documentation

### 📊 Presentation
- **[UniQData Pitch Deck (PDF)](./docs/presentation/UniQData_Pitch_Deck.pdf)** - Business presentation and service overview

### 📘 Technical Documentation
- **[XRPL Technical Design (PDF)](./docs/technical/SportiQue_XRPL_Technical_Design.pdf)** - Complete system architecture and XRPL integration details
- **[XRPL Technical Implementation](./docs/technical/XRPL_TECHNICAL_IMPLEMENTATION.md)** - XRPL feature implementation guide
- **[XRPL Implementation Links](./docs/technical/XRPL_IMPLEMENTATION_LINKS.md)** - XRPL feature code locations
- **[XRPL Integration Details](./docs/technical/XRPL_INTEGRATION_DETAILS.md)** - XRPL integration specifics
- **[XRPL Core Requirements](./docs/technical/XRPL_CORE_REQUIREMENTS.md)** - XRPL core requirements

### 🔌 API Documentation
- **[API Reference](./docs/api/API_DOCUMENTATION.md)** - REST API endpoints reference

### 📝 Submission
- **[Submission Guide](./docs/SUBMISSION_GUIDE.md)** - Hackathon submission guide

## 🎯 Key XRPL Features

### ✅ NFTokens - Data Access Control
All health data access rights are managed through NFTs. Only NFT owners can decrypt the encrypted data.

```typescript
// core/nft.ts
const nftId = await mintNFT(wallet, {
  uri: 'https://sportique.io/data/user_123',
  transferFee: 0,
  flags: 8 // tfTransferable
});
```

### ✅ Escrow - Trustless Trading
Enterprise data purchase funds are locked in Escrow, enabling secure transactions without platform trust.

```typescript
// core/escrow.ts
await createEscrow(enterpriseWallet, userWallet, '500', {
  finishAfter: Date.now() + 7 * 24 * 60 * 60, // 7 days
  condition: nftTransferCondition
});
```

### ✅ MPT (Multi-Purpose Tokens) - Reward System
User activity rewards are batch processed with MPT, reducing transaction costs by 99.9%.

```typescript
// core/mpt.ts
await createMPToken(platformWallet, {
  maxAmount: '1000000000', // 1B points
  assetScale: 2
});
```

## 📁 Project Structure

```
XRP_LEDGER/
│
├── 📄 docs/                             # Documentation
│   ├── presentation/                    # Business presentations
│   │   └── UniQData_Pitch_Deck.pdf     # Pitch deck (11.3MB)
│   ├── technical/                       # Technical documents
│   │   ├── SportiQue_XRPL_Technical_Design.pdf  # System design (225KB)
│   │   ├── XRPL_TECHNICAL_IMPLEMENTATION.md
│   │   ├── XRPL_IMPLEMENTATION_LINKS.md
│   │   ├── XRPL_INTEGRATION_DETAILS.md
│   │   └── XRPL_CORE_REQUIREMENTS.md
│   ├── api/                             # API documentation
│   │   └── API_DOCUMENTATION.md
│   └── SUBMISSION_GUIDE.md              # Submission guide
│
├── 💻 core/                             # XRPL Core Modules
│   ├── config.ts                        # Network configuration
│   ├── wallet.ts                        # Wallet management
│   ├── nft.ts                           # NFToken operations
│   ├── escrow.ts                        # Escrow operations
│   ├── mpt.ts                           # Multi-Purpose Tokens
│   ├── payment.ts                       # XRP payments
│   ├── dataPool.ts                      # Data pool utilities
│   ├── firebase.ts                      # Firebase integration
│   └── types.ts                         # Type definitions
│
├── 🏢 platform/                         # Business Logic Layer
│   ├── enterprise/                      # Enterprise domain
│   │   ├── EnterpriseAuth.ts
│   │   ├── DataPoolManager.ts
│   │   └── SubscriptionManager.ts
│   ├── user/                            # User domain
│   │   ├── UserAuth.ts
│   │   └── HealthDataManager.ts
│   ├── xrpl/                            # XRPL integration
│   │   ├── XrplWallet.ts
│   │   ├── XrplEscrow.ts
│   │   └── NftGenerator.ts
│   ├── data/                            # Data processing
│   │   └── QualityEvaluator.ts
│   └── types/                           # Platform types
│
├── 🔄 transactions/                     # Transaction Flows
│   ├── NFTAccessControl.ts              # NFT-based access control
│   ├── SubscriptionNFT.ts               # Subscription NFTs
│   ├── SubscriptionEscrow.ts            # Subscription payments
│   ├── PoolNFT.ts                       # Data pool NFTs
│   ├── DataPoolParticipation.ts         # Pool participation
│   ├── DataReward.ts                    # Reward distribution
│   ├── MPTPointSystem.ts                # MPT point system
│   └── scripts/                         # Demo scripts
│       ├── dataPoolScenario.ts
│       ├── mptScenario.ts
│       └── seedFirestore.ts
│
├── 🎨 UI_SCREEN/                        # UI Screenshots
├── 📦 package.json                      # Dependencies
└── 📝 README.md                         # This file
```

## 🎯 Core Features

### 1. NFT-Based Subscription System
Service access rights are managed through subscription NFTs with secure payment processing via escrow.

<p align="center">
  <img src="https://github.com/user-attachments/assets/e4915f28-a7e1-437e-a7f0-fc6a4cc5ac67" height="450" alt="img3" />
  &nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/ffbdbf16-49e9-495f-b100-15d1fdc24173" height="450" alt="img4" />
</p>

### 2. Data Pool Management
Facilitates health data trading between enterprises and users with NFT-based proof of data ownership.

<p align="center">
  <img src="https://github.com/user-attachments/assets/f5cc1ac9-04a0-4d98-aea4-b5cb5d4e60cf" height="420" alt="img1" />
  &nbsp;&nbsp;
  <img src="https://github.com/user-attachments/assets/99e2a0b5-fdd0-451b-ae96-87a05fb07aea" height="420" alt="img2" />
</p>

### 3. Reward System
- Automatic reward distribution to data providers
- Quality-based differential rewards
- Batch processing for efficiency

### 4. Security & Privacy
- Anonymized health data processing
- NFT-based access control
- Zero PII on blockchain

## 📚 Technology Stack

### Core Dependencies
- **XRPL**: `xrpl@2.14.0` - XRP Ledger JavaScript SDK
- **TypeScript**: `5.3+` - Type-safe development
- **Firebase**: `10.7.0` - Encrypted health data storage
- **Node.js**: `20+` - Runtime environment

### XRPL Integration
```json
{
  "dependencies": {
    "xrpl": "^2.14.0",
    "firebase": "^10.7.0",
    "crypto-js": "^4.2.0",
    "uuid": "^9.0.1"
  }
}
```

## 🚀 Quick Start

### Installation
```bash
npm install
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your XRPL credentials
```

### Run Demo
```bash
# NFT + Escrow data trading demo
npm run demo:datapool

# MPT reward distribution demo
npm run demo:mpt

# Subscription escrow demo
npm run demo:subscription
```

## 📊 Key Metrics

### XRPL Performance
- **Transaction Cost**: 0.000012 XRP (~$0.00002)
- **NFT Mint Time**: 3-5 seconds
- **Escrow Settlement**: Automatic on condition fulfillment
- **MPT Batch Efficiency**: 99.9% cost reduction vs individual payments

### Business Value
- **Data Ownership**: Users own their health data NFTs
- **Transparent Trading**: All transactions on public ledger
- **Privacy**: Zero PII on blockchain (encrypted off-chain)
- **Trustless**: Escrow eliminates platform risk

## 🔐 Security Features

### NFT-Based Access Control
```typescript
// Middleware verifies NFT ownership before database query
if (verifyNFTOwnership(nftId, requesterWallet)) {
  return decryptedHealthData;
}
```

### Escrow Protection
- Funds locked until NFT transfer confirmed
- Automatic refund if timeout (7 days)
- No platform custody of funds

### Data Encryption
- AES-256 encryption for health records
- AWS KMS key management
- Decryption keys never exposed

## 📖 Additional Resources

### Technical Deep Dive
For detailed technical architecture, XRPL integration patterns, and system design, see:

📄 **[XRPL Technical Design (PDF)](./docs/technical/SportiQue_XRPL_Technical_Design.pdf)** (225KB)

This comprehensive document includes:
- System architecture diagrams
- XRPL primitive usage (NFTokens, Escrow, MPT)
- Data flow diagrams
- Code organization
- Security architecture
- Deployment architecture

### Business Overview
For product vision, market analysis, and business model, see:

📊 **[UniQData Pitch Deck (PDF)](./docs/presentation/UniQData_Pitch_Deck.pdf)** (11.3MB)

- Service overview and features
- Target market analysis
- Revenue model
- Team introduction

## 🤝 Contributing

This project is part of the XRPL Hackathon submission. Contributions, issues, and feature requests are welcome!

## 📝 License

MIT License - see LICENSE file for details

---

**Built with ❤️ on the XRP Ledger**

> SportiQue is a complete blockchain solution for secure health data trading and transparent reward distribution.