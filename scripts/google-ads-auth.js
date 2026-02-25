#!/usr/bin/env node

/**
 * Google Ads OAuth2 Refresh Token Generator
 *
 * This script helps you generate a refresh token for the Google Ads API.
 *
 * Prerequisites:
 * 1. Create OAuth2 credentials in Google Cloud Console
 * 2. Enable the Google Ads API in your project
 * 3. Add your Client ID and Client Secret to .env
 *
 * Usage:
 *   node scripts/google-ads-auth.js
 *
 * The script will:
 * 1. Open a browser for you to authenticate
 * 2. After authentication, paste the authorization code
 * 3. Generate and display your refresh token
 */

require('dotenv').config();
const http = require('http');
const https = require('https');
const { URL, URLSearchParams } = require('url');

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/oauth2callback';
const SCOPE = 'https://www.googleapis.com/auth/adwords';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Error: Missing credentials!\n');
  console.error('Please add the following to your .env file:');
  console.error('  GOOGLE_ADS_CLIENT_ID=your_client_id');
  console.error('  GOOGLE_ADS_CLIENT_SECRET=your_client_secret\n');
  console.error('To get these credentials:');
  console.error('1. Go to https://console.cloud.google.com/');
  console.error('2. Create or select a project');
  console.error('3. Enable the Google Ads API');
  console.error('4. Go to APIs & Services → Credentials');
  console.error('5. Create OAuth 2.0 Client ID (Web application)');
  console.error('6. Add http://localhost:3456/oauth2callback to Authorized redirect URIs\n');
  process.exit(1);
}

// Build the authorization URL
const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
authUrl.searchParams.set('client_id', CLIENT_ID);
authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authUrl.searchParams.set('scope', SCOPE);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');

console.log('\n🔐 Google Ads OAuth2 Setup\n');
console.log('━'.repeat(50));
console.log('\nStep 1: Make sure you\'ve added the redirect URI to Google Cloud Console:');
console.log(`        ${REDIRECT_URI}\n`);
console.log('Step 2: Open this URL in your browser:\n');
console.log(`        ${authUrl.toString()}\n`);
console.log('Step 3: Sign in and grant access to your Google Ads account\n');
console.log('━'.repeat(50));
console.log('\nWaiting for authorization callback...\n');

// Start local server to receive the callback
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/oauth2callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Error: ${error}</h1><p>Please try again.</p></body></html>`);
      console.error(`\n❌ Authorization error: ${error}\n`);
      server.close();
      process.exit(1);
    }

    if (code) {
      // Exchange the code for tokens
      try {
        const tokens = await exchangeCodeForTokens(code);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <h1 style="color: #22c55e;">✅ Success!</h1>
              <p>Your refresh token has been generated.</p>
              <p>Check your terminal for the token and instructions.</p>
              <p>You can close this window.</p>
            </body>
          </html>
        `);

        console.log('\n✅ Success! Here\'s your refresh token:\n');
        console.log('━'.repeat(50));
        console.log('\nGOOGLE_ADS_REFRESH_TOKEN=' + tokens.refresh_token);
        console.log('\n━'.repeat(50));
        console.log('\n📋 Add this to your .env file:\n');
        console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}\n`);
        console.log('Your complete Google Ads configuration should look like:');
        console.log('━'.repeat(50));
        console.log(`GOOGLE_ADS_DEVELOPER_TOKEN=${process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'your_developer_token'}`);
        console.log(`GOOGLE_ADS_CUSTOMER_ID=${process.env.GOOGLE_ADS_CUSTOMER_ID || 'your_customer_id'}`);
        console.log(`GOOGLE_ADS_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GOOGLE_ADS_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GOOGLE_ADS_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('━'.repeat(50) + '\n');

        server.close();
        process.exit(0);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>Error exchanging code</h1><p>${err.message}</p></body></html>`);
        console.error('\n❌ Error exchanging code for tokens:', err.message, '\n');
        server.close();
        process.exit(1);
      }
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3456, () => {
  console.log('Local server running on http://localhost:3456');
  console.log('Waiting for OAuth callback...\n');

  // Try to open the browser automatically
  const { exec } = require('child_process');
  const openCommand = process.platform === 'darwin' ? 'open' :
                      process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${openCommand} "${authUrl.toString()}"`, (err) => {
    if (err) {
      console.log('Could not open browser automatically. Please open the URL above manually.\n');
    }
  });
});

function exchangeCodeForTokens(code) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const options = {
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': params.toString().length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const tokens = JSON.parse(data);
          if (tokens.error) {
            reject(new Error(tokens.error_description || tokens.error));
          } else if (!tokens.refresh_token) {
            reject(new Error('No refresh token received. Make sure you revoked previous access and try again.'));
          } else {
            resolve(tokens);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}
