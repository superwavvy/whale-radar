import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Ignore wrapped SOL, USDC, and USDT.
const IGNORE_MINTS = new Set([
  'So11111111111111111111111111111111111111112', // WSOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'  // USDT
]);

const WEBHOOK_SECRET = process.env.HELIUS_WEBHOOK_SECRET || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Helper: Proper ordinal suffix (1st, 2nd, 3rd, 4th, 11th, 21st, etc.)
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Helper: Fetch token symbol and market cap from DexScreener
async function getTokenInfo(mintAddress: string) {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    const data = await res.json();
    
    if (data && data.pairs && data.pairs.length > 0) {
      const pair = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
      return {
        symbol: pair.baseToken?.symbol || 'UNKNOWN',
        marketCap: pair.fdv ? `$${(pair.fdv / 1_000_000).toFixed(2)}M` : 'N/A',
        dex: pair.dexId?.toUpperCase() || 'DEX'
      };
    }
    return { symbol: 'UNKNOWN', marketCap: 'N/A', dex: 'DEX' };
  } catch (error) {
    console.error("DexScreener fetch error:", error);
    return { symbol: 'UNKNOWN', marketCap: 'N/A', dex: 'DEX' };
  }
}

// Helper: Get how many times this wallet has traded today
async function getWalletTradeCount(wallet: string) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('whales')
      .select('*', { count: 'exact', head: true })
      .eq('wallet', wallet)
      .gte('timestamp', since);
    
    if (error) return 0;
    return count || 0;
  } catch (error) {
    return 0;
  }
}

// Helper: Check if this signature already exists in the database (Deduplication)
async function isDuplicateTransaction(signature: string) {
  try {
    const { data, error } = await supabase
      .from('whales')
      .select('sig')
      .eq('sig', signature)
      .limit(1);
    
    if (error) return false;
    return data && data.length > 0;
  } catch (error) {
    return false;
  }
}

async function sendTelegramAlert(message: string) {
  if (!TG_TOKEN || !TG_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    console.error("🚨 TELEGRAM_SEND_ERROR:", error);
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (WEBHOOK_SECRET && authHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const transactions = Array.isArray(payload) ? payload : [payload];
    const rowsToInsert = [];

    for (const tx of transactions) {
      if (!tx || typeof tx !== 'object') continue;
      if (tx.type && tx.type !== 'SWAP') continue;

      const feePayer = tx.feePayer || 'UNKNOWN';
      const signature = tx.signature || 'UNKNOWN';
      
      // FIX 1: Deduplicate exact same transaction
      const isDup = await isDuplicateTransaction(signature);
      if (isDup) {
        console.log(`Skipping duplicate tx: ${signature}`);
        continue;
      }

      let tokenMint = 'UNKNOWN';
      if (Array.isArray(tx.tokenTransfers)) {
        const userTransfer = tx.tokenTransfers.find((t: any) => 
          t && t.mint && 
          !IGNORE_MINTS.has(t.mint) && 
          (t.fromUserAccount === feePayer || t.toUserAccount === feePayer)
        );
        if (userTransfer && userTransfer.mint) tokenMint = userTransfer.mint;
      }

      if (tokenMint === 'UNKNOWN') continue;

      let netSolChange = 0;
      if (Array.isArray(tx.nativeTransfers)) {
        tx.nativeTransfers.forEach((t: any) => {
          if (!t) return;
          if (t.fromUserAccount === feePayer) netSolChange -= (t.amount || 0);
          if (t.toUserAccount === feePayer) netSolChange += (t.amount || 0);
        });
      }

      const amountSol = Math.abs(netSolChange) / 1e9;
      let action = 'SWAP';
      if (netSolChange < 0) action = 'BUY';
      else if (netSolChange > 0) action = 'SELL';

      // Filter: > 10 SOL
      if (amountSol < 10) continue;

      // 1. Fetch Token Info & Repeat Wallet Count
      const [tokenInfo, tradeCount] = await Promise.all([
        getTokenInfo(tokenMint),
        getWalletTradeCount(feePayer)
      ]);

      // 2. Prepare Telegram Message
      const emoji = action === 'BUY' ? '🟢' : '🔴';
      const solscanTxLink = `https://solscan.io/tx/${signature}`;
      const solscanAccountLink = `https://solscan.io/account/${feePayer}`;
      const dexScreenerLink = `https://dexscreener.com/solana/${tokenMint}`;
      const shortWallet = `${feePayer.slice(0, 4)}...${feePayer.slice(-4)}`;
      
      let repeatTag = '';
      if (tradeCount > 0) {
        const currentTradeNum = tradeCount + 1;
        const ordinal = getOrdinalSuffix(currentTradeNum);
        repeatTag = `\n🔄 <b>Repeat Wallet:</b> ${ordinal} trade today`;
      }

      // FIX 3: Split Token and DEX. FIX 4: Tappable wallet & chart link. FIX 5: Disclaimer footer.
      const message = `${emoji} <b>WHALE ${action}</b>\n\n` +
                      `💰 <b>Amount:</b> ${amountSol.toFixed(2)} SOL\n` +
                      `🪙 <b>Token:</b> ${tokenInfo.symbol}\n` +
                      `🏦 <b>DEX:</b> ${tokenInfo.dex}\n` +
                      `📊 <b>Market Cap:</b> ${tokenInfo.marketCap}\n` +
                      `👤 <b>Wallet:</b> <a href="${solscanAccountLink}">${shortWallet}</a>${repeatTag}\n\n` +
                      `🔗 <a href="${solscanTxLink}">Solscan</a> | <a href="${dexScreenerLink}">Chart</a>\n\n` +
                      `<i>Automated on-chain alerts, not financial advice.</i>`;

      // 3. Send Telegram Alert
      await sendTelegramAlert(message);

      // 4. Push to Supabase
      rowsToInsert.push({
        sig: signature,
        venue: 'raydium',
        wallet: feePayer,
        amount_sol: amountSol,
        token_mint: tokenMint,
        action: action, 
        timestamp: new Date().toISOString()
      });
    }

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
    }

    const { error } = await supabase.from('whales').insert(rowsToInsert);

    if (error) {
      console.error("🚨 SUPABASE_ERROR:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, processed: rowsToInsert.length });
  } catch (error: any) {
    console.error("🚨 WEBHOOK_CRASH:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
