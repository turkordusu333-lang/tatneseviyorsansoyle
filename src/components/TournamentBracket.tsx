import React from 'react';
import { Tournament, TournamentMatch, UserProfile } from '../types';
import { Trophy, Swords, Crown, Sparkles, User, CheckCircle2, Shield, Flame, ArrowRight, Zap } from 'lucide-react';
import { sounds } from '../lib/SoundSystem';
import { t } from '../lib/TranslationSystem';

interface TournamentBracketProps {
  tournament: Tournament;
  profile: UserProfile;
  onPlayMatch: (tournamentId: string, matchId: string, opponentName: string) => void;
  onJoinTournament: (tournamentId: string) => void;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({
  tournament,
  profile,
  onPlayMatch,
  onJoinTournament,
}) => {
  const isUserRegistered = tournament.participants.includes(profile.username);
  const rounds = tournament.rounds || [];

  // Helper to get round title
  const getRoundTitle = (roundNum: number, totalRounds: number) => {
    if (roundNum === totalRounds) return t('grand_final', profile);
    if (roundNum === totalRounds - 1) return t('semi_final', profile);
    if (roundNum === 1) return t('quarter_final', profile);
    return t('round_n_title', profile, roundNum);
  };

  const totalRounds = rounds.length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tournament Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] uppercase tracking-widest shadow-sm">
                <Trophy className="w-3.5 h-3.5" />
                <span>{t('official_elim_tournament', profile)}</span>
              </span>

              {tournament.status === 'registration' && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest">
                  {t('registrations_open', profile)}
                </span>
              )}
              {tournament.status === 'active' && (
                <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-extrabold text-[10px] uppercase tracking-widest animate-pulse">
                  {t('live_ongoing', profile)}
                </span>
              )}
              {tournament.status === 'completed' && (
                <span className="px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 font-extrabold text-[10px] uppercase tracking-widest">
                  {t('completed_word', profile)}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide flex items-center gap-2">
              <span>{tournament.name}</span>
            </h2>

            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              {t('tournament_rules_desc', profile)}
            </p>
          </div>

          {/* Stats Badges */}
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0 justify-start md:justify-end">
            <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                💰
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('grand_prize_pool', profile)}</span>
                <span className="text-xs font-black text-amber-300 font-mono">{t('grand_prize_value', profile)}</span>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                👥
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('participants_count', profile)}</span>
                <span className="text-xs font-black text-indigo-200 font-mono">
                  {t('participants_limit', profile, tournament.participants?.length || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action button if registration is open */}
        {tournament.status === 'registration' && (
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300 font-medium">
              {!isUserRegistered
                ? t('tournament_reg_info', profile)
                : t('tournament_reg_joined_info', profile)}
            </div>

            <button
              onClick={() => {
                sounds.playCoin(profile.settings);
                onJoinTournament(tournament.id);
              }}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>{isUserRegistered ? t('start_tournament_bracket', profile) : t('join_register_tournament', profile)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Champion Podium View (If tournament completed) */}
      {tournament.status === 'completed' && tournament.winner && (
        <div className="bg-gradient-to-br from-amber-950/40 via-yellow-950/20 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative overflow-hidden animate-fadeIn">
          <div className="inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 px-4 py-1.5 rounded-full text-amber-300 font-black text-xs uppercase tracking-widest">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>{t('tournament_champion_crowned', profile)}</span>
          </div>

          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            <div className="absolute inset-0 bg-amber-500/20 rounded-full animate-ping opacity-75" />
            <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-400 rounded-full flex items-center justify-center text-4xl shadow-inner">
              👑
            </div>
          </div>

          <div>
            <h3 className="text-3xl font-black text-amber-300 uppercase tracking-wider">
              {tournament.winner}
            </h3>
            <p className="text-xs text-amber-200/80 mt-1 font-bold">
              {tournament.winner === profile.username
                ? t('tournament_congrats_win', profile)
                : t('tournament_champion_won_desc', profile, tournament.winner)}
            </p>
          </div>
        </div>
      )}

      {/* Interactive Bracket Tree View */}
      {rounds.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-500" />
              <span>{t('tournament_bracket_tree', profile)}</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {t('total_stages_count', profile, rounds.length)}
            </span>
          </div>

          {/* Bracket Rounds Container */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {rounds.map((round, rIdx) => {
              const isCurrentRound = round.matches.some((m) => m.status === 'pending');
              const roundTitle = getRoundTitle(round.roundNumber, rounds.length);

              return (
                <div key={round.roundNumber} className="flex flex-col space-y-4">
                  {/* Round Header */}
                  <div className={`p-3 rounded-2xl border text-center transition-all ${
                    isCurrentRound 
                      ? 'bg-indigo-950/50 border-indigo-500/50 text-indigo-300 shadow-md shadow-indigo-500/10'
                      : 'bg-black/40 border-white/10 text-slate-400'
                  }`}>
                    <span className="text-xs font-black uppercase tracking-wider block">
                      {roundTitle}
                    </span>
                    <span className="text-[9px] opacity-75 font-mono">
                      {t('matches_completed_of', profile, round.matches.filter((m) => m.status === 'completed').length, round.matches.length)}
                    </span>
                  </div>

                  {/* Matches List */}
                  <div className="flex-1 flex flex-col justify-around gap-4">
                    {round.matches.map((match) => {
                      const isUserMatch = match.player1 === profile.username || match.player2 === profile.username;
                      const opponentName = match.player1 === profile.username ? match.player2 : match.player1;
                      const isPending = match.status === 'pending';
                      const isUserTurn = isUserMatch && isPending;

                      return (
                        <div
                          key={match.id}
                          className={`relative rounded-2xl border p-4 transition-all duration-300 flex flex-col justify-between space-y-3 ${
                            isUserTurn
                              ? 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/80 border-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.3)] ring-2 ring-indigo-500/50 scale-[1.02]'
                              : match.status === 'completed'
                              ? 'bg-slate-900/50 border-white/10 opacity-90'
                              : 'bg-black/40 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {/* User Turn Indicator Pulse */}
                          {isUserTurn && (
                            <div className="absolute -top-2.5 inset-x-0 mx-auto w-fit bg-gradient-to-r from-rose-500 to-indigo-500 text-white font-black text-[9px] uppercase tracking-widest px-3 py-0.5 rounded-full shadow-md animate-pulse">
                              {t('your_match_turn', profile)}
                            </div>
                          )}

                          {/* Player 1 Slot */}
                          <div className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                            match.winner === match.player1
                              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-extrabold'
                              : 'bg-black/30 border border-white/5 text-slate-300'
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs">
                                {match.player1 === profile.username ? '👤' : '🤖'}
                              </span>
                              <span className={`text-xs truncate ${match.player1 === profile.username ? 'text-amber-300 font-black' : 'font-semibold'}`}>
                                {match.player1}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                              {match.score1 !== undefined && (
                                <span className="font-bold">{match.score1}</span>
                              )}
                              {match.winner === match.player1 && (
                                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              )}
                            </div>
                          </div>

                          {/* VS Divider */}
                          <div className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                            {t('vs_word', profile)}
                          </div>

                          {/* Player 2 Slot */}
                          <div className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                            match.winner === match.player2
                              ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-extrabold'
                              : 'bg-black/30 border border-white/5 text-slate-300'
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs">
                                {match.player2 === profile.username ? '👤' : '🤖'}
                              </span>
                              <span className={`text-xs truncate ${match.player2 === profile.username ? 'text-amber-300 font-black' : 'font-semibold'}`}>
                                {match.player2}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                              {match.score2 !== undefined && (
                                <span className="font-bold">{match.score2}</span>
                              )}
                              {match.winner === match.player2 && (
                                <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                              )}
                            </div>
                          </div>

                          {/* Action Footer */}
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                              {match.status === 'completed'
                                ? t('completed_title', profile)
                                : isUserTurn
                                ? t('your_turn_title', profile)
                                : t('simulating_title', profile)}
                            </span>

                            {isUserTurn && (
                              <button
                                onClick={() => {
                                  sounds.playPlay(profile.settings);
                                  onPlayMatch(tournament.id, match.id, opponentName);
                                }}
                                className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Swords className="w-3 h-3" />
                                <span>{t('play_match_btn', profile)}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
