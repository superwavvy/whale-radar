'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { Radar, Activity, TrendingUp, Users, Power, Crosshair, ChevronDown } from 'lucide-react';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Trade = {
  id: number;
  sig: string;
  venue: string;
  wallet: string;
  amount_sol: number;
  token_mint: string;
  action: string;
  timestamp: string;
};

const FETCH_LIMIT = 20;

export default function WhaleRadar() {
  const [isLive, setIsLive] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(FETCH_LIMIT);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTrades = useCallback(async (currentLimit: number) => {
    try {
      const { data, count, error } = await supabase
        .from('whales')
        .select('*', { count: 'exact' })
        .order('timestamp', { ascending: false })
        .range(0, currentLimit - 1);

      if (error) throw error;
      if (data) setTrades(data);
      if (count !== null) setTotalCount(count);
    } catch (err) {
      console.error("Error fetching trades:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades(limit);
  }, [limit, fetchTrades]);

  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => fetchTrades(limit), 10000);
    return () => clearInterval(interval);
  }, [isLive, limit, fetchTrades]);

  const formatTime = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const hasMore = trades.length < totalCount;

  return (
    <main className="min-h-screen bg-[#030704] text-white overflow-x-hidden relative selection:bg-emerald-500/30 flex flex-col min-[1080px]:h-screen min-[1080px]:overflow-hidden">
      
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#064e3b12_1px,transparent_1px),linear-gradient(to_bottom,#064e3b12_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-emerald-500/20 bg-[#030704]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 border border-emerald-500/50">
              <Radar className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-widest uppercase text-emerald-400">Whale Radar</span>
          </div>
          <button 
            onClick={() => setIsLive(!isLive)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest border transition-all ${
              isLive 
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]' 
                : 'bg-white/5 border-white/10 text-white/40'
            }`}
          >
            <Power className="w-3 h-3" />
            {isLive ? 'LIVE' : 'PAUSED'}
          </button>
        </div>
      </nav>

      {/* Content Container */}
      <div className="max-w-7xl mx-auto px-4 min-[1080px]:px-6 pt-20 min-[1080px]:pt-24 pb-6 relative z-10 flex flex-col flex-1 w-full min-h-0">
        
        {/* HUD Stats */}
        <div className="grid grid-cols-3 gap-2 min-[1080px]:gap-6 mb-6 flex-shrink-0">
          {[
            { label: 'TOTAL TRADES', value: totalCount.toString(), icon: <Activity className="w-4 h-4 min-[1080px]:w-5 min-[1080px]:h-5" /> },
            { label: '24H VOLUME', value: '777.8 SOL', icon: <TrendingUp className="w-4 h-4 min-[1080px]:w-5 min-[1080px]:h-5" /> },
            { label: '24H WALLETS', value: '26', icon: <Users className="w-4 h-4 min-[1080px]:w-5 min-[1080px]:h-5" /> },
          ].map((stat, i) => (
            <div key={i} className="bg-[#0a120e] border border-emerald-500/20 rounded-2xl p-3 min-[1080px]:p-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-0.5 min-[1080px]:h-1 bg-gradient-to-r from-emerald-500 to-transparent opacity-50" />
              <div className="flex items-center justify-between mb-2 min-[1080px]:mb-4">
                <span className="text-[9px] min-[1080px]:text-[11px] font-bold text-emerald-500/60 tracking-widest">{stat.label}</span>
                <div className="text-emerald-400">{stat.icon}</div>
              </div>
              <p className="text-lg min-[1080px]:text-3xl font-bold tracking-tight text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Main Grid - Added content-start and min-[1080px]:content-stretch per Claude's suggestion */}
        <div className="grid grid-cols-1 min-[1080px]:grid-cols-3 gap-6 min-[1080px]:gap-8 flex-1 min-h-0 content-start min-[1080px]:content-stretch">
          
          {/* Radar Visualization */}
          <div className="min-[1080px]:col-span-1 bg-[#0a120e] border border-emerald-500/20 rounded-3xl p-6 flex flex-col items-center justify-center h-[350px] min-[1080px]:h-full relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.1)_0%,transparent_70%)]" />
            
            <div className="relative w-48 h-48 min-[1080px]:w-56 min-[1080px]:h-56 flex items-center justify-center">
              <div className="absolute w-full h-full rounded-full border border-emerald-500/30" />
              <div className="absolute w-3/4 h-3/4 rounded-full border border-emerald-500/20" />
              <div className="absolute w-1/2 h-1/2 rounded-full border border-emerald-500/20" />
              <div className="absolute w-1/4 h-1/4 rounded-full border border-emerald-500/20" />
              
              <motion.div 
                animate={isLive ? { rotate: 360 } : { rotate: 0 }}
                transition={isLive ? { repeat: Infinity, duration: 3, ease: "linear" } : {}}
                className="absolute w-full h-full rounded-full"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(52, 211, 153, 0.4) 90deg, transparent 90deg)',
                  clipPath: 'circle(50%)'
                }}
              />
              
              <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
              
              <motion.div 
                animate={isLive ? { opacity: [0, 1, 0] } : { opacity: 0 }} 
                transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
                className="absolute top-8 right-10 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]" 
              />
              <motion.div 
                animate={isLive ? { opacity: [0, 1, 0] } : { opacity: 0 }} 
                transition={{ repeat: Infinity, duration: 2, delay: 1.2 }}
                className="absolute bottom-12 left-6 w-1.5 h-1.5 bg-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.8)]" 
              />
            </div>
            <p className="mt-6 text-xs text-emerald-500/60 font-bold tracking-widest uppercase flex items-center gap-2">
              <Crosshair className="w-3 h-3" /> {isLive ? 'Scanning for whales...' : 'Radar Paused'}
            </p>
          </div>

          {/* Live Feed - Changed h-[600px] to min-h-[600px] flex-1 to fill mobile space too */}
          <div className="min-[1080px]:col-span-2 bg-[#0a120e] border border-emerald-500/20 rounded-3xl overflow-hidden flex flex-col min-h-[600px] flex-1 min-[1080px]:h-full min-h-0">
            <div className="px-4 min-[1080px]:px-6 py-3 min-[1080px]:py-4 border-b border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 min-[1080px]:w-2 min-[1080px]:h-2 rounded-full ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                <h2 className="font-bold text-xs min-[1080px]:text-sm tracking-widest uppercase text-emerald-400">Live Feed</h2>
              </div>
              <span className="text-[9px] min-[1080px]:text-[10px] font-bold text-emerald-500/60 tracking-widest">
                {totalCount} TOTAL ENTRIES
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 min-[1080px]:p-4 space-y-2 min-[1080px]:space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full text-emerald-500/60 text-xs min-[1080px]:text-sm font-mono">Loading radar data...</div>
              ) : trades.length === 0 ? (
                <div className="flex items-center justify-center h-full text-emerald-500/60 text-xs min-[1080px]:text-sm font-mono">No whale activity found.</div>
              ) : (
                <>
                  {trades.map((trade) => (
                    <motion.div 
                      key={trade.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`flex items-center justify-between p-3 min-[1080px]:p-4 rounded-xl border ${
                        trade.action === 'BUY' 
                          ? 'bg-emerald-500/5 border-emerald-500/20' 
                          : 'bg-rose-500/5 border-rose-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-[1080px]:gap-4">
                        <div className={`w-8 h-8 min-[1080px]:w-10 min-[1080px]:h-10 rounded-lg flex items-center justify-center font-bold text-[10px] min-[1080px]:text-xs ${
                          trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {trade.action === 'BUY' ? 'B' : 'S'}
                        </div>
                        <div>
                          <p className="font-bold text-xs min-[1080px]:text-sm text-white">{trade.amount_sol.toFixed(2)} SOL</p>
                          <p className="text-[9px] min-[1080px]:text-[10px] text-white/40 font-mono">
                            {trade.wallet.slice(0, 4)}...{trade.wallet.slice(-4)} → {trade.token_mint.slice(0, 4)}...{trade.token_mint.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] min-[1080px]:text-[10px] text-emerald-500/60 font-bold">{formatTime(trade.timestamp)}</p>
                        <a href={`https://solscan.io/tx/${trade.sig}`} target="_blank" rel="noreferrer" className="text-[9px] min-[1080px]:text-[10px] text-emerald-400 hover:text-emerald-300 underline mt-1 inline-block">Solscan ↗</a>
                      </div>
                    </motion.div>
                  ))}
                  
                  {hasMore && (
                    <div className="pt-4 pb-2 flex justify-center">
                      <button 
                        onClick={() => setLimit(prev => prev + FETCH_LIMIT)}
                        className="flex items-center gap-2 px-4 min-[1080px]:px-6 py-2 rounded-xl text-[10px] min-[1080px]:text-xs font-bold uppercase tracking-widest border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 transition"
                      >
                        <ChevronDown className="w-3 h-3 min-[1080px]:w-4 min-[1080px]:h-4" /> Load More
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
