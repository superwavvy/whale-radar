# Whale Radar

Whale Radar is a real-time Solana DEX intelligence platform. It tracks large trades (over 10 SOL) across Raydium and Meteora, providing a live dashboard and automated Telegram alerts for community channels.

## The Problem

In decentralized finance, large trades by "whales" often precede significant market movements. Manually monitoring multiple liquidity pools across different DEXs is inefficient and prone to missed opportunities. Whale Radar automates this surveillance, acting as an early warning system for significant capital movements.

## How it Works

The platform indexes real-time transaction data from the Solana blockchain. 

1. **Data Ingestion:** It listens to swap events on Raydium and Meteora via Helius webhooks and WebSockets.
2. **Filtering:** Transactions are evaluated against a configurable threshold (defaulting to 10 SOL).
3. **Storage & Analysis:** Significant trades are recorded in a Supabase database for historical analysis.
4. **Alerting:** The system dispatches immediate notifications to configured Telegram channels, allowing communities to react to whale activity in real time.
5. **Dashboard:** A Next.js interface provides a live feed and analytics of recent large transactions.

## Architecture

- **Frontend:** Next.js (App Router) and Tailwind CSS.
- **Data Provider:** Helius API for real-time Solana indexing.
- **Database:** Supabase (PostgreSQL) for storing trade history and configuration.
- **Bot:** Telegram Bot API for push notifications.

## Quick Start

### 1. Clone the repository

```bash
git clone git@github.com:superwavvy/whale-radar.git
cd whale-radar
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Populate the `.env` file with your `HELIUS_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `TELEGRAM_BOT_TOKEN`.

### 4. Run the development server

```bash
npm run dev
```

## Limitations

The current implementation relies on the uptime and API limits of the Helius free tier. In periods of extreme network congestion on Solana, webhook delays may occur.
