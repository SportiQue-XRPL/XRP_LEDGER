import { Client, Wallet, xrpToDrops, convertStringToHex, FundResult } from 'xrpl';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { createSubscriptionEscrow } from '../SubscriptionEscrow';
import { issueSubscriptionNFT } from '../SubscriptionNFT';
import { payDataReward } from '../DataReward';

const firebaseConfig = {
  apiKey: "AIzaSyBlkthPW-3LCSVvyXg4k8yYZ7lx_5RZg3E",
  authDomain: "xrplhackathon-9bf0a.firebaseapp.com",
  projectId: "xrplhackathon-9bf0a",
  storageBucket: "xrplhackathon-9bf0a.appspot.com",
  messagingSenderId: "235937752656",
  appId: "1:235937752656:web:abcdef1234567890abcdef"
};

const TESTNET_URL = 'wss://s.altnet.rippletest.net:51233';

async function fundIfNeeded(client: Client, seed?: string) {
  if (seed) return Wallet.fromSeed(seed);
  const { wallet } = await client.fundWallet();
  return wallet;
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const client = new Client(TESTNET_URL);
  await client.connect();
  console.log('Connected to XRPL Testnet');

  // Platform wallet (minter)
  const platform = await fundIfNeeded(client);
  console.log('Platform wallet funded:', platform.address);

  // Enterprise wallet (payer)
  const enterprise = await fundIfNeeded(client);
  console.log('Enterprise wallet funded:', enterprise.address);

  await client.disconnect();

  // Seeded user
  const userId = 'user_123456';
  const userDoc = await getDoc(doc(db, 'users', userId));
  if (!userDoc.exists()) throw new Error('Seeded user not found. Please run npm run seed:firestore');

  // 1) Create subscription escrow
  const escrow = await createSubscriptionEscrow(
    { address: enterprise.address, seed: enterprise.seed! },
    userId,
    30,
    ['glucose'],
    100
  );
  console.log('Escrow result:', escrow);
  if (!escrow.success) throw new Error('Escrow failed');

  // 2) Issue subscription NFT to enterprise
  const nft = await issueSubscriptionNFT(
    { address: platform.address, seed: platform.seed! },
    { address: enterprise.address },
    escrow.subscriptionId
  );
  console.log('NFT result:', nft);
  if (!nft.success) throw new Error('NFT mint failed');

  // 3) Pay data reward for seeded health_data
  const dataId = 'data_123456_20250920_glucose';
  const reward = await payDataReward(
    { address: enterprise.address, seed: enterprise.seed! },
    dataId,
    escrow.subscriptionId
  );
  console.log('Reward result:', reward);
  if (!reward.success) throw new Error('Reward payment failed');

  console.log('\nDemo completed successfully.');
}

main().catch((err) => {
  console.error('Demo failed', err);
  process.exit(1);
});
