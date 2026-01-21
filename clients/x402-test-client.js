import { withPaymentInterceptor } from '@x402/fetch';
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount(process.env.PRIVATE_KEY);
const x402Fetch = withPaymentInterceptor(fetch, account);

const res = await x402Fetch(
  'http://localhost:4021/api/premium'
);

console.log(await res.json());
