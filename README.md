# DisputeMyHOA Operations Dashboard

Internal operations dashboard for monitoring DisputeMyHOA business metrics.

## Tech Stack

- **Frontend**: Angular 17+ (standalone components)
- **Backend**: Netlify Functions (serverless)
- **Styling**: Tailwind CSS
- **Deploy**: Netlify

## Features

- Real-time revenue tracking (Stripe)
- Email marketing metrics (Klaviyo)
- Advertising performance (Google Ads)
- Conversion funnel analytics (Supabase)
- Password-protected access

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Netlify CLI (optional, for local dev)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env .env

# Edit .env with your API keys
```

### Development

```bash
# Start Angular dev server only (no backend)
npm start

# Start with Netlify Functions (recommended)
npm run dev
# or
netlify dev
```

The dashboard will be available at `http://localhost:8888` (with Netlify dev) or `http://localhost:4200` (Angular only).

### Build

```bash
npm run build
```

Output will be in `dist/disputemyhoa-dashboard/browser/`.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Yes |
| `KLAVIYO_API_KEY` | Klaviyo private API key | Yes |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads developer token | No (mock data) |
| `GOOGLE_ADS_CUSTOMER_ID` | Google Ads customer ID | No (mock data) |
| `SUPABASE_URL` | Supabase project URL | Yes* |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes* |
| `DASHBOARD_PASSWORD` | Dashboard login password | No (default: disputemyhoa2024) |

*If Supabase is not configured, the dashboard will show mock data.

## Deployment to Netlify

### Via Netlify CLI

```bash
# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

### Via Git

1. Push your code to GitHub
2. Connect the repository in Netlify Dashboard
3. Add environment variables in Site Settings > Environment Variables
4. Deploy

### Environment Variables on Netlify

Add all variables from `.env.example` in:
**Site Settings > Build & Deploy > Environment > Environment Variables**

## Configuring Google Ads API

The Google Ads function currently returns mock data. To connect the real API:

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable the Google Ads API

### 2. Get Developer Token

1. Log into [Google Ads](https://ads.google.com)
2. Go to Tools & Settings > API Center
3. Apply for a developer token (Basic access is fine for read-only)

### 3. Set Up OAuth2

1. In Google Cloud Console, go to APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs
4. Download client credentials

### 4. Generate Refresh Token

Use the [OAuth Playground](https://developers.google.com/oauthplayground/) to generate a refresh token:

1. Configure OAuth Playground with your client ID/secret
2. Authorize the Google Ads API scope
3. Exchange authorization code for tokens
4. Copy the refresh token

### 5. Update Environment Variables

```env
GOOGLE_ADS_CLIENT_ID=your_client_id
GOOGLE_ADS_CLIENT_SECRET=your_client_secret
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token
GOOGLE_ADS_CUSTOMER_ID=1234567890  # no dashes
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
```

### 6. Update the Function

Replace the mock data in `netlify/functions/google-ads.ts` with actual API calls. See the comments in that file for code examples.

## Supabase Schema

The dashboard expects these tables (adjust names in `netlify/functions/supabase.ts`):

### `previews` table
```sql
create table previews (
  id uuid primary key default gen_random_uuid(),
  type text not null, -- 'quick' or 'full'
  created_at timestamptz default now(),
  user_id uuid references auth.users(id)
);
```

### `orders` table
```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  amount numeric,
  status text default 'completed'
);
```

### `sessions` table
```sql
create table sessions (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  created_at timestamptz default now(),
  page_url text
);
```

## Dashboard Password

The default password is `disputemyhoa2024`. Change it by setting the `DASHBOARD_PASSWORD` environment variable.

Note: This is a simple password gate, not a full authentication system. For production, consider implementing proper auth (e.g., Netlify Identity, Auth0, or Supabase Auth).

## Project Structure

```
disputemyhoa-dashboard/
├── src/                        # Angular frontend
│   ├── app/
│   │   ├── core/
│   │   │   ├── guards/        # Auth guard
│   │   │   └── services/      # API services
│   │   ├── shared/
│   │   │   └── components/    # Reusable components
│   │   └── pages/
│   │       ├── login/         # Login page
│   │       └── dashboard/     # Main dashboard
│   └── styles.css             # Global styles + Tailwind
├── netlify/
│   └── functions/             # Serverless functions
│       ├── stripe.ts
│       ├── klaviyo.ts
│       ├── google-ads.ts
│       └── supabase.ts
├── netlify.toml               # Netlify config
├── tailwind.config.js
└── package.json
```

## License

Private - Internal use only.
