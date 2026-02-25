require('dotenv').config();
const Stripe = require('stripe');

// Minimum date: January 1, 2026
const MIN_DATE_2026 = new Date('2026-01-01T00:00:00Z');
const MIN_TIMESTAMP_2026 = Math.floor(MIN_DATE_2026.getTime() / 1000);

function getTimestampRange(period) {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const lte = Math.floor(endOfDay.getTime() / 1000);

  let gte;
  switch (period) {
    case 'today':
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      gte = Math.floor(startOfDay.getTime() / 1000);
      break;
    case 'week':
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      weekAgo.setHours(0, 0, 0, 0);
      gte = Math.floor(weekAgo.getTime() / 1000);
      break;
    case 'month':
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      monthAgo.setHours(0, 0, 0, 0);
      gte = Math.floor(monthAgo.getTime() / 1000);
      break;
    case 'all':
      // All data from 2026 onwards
      gte = MIN_TIMESTAMP_2026;
      break;
    default:
      gte = Math.floor(Date.now() / 1000) - 86400;
  }

  // Ensure we never go before 2026
  gte = Math.max(gte, MIN_TIMESTAMP_2026);

  return { gte, lte };
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Stripe API key not configured' }),
    };
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

  try {
    const period = event.queryStringParameters?.period || 'today';
    const { gte, lte } = getTimestampRange(period);

    // Fetch charges for the period
    const charges = await stripe.charges.list({
      created: { gte, lte },
      limit: 100,
    });

    // Calculate revenue and transactions
    const successfulCharges = charges.data.filter(c => c.status === 'succeeded');
    const revenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0) / 100;
    const transactions = successfulCharges.length;

    // Map all successful charges for the period with name and email
    const allTransactions = charges.data
      .filter(charge => charge.status === 'succeeded' && !charge.refunded)
      .map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        status: charge.status,
        created: new Date(charge.created * 1000).toISOString(),
        description: charge.description || 'Payment',
        name: charge.billing_details?.name || null,
        email: charge.billing_details?.email || charge.receipt_email || null,
      }));

    // Fetch refunds for the period
    const refunds = await stripe.refunds.list({
      created: { gte, lte },
      limit: 100,
    });

    const refundCount = refunds.data.length;
    const refundAmount = refunds.data.reduce((sum, r) => sum + r.amount, 0) / 100;

    // Calculate MRR (Monthly Recurring Revenue)
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });

    const mrr = subscriptions.data.reduce((sum, sub) => {
      const item = sub.items.data[0];
      if (item && item.price.unit_amount) {
        const amount = item.price.unit_amount / 100;
        const interval = item.price.recurring?.interval;
        if (interval === 'year') {
          return sum + (amount / 12);
        }
        return sum + amount;
      }
      return sum;
    }, 0);

    // Get recent successful transactions for display (from 2026 onwards)
    const recentCharges = await stripe.charges.list({
      created: { gte: MIN_TIMESTAMP_2026 },
      limit: 50, // Fetch more to ensure we get 10 successful ones after filtering
    });

    const recentTransactions = recentCharges.data
      .filter(charge => charge.status === 'succeeded' && !charge.refunded)
      .slice(0, 10)
      .map(charge => ({
        id: charge.id,
        amount: charge.amount / 100,
        status: charge.status,
        created: new Date(charge.created * 1000).toISOString(),
        description: charge.description || 'Payment',
        refunded: charge.refunded,
        name: charge.billing_details?.name || null,
        email: charge.billing_details?.email || charge.receipt_email || null,
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        revenue,
        transactions,
        refunds: {
          count: refundCount,
          amount: refundAmount,
        },
        mrr,
        recentTransactions,
        allTransactions,
        period,
        dataFrom: '2026-01-01',
      }),
    };
  } catch (error) {
    console.error('Stripe API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Stripe data',
        message: error.message || 'Unknown error',
      }),
    };
  }
};
