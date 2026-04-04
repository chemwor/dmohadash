import { Handler } from '@netlify/functions';
import Stripe from 'stripe';

type Period = 'today' | 'week' | 'month';

function getTimestampRange(period: Period): { gte: number; lte: number } {
  const now = new Date();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const lte = Math.floor(endOfDay.getTime() / 1000);

  let gte: number;
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
    default:
      gte = Math.floor(Date.now() / 1000) - 86400;
  }

  return { gte, lte };
}

export const handler: Handler = async (event) => {
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
    const period = (event.queryStringParameters?.period || 'today') as Period;
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

    // Get recent transactions for display
    const recentCharges = await stripe.charges.list({
      limit: 10,
    });

    const recentTransactions = recentCharges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount / 100,
      status: charge.status,
      created: new Date(charge.created * 1000).toISOString(),
      description: charge.description || 'Payment',
      refunded: charge.refunded,
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
        period,
      }),
    };
  } catch (error) {
    console.error('Stripe API error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch Stripe data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
