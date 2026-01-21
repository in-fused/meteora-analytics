/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LIQUIDITY PRO - x402 API TEST CLIENT
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * This demonstrates how a trading bot or AI agent would access paid API endpoints
 * using the x402 protocol. The client automatically handles:
 * 
 * 1. Detecting 402 Payment Required responses
 * 2. Signing payment payloads with wallet
 * 3. Retrying requests with payment proof
 * 
 * SETUP:
 * 1. npm install @x402/fetch viem dotenv
 * 2. Export PRIVATE_KEY in environment (base58 or hex)
 * 3. Ensure wallet has USDC on Base Sepolia (testnet)
 * 4. node test-client.js
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { withPaymentInterceptor } from '@x402/fetch';
import { privateKeyToAccount } from 'viem/accounts';
import { config } from 'dotenv';

config();

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE_URL = process.env.API_URL || 'http://localhost:4021';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY environment variable required');
  console.log('   Export your Base Sepolia wallet private key:');
  console.log('   export PRIVATE_KEY=0x...');
  process.exit(1);
}

// Create wallet account from private key
const account = privateKeyToAccount(PRIVATE_KEY.startsWith('0x') ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
console.log(`💳 Wallet: ${account.address}`);

// Create x402-enabled fetch client
// This automatically handles 402 responses and payment signing
const x402Fetch = withPaymentInterceptor(fetch, account);

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function testHealthCheck() {
  console.log('\n📍 Testing: GET /api/v1/health (free)');
  const response = await fetch(`${API_BASE_URL}/api/v1/health`);
  const data = await response.json();
  console.log('   Status:', response.status);
  console.log('   Data:', JSON.stringify(data, null, 2));
  return data;
}

async function testFreePoolsList() {
  console.log('\n📍 Testing: GET /api/v1/pools (free, rate limited)');
  const response = await fetch(`${API_BASE_URL}/api/v1/pools`);
  const data = await response.json();
  console.log('   Status:', response.status);
  console.log('   Rate Limit Remaining:', response.headers.get('X-RateLimit-Remaining'));
  console.log('   Pool Count:', data.count);
  if (data.data && data.data[0]) {
    console.log('   Sample Pool:', data.data[0].name);
  }
  return data;
}

async function testPremiumPools() {
  console.log('\n💰 Testing: GET /api/v1/pools/premium (PAID - $0.001)');
  console.log('   Using x402 payment interceptor...');
  
  try {
    const response = await x402Fetch(`${API_BASE_URL}/api/v1/pools/premium`);
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Payment TX:', data.payment?.txHash || 'N/A');
    console.log('   Pool Count:', data.count);
    console.log('   Sample Pool with Analytics:', data.data?.[0]?.name);
    if (data.data?.[0]?.analytics) {
      console.log('   Analytics Preview:', {
        score: data.data[0].score,
        volumeToTvl: data.data[0].analytics.volumeToTvl?.toFixed(2),
        feeTvlRatio: data.data[0].analytics.feeTvlRatio?.toFixed(4),
      });
    }
    return data;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    if (error.message.includes('402') || error.message.includes('payment')) {
      console.log('   💡 Ensure wallet has USDC on Base Sepolia');
      console.log('   💡 Get testnet USDC: https://faucet.circle.com/');
    }
    return null;
  }
}

async function testOpportunities() {
  console.log('\n💰 Testing: GET /api/v1/opportunities (PAID - $0.002)');
  
  try {
    const response = await x402Fetch(`${API_BASE_URL}/api/v1/opportunities`);
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Opportunities Count:', data.count);
    if (data.data?.[0]) {
      console.log('   Top Opportunity:', {
        name: data.data[0].name,
        score: data.data[0].score,
        type: data.data[0].oppType,
        reason: data.data[0].reason?.substring(0, 50) + '...',
      });
    }
    return data;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return null;
  }
}

async function testPoolAnalytics(poolAddress) {
  console.log(`\n💰 Testing: GET /api/v1/pool/${poolAddress}/analytics (PAID - $0.005)`);
  
  try {
    const response = await x402Fetch(`${API_BASE_URL}/api/v1/pool/${poolAddress}/analytics`);
    const data = await response.json();
    console.log('   Status:', response.status);
    console.log('   Pool:', data.data?.name);
    console.log('   Score:', data.data?.score);
    console.log('   Analytics:', data.data?.analytics);
    return data;
  } catch (error) {
    console.log('   ❌ Error:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
  LIQUIDITY PRO - x402 API CLIENT TEST
═══════════════════════════════════════════════════════════════════════════════

  API Server:    ${API_BASE_URL}
  Wallet:        ${account.address}
  Network:       Base Sepolia (testnet)
  
  This will test both free and paid API endpoints.
  Paid endpoints require USDC balance on Base Sepolia.
  
═══════════════════════════════════════════════════════════════════════════════
`);

  // Test free endpoints
  await testHealthCheck();
  await testFreePoolsList();
  
  // Test paid endpoints (requires USDC)
  console.log('\n─── PAID ENDPOINTS (require USDC on Base Sepolia) ───');
  
  const premiumData = await testPremiumPools();
  await testOpportunities();
  
  // If we got premium data, test analytics on first pool
  if (premiumData?.data?.[0]?.address) {
    await testPoolAnalytics(premiumData.data[0].address);
  }
  
  console.log(`
═══════════════════════════════════════════════════════════════════════════════
  TEST COMPLETE
═══════════════════════════════════════════════════════════════════════════════

  If paid endpoints failed:
  1. Get testnet USDC from https://faucet.circle.com/
  2. Ensure wallet ${account.address} has USDC on Base Sepolia
  3. Re-run this test
  
  For production:
  - Change PAYMENT_NETWORK to 'eip155:8453' (Base Mainnet)
  - Use real USDC
  - Update facilitator URL to CDP mainnet endpoint
  
═══════════════════════════════════════════════════════════════════════════════
`);
}

main().catch(console.error);
