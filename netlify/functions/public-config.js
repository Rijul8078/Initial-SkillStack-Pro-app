const { json } = require('./_lib/http');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  return json(200, {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    freeModuleCount: Number(process.env.FREE_MODULE_COUNT || 2),
    subscriptionAmountInr: Number(process.env.SUBSCRIPTION_AMOUNT_INR || 1499),
  });
};
