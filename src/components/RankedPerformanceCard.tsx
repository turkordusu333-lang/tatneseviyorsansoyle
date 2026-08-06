import React from 'react';
import { UserProfile } from '../types';
import { getLeagueTier } from './MainMenu';
import { t } from '../lib/TranslationSystem';

interface Props {
  profile: UserProfile;
}

export const RankedPerformanceCard: React.FC<Props> = ({ profile }) => {
  const currentRp = profile.rankPoints ?? 1000;
  const currentMmr = profile.mmr ?? 1000;
  const league = getLeagueTier(currentRp);

  // Next tier threshold calculation
  const nextThreshold =
    currentRp >= 1500 ? 2000 :
    currentRp >= 1200 ? 1500 :
    currentRp >= 900 ? 1200 :
    currentRp >= 600 ? 900 :
    currentRp >= 300 ? 600 : 300;

  const prevThreshold =
    currentRp >= 1500 ? 1500 :
    currentRp >= 1200 ? 1200 :
    currentRp >= 900 ? 900 :
    currentRp >= 600 ? 600 :
    currentRp >= 300 ? 300 : 0;

  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round(((currentRp - prevThreshold) / (nextThreshold - prevThreshold)) * 100))
  );

  // Calculate average match score and placement history from gamesHistory
  const gamesHistory = profile.gamesHistory || [];
  const totalGames = profile.stats.gamesPlayed || gamesHistory.length || 1;
  const wonGames = profile.stats.gamesWon || gamesHistory.filter(g => g.result === 'won').length;

  // Approximate match scores from history or stats
  const totalScoreCalculated = gamesHistory.reduce((sum, g) => {
    const base = g.result === 'won' ? 1200 : 450;
    const bonus = (g.coinsEarned || 0) * 2 + (g.xpEarned || 0);
    return sum + base + bonus;
  }, 0);

  const avgMatchScore = gamesHistory.length > 0
    ? Math.round(totalScoreCalculated / gamesHistory.length)
    : Math.round((profile.stats.totalSetsCompleted * 500 + profile.stats.totalMoneyBanked * 10) / Math.max(1, totalGames));

  // Count simulated placement stats
  const firstCount = wonGames;
  const secondCount = Math.round((totalGames - wonGames) * 0.4);
  const thirdCount = Math.round((totalGames - wonGames) * 0.35);
  const fourthCount = Math.max(0, totalGames - firstCount - secondCount - thirdCount);

  return (
    <div id="ranked-performance-card" className="bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden space-y-6">
      {/* Background Ambient Glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">
              {t('ranked_perf_title', profile)}
            </span>
            <span className="text-xs text-slate-400 font-bold">
              {t('mmr_lbl', profile)} <span className="text-amber-300 font-mono font-black">{currentMmr}</span>
            </span>
          </div>
          <h3 className="text-xl font-extrabold text-white mt-1 flex items-center gap-2">
            <span>{league.icon}</span>
            <span>{league.name} {t('league_tier_lbl', profile)}</span>
          </h3>
        </div>

        {/* Current RP Badge */}
        <div className="flex items-center gap-3">
          <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-right">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('current_rank_lbl', profile)}</span>
            <span className="text-lg font-black text-amber-400 font-mono">{currentRp} RP</span>
          </div>
        </div>
      </div>

      {/* Progress to Next Tier */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs font-bold text-slate-300">
          <span>{t('tier_progress_lbl', profile, league.name)}</span>
          <span className="text-indigo-400 font-mono">{currentRp} / {nextThreshold} RP (%{progressPercent})</span>
        </div>
        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-white/10 p-0.5">
          <div
            className="bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 h-full rounded-full transition-all duration-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('avg_score_lbl', profile)}</span>
          <span className="text-lg font-black text-amber-300 font-mono mt-1 block">
            {avgMatchScore.toLocaleString(profile.settings?.language === 'en' ? 'en-US' : 'tr-TR')}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">{t('points_per_match_lbl', profile)}</span>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('victory_rate_lbl', profile)}</span>
          <span className="text-lg font-black text-emerald-400 font-mono mt-1 block">
            %{totalGames > 0 ? Math.round((wonGames / totalGames) * 100) : 0}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">{wonGames} {t('wins_word', profile)} / {totalGames} {t('matches_word', profile)}</span>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('collected_sets_lbl', profile)}</span>
          <span className="text-lg font-black text-indigo-300 font-mono mt-1 block">
            {profile.stats.totalSetsCompleted}
          </span>
          <span className="text-[9px] text-slate-500 font-medium">{t('completed_props_lbl', profile)}</span>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-xl p-3 text-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase block">{t('rent_collect_lbl', profile)}</span>
          <span className="text-lg font-black text-purple-300 font-mono mt-1 block">
            {profile.stats.totalRentCollected}M
          </span>
          <span className="text-[9px] text-slate-500 font-medium">{t('earned_cash_lbl', profile)}</span>
        </div>
      </div>

      {/* Placement Breakdown */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          {t('ranking_distribution_lbl', profile)}
        </span>
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-center">
            <span className="text-xs font-black text-amber-400 block">🥇 1. {t('rank_word', profile)}</span>
            <span className="text-base font-extrabold text-white font-mono mt-0.5 block">{firstCount}</span>
          </div>
          <div className="bg-slate-500/10 border border-slate-500/30 rounded-xl p-2.5 text-center">
            <span className="text-xs font-black text-slate-300 block">🥈 2. {t('rank_word', profile)}</span>
            <span className="text-base font-extrabold text-white font-mono mt-0.5 block">{secondCount}</span>
          </div>
          <div className="bg-amber-800/10 border border-amber-800/30 rounded-xl p-2.5 text-center">
            <span className="text-xs font-black text-amber-600 block">🥉 3. {t('rank_word', profile)}</span>
            <span className="text-base font-extrabold text-white font-mono mt-0.5 block">{thirdCount}</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-center">
            <span className="text-xs font-black text-rose-400 block">🏅 4. {t('rank_word', profile)}</span>
            <span className="text-base font-extrabold text-white font-mono mt-0.5 block">{fourthCount}</span>
          </div>
        </div>
      </div>

      {/* Recent Ranked Matches Timeline */}
      <div className="space-y-2">
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
          {t('recent_ranked_history_lbl', profile)}
        </span>
        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
          {gamesHistory.length > 0 ? (
            gamesHistory.slice(0, 5).map((game, idx) => (
              <div
                key={game.id || idx}
                className="bg-black/30 border border-white/5 rounded-xl p-2.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`px-2 py-0.5 rounded font-black text-[10px] uppercase ${
                    game.result === 'won' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}>
                    {game.result === 'won' ? `🥇 ${t('victory_word', profile)}` : `💔 ${t('defeat_word', profile)}`}
                  </span>
                  <span className="text-slate-300 font-semibold">{game.opponentName || 'Dereceli Rakip'}</span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-amber-400">+{game.coinsEarned}💰</span>
                  {game.rankPointsEarned !== undefined && (
                    <span className={`font-black ${game.rankPointsEarned >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {game.rankPointsEarned >= 0 ? `+${game.rankPointsEarned}` : game.rankPointsEarned} RP
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="bg-black/20 border border-white/5 rounded-xl p-4 text-center text-xs text-slate-500">
              {t('no_ranked_history_yet', profile)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
