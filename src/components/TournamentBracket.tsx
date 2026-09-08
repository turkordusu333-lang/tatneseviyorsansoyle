import React from 'react';
import { Tournament, TournamentMatch, UserProfile } from '../types';
import { Trophy, Swords, Crown, Sparkles, User, CheckCircle2, Shield, Flame, ArrowRight, Zap, RefreshCw } from 'lucide-react';
import { sounds } from '../lib/SoundSystem';
import { t } from '../lib/TranslationSystem';

interface TournamentBracketProps {
  tournament: Tournament;
  profile: UserProfile;
  onPlayMatch: (tournamentId: string, matchId: string, opponentName: string, format?: string, botDifficulty?: string, targetSets?: number, turnDurationSeconds?: number) => void;
  onStartTournament: (tournamentId: string) => void;
}

export const TournamentBracket: React.FC<TournamentBracketProps> = ({
  tournament,
  profile,
  onPlayMatch,
  onStartTournament,
}) => {
  const isRegistered = tournament.status === 'active' || tournament.status === 'completed';
  const rounds = tournament.rounds || [];
  const isEn = profile?.settings?.language === 'en' || localStorage.getItem('language') === 'en';

  // Helper to get round title for any depth (up to 64 players)
  const getRoundTitle = (roundNum: number, totalRounds: number) => {
    const diffFromFinal = totalRounds - roundNum;
    if (diffFromFinal === 0) return tournament.format === '4player' ? (isEn ? '👑 Grand Final Table' : '👑 Büyük Final Masası') : t('grand_final', profile);
    if (diffFromFinal === 1) return tournament.format === '4player' ? (isEn ? '🥈 Semi-Final Tables' : '🥈 Yarı Final Masaları') : t('semi_final', profile);
    if (diffFromFinal === 2) return tournament.format === '4player' ? (isEn ? '🥉 Quarter-Final Tables' : '🥉 Çeyrek Final Masaları') : t('quarter_final', profile);
    if (diffFromFinal === 3) return isEn ? '⚡ Round of 16' : '⚡ Son 16 Turu';
    if (diffFromFinal === 4) return isEn ? '🔥 Round of 32' : '🔥 Son 32 Turu';
    if (diffFromFinal === 5) return isEn ? '⚔️ Round of 64' : '⚔️ Son 64 Turu';
    return t('round_n_title', profile, roundNum);
  };

  // Find user's active pending match
  const userActiveMatch = React.useMemo(() => {
    if (tournament.status !== 'active' || !rounds.length) return null;
    const currentRound = rounds[rounds.length - 1];
    if (!currentRound) return null;

    for (const m of currentRound.matches) {
      if (m.status === 'pending') {
        const isFormat4P = tournament.format === '4player';
        const isFormat2v2 = tournament.format === '2v2_team';

        if (isFormat4P) {
          const seats = m.tablePlayers || [m.player1, m.player2, m.player3 || '', m.player4 || ''];
          if (seats.some((s) => s === profile.username || s === 'Sen')) {
            return { match: m, opponentName: isEn ? 'Table Opponents' : 'Masa Rakipleri', roundNum: currentRound.roundNumber };
          }
        } else if (isFormat2v2) {
          const teamA = m.team1 || [m.player1, m.player3 || ''];
          const teamB = m.team2 || [m.player2, m.player4 || ''];
          if ([...teamA, ...teamB].some((s) => s === profile.username || s === 'Sen')) {
            return { match: m, opponentName: isEn ? 'Opponent Team' : 'Rakip Takım', roundNum: currentRound.roundNumber };
          }
        } else {
          const isP1Me = m.player1 === profile.username || m.player1 === 'Sen';
          const isP2Me = m.player2 === profile.username || m.player2 === 'Sen';
          if (isP1Me || isP2Me) {
            return { match: m, opponentName: isP1Me ? m.player2 : m.player1, roundNum: currentRound.roundNumber };
          }
        }
      }
    }
    return null;
  }, [rounds, tournament.status, tournament.format, profile.username, isEn]);

  const isUserChampion = tournament.status === 'completed' && (tournament.winner === profile.username || tournament.winner === 'Sen');
  const isUserEliminated = tournament.status === 'completed' && !isUserChampion;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Tournament Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_40px_rgba(99,102,241,0.15)]">
        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-extrabold text-[10px] uppercase tracking-widest shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {tournament.format === '4player'
                    ? (isEn ? '👥 4-PLAYER TABLE' : '👥 4 KİŞİLİK MASA')
                    : tournament.format === '2v2_team'
                    ? (isEn ? '⚔️ 2v2 TEAM CHAMPIONSHIP' : '⚔️ 2v2 TAKIM ŞAMPİYONASI')
                    : (isEn ? '🤺 1v1 OFFICIAL DUEL' : '🤺 1v1 RESMİ DÜELLO')}
                </span>
              </span>

              <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-bold text-[10px] uppercase tracking-widest">
                🤖 Bot: {tournament.botDifficulty === 'easy' ? (isEn ? 'Easy' : 'Kolay') : tournament.botDifficulty === 'hard' ? (isEn ? 'Hard' : 'Zor') : tournament.botDifficulty === 'expert' ? (isEn ? 'Expert' : 'Efsane') : (isEn ? 'Medium' : 'Orta')}
              </span>

              <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">
                🎯 {tournament.targetSets || 3} {isEn ? 'Sets' : 'Set'}
              </span>

              {tournament.status === 'registration' && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-extrabold text-[10px] uppercase tracking-widest">
                  {t('registrations_open', profile)}
                </span>
              )}
              {tournament.status === 'active' && (
                <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-extrabold text-[10px] uppercase tracking-widest animate-pulse">
                  {t('live_ongoing', profile)} ({isEn ? `Round ${rounds.length}` : `Tur ${rounds.length}`})
                </span>
              )}
              {tournament.status === 'completed' && (
                <span className={`px-3 py-1 rounded-full font-extrabold text-[10px] uppercase tracking-widest ${
                  isUserChampion ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}>
                  {isUserChampion ? (isEn ? '👑 CHAMPION' : '👑 ŞAMPİYON') : (isEn ? 'ELIMINATED' : 'ELENDİ')}
                </span>
              )}
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wide flex items-center gap-2">
              <span>{t(tournament.name, profile)}</span>
            </h2>

            <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
              {t(tournament.description, profile) || t('tournament_rules_desc', profile)}
            </p>
          </div>

          {/* Stats Badges */}
          <div className="flex flex-wrap md:flex-col gap-2 shrink-0 justify-start md:justify-end">
            <div className="bg-black/50 border border-amber-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                💰
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">{t('grand_prize_pool', profile)}</span>
                <span className="text-xs font-black text-amber-300 font-mono">
                  {tournament.prizeCoins ? `${tournament.prizeCoins.toLocaleString()} 🪙 + ${tournament.prizeXp} XP` : t('grand_prize_value', profile)}
                </span>
              </div>
            </div>

            <div className="bg-black/50 border border-indigo-500/30 rounded-2xl px-4 py-2.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                👥
              </div>
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase block">{isEn ? 'Participants & Entry' : 'Katılımcı & Giriş'}</span>
                <span className="text-xs font-black text-indigo-200 font-mono">
                  {tournament.entryFee ? `${tournament.entryFee} 🪙 ${isEn ? 'Entry' : 'Giriş'} | ` : (isEn ? 'Free | ' : 'Ücretsiz | ')}{tournament.maxParticipants || 8} {isEn ? 'Players' : 'Oyuncu'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Ready Match Next Round Action Banner */}
        {userActiveMatch && (
          <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-2 border-indigo-500/60 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-2xl shadow-inner">
                ⚔️
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">
                  {isEn ? `Round ${userActiveMatch.roundNum}` : `Tur ${userActiveMatch.roundNum}`}: {getRoundTitle(userActiveMatch.roundNum, rounds.length)}
                </span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <span>{isEn ? 'Opponent:' : 'Rakip:'}</span>
                  <span className="text-amber-300">{userActiveMatch.opponentName}</span>
                </h4>
                <p className="text-[11px] text-slate-300">
                  {tournament.format === '2v2_team'
                    ? (isEn ? 'Your team is ready! Lead your bot partner to victory.' : 'Takımınız hazır! Sadık bot partnerinizle birlikte zafere koşun.')
                    : (isEn ? 'Your match is ready! Click the button to start.' : 'Karşılaşmanız hazır! Başlamak için butona tıklayın.')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  sounds.playPlay(profile.settings);
                  onPlayMatch(
                    tournament.id,
                    userActiveMatch.match.id,
                    userActiveMatch.opponentName,
                    tournament.format,
                    tournament.botDifficulty,
                    tournament.targetSets,
                    tournament.turnDurationSeconds
                  );
                }}
                className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" />
                <span>⚔️ {isEn ? 'Play Match' : 'Maça Başla'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Action button if registration is open */}
        {tournament.status === 'registration' && (
          <div className="mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-300 font-medium">
              <span>
                {tournament.entryFee
                  ? (isEn ? `Tournament entry fee: ${tournament.entryFee} 🪙 Gold. ` : `Turnuva giriş ücreti: ${tournament.entryFee} 🪙 Altın. `)
                  : (isEn ? 'Free entry. ' : 'Katılım ücretsizdir. ')}
                {isEn ? 'The champion wins the grand prize!' : 'Şampiyon olan oyuncu büyük ödülü kazanır!'}
              </span>
            </div>

            <button
              onClick={() => {
                sounds.playCoin(profile.settings);
                onStartTournament(tournament.id);
              }}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-red-600/25 hover:shadow-red-600/40 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4" />
              <span>{tournament.entryFee ? (isEn ? `Start with ${tournament.entryFee}🪙` : `${tournament.entryFee}🪙 ile Başla`) : (isEn ? '🏆 Start Tournament' : '🏆 Turnuvaya Başla')}</span>
            </button>
          </div>
        )}
      </div>

      {/* Champion Podium View (If user won tournament) */}
      {isUserChampion && (
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
              {profile.username}
            </h3>
            <p className="text-xs text-amber-200/80 mt-1 font-bold">
              {isEn
                ? `Congratulations! You eliminated all opponents in the tournament and won ${tournament.prizeCoins?.toLocaleString()} 🪙 and ${tournament.prizeXp} XP!`
                : `Tebrikler! Turnuvadaki tüm rakipleri eleyerek ${tournament.prizeCoins?.toLocaleString()} 🪙 ve ${tournament.prizeXp} XP ödülü kazandınız!`}
            </p>
          </div>

          <div className="pt-4 flex justify-center">
            <span className="px-6 py-2.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-400/40 text-amber-300 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>{isEn ? '🏆 Championship Completed' : '🏆 Şampiyonluk Tamamlandı'}</span>
            </span>
          </div>
        </div>
      )}

      {/* Eliminated View (If user lost match) */}
      {isUserEliminated && (
        <div className="bg-gradient-to-br from-rose-950/40 via-red-950/20 to-slate-900 border-2 border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-3 shadow-xl relative overflow-hidden animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 mx-auto flex items-center justify-center text-3xl">
            ❌
          </div>
          <div>
            <h3 className="text-xl font-black text-rose-400 uppercase tracking-wider">
              Turnuvadan Elendiniz (Nakavt)
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Turnuva şampiyonu: <strong className="text-amber-300">{tournament.winner}</strong>. Nakavt sistemli bu turnuvada elendiğiniz için turnuva sizin için sona ermiştir.
            </p>
          </div>

          <div className="pt-2 flex justify-center">
            <span className="px-6 py-2.5 bg-rose-950/60 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl flex items-center gap-2 shadow-inner">
              <span>🔒</span>
              <span>Elendiniz — Turnuva Bitti</span>
            </span>
          </div>
        </div>
      )}

      {/* Interactive Bracket Tree View */}
      {rounds.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="text-sm font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
              <Swords className="w-4 h-4 text-rose-500" />
              <span>
                {tournament.format === '4player'
                  ? '👥 4 KİŞİLİK MASA EŞLEŞMELERİ'
                  : tournament.format === '2v2_team'
                  ? '⚔️ 2v2 TAKIM TURNUVA AĞACI'
                  : t('tournament_bracket_tree', profile)}
              </span>
            </h3>
          </div>

          {/* Bracket Rounds Container */}
          <div className={`grid grid-cols-1 ${rounds.length > 3 ? 'md:grid-cols-4' : (rounds.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3')} gap-6 items-stretch`}>
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
                      {round.matches.filter((m) => m.status === 'completed').length} / {round.matches.length} Tamamlandı
                    </span>
                  </div>

                  {/* Matches List */}
                  <div className="flex-1 flex flex-col justify-around gap-4">
                    {round.matches.map((match, mIdx) => {
                      const isFormat4P = tournament.format === '4player';
                      const isFormat2v2 = tournament.format === '2v2_team';

                      const tableSeats = isFormat4P
                        ? (match.tablePlayers || [match.player1, match.player2, match.player3 || '', match.player4 || ''])
                        : [];

                      const teamA = isFormat2v2 ? (match.team1 || [match.player1, match.player3 || '']) : [];
                      const teamB = isFormat2v2 ? (match.team2 || [match.player2, match.player4 || '']) : [];

                      const isUserInMatch = isFormat4P
                        ? tableSeats.some((s) => s === profile.username || s === 'Sen')
                        : isFormat2v2
                        ? [...teamA, ...teamB].some((s) => s === profile.username || s === 'Sen')
                        : (match.player1 === profile.username || match.player1 === 'Sen' || match.player2 === profile.username || match.player2 === 'Sen');

                      const opponentDisplayName = isFormat4P
                        ? 'Masa Rakipleri'
                        : isFormat2v2
                        ? 'Rakip Takım'
                        : (match.player1 === profile.username || match.player1 === 'Sen' ? match.player2 : match.player1);

                      const isPending = match.status === 'pending';
                      const isUserTurn = isUserInMatch && isPending && tournament.status === 'active';

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
                              {isFormat4P ? '🎮 MASANIZ HAZIR' : isFormat2v2 ? '⚔️ TAKIM MAÇI SIRASI' : t('your_match_turn', profile)}
                            </div>
                          )}

                          {/* 4-PLAYER TABLE LAYOUT */}
                          {isFormat4P ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                                  <span>👥</span>
                                  <span>{round.roundNumber === rounds.length ? 'Büyük Final Masası' : `Masa ${mIdx + 1}`}</span>
                                </span>
                                {match.winner && (
                                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    👑 Kazanan: {match.winner}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                {tableSeats.map((seatName, sIdx) => {
                                  const isMe = seatName === profile.username || seatName === 'Sen';
                                  const isWinner = match.winner === seatName;

                                  return (
                                    <div
                                      key={sIdx}
                                      className={`p-2 rounded-xl border flex items-center justify-between text-xs transition-all ${
                                        isWinner
                                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 font-black'
                                          : isMe
                                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-bold'
                                          : 'bg-black/30 border-white/5 text-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-[10px]">{isMe ? '👤' : '🤖'}</span>
                                        <span className="truncate">{isMe ? profile.username : seatName}</span>
                                      </div>
                                      {isWinner && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : isFormat2v2 ? (
                            /* 2V2 TEAM LAYOUT */
                            <div className="space-y-2.5">
                              {/* Team Blue */}
                              <div className="p-2.5 rounded-xl bg-blue-950/50 border border-blue-500/40 text-blue-200 space-y-1.5">
                                <div className="text-[10px] font-black text-blue-400 uppercase flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span>🔵</span>
                                    <span>Mavi Takım (2 Oyuncu)</span>
                                  </span>
                                  {match.winner && teamA.includes(match.winner) && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {teamA.map((name, i) => {
                                    const isMe = name === profile.username || name === 'Sen';
                                    return (
                                      <div
                                        key={i}
                                        className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 truncate ${
                                          isMe
                                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                            : 'bg-blue-900/30 border-blue-400/20 text-blue-100'
                                        }`}
                                      >
                                        <span className="text-[10px]">{isMe ? '👤' : '🤖'}</span>
                                        <span className="truncate">{isMe ? profile.username : name}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="text-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                ⚔️ TAKIMLAR ARASI DÜELLO ⚔️
                              </div>

                              {/* Team Red */}
                              <div className="p-2.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-200 space-y-1.5">
                                <div className="text-[10px] font-black text-rose-400 uppercase flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <span>🔴</span>
                                    <span>Kırmızı Takım (2 Oyuncu)</span>
                                  </span>
                                  {match.winner && teamB.includes(match.winner) && <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {teamB.map((name, i) => (
                                    <div
                                      key={i}
                                      className="p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 truncate bg-rose-900/30 border-rose-400/20 text-rose-100"
                                    >
                                      <span className="text-[10px]">🤖</span>
                                      <span className="truncate">{name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* 1V1 DUEL LAYOUT */
                            <>
                              {/* Player 1 Slot */}
                              <div className={`flex items-center justify-between p-2 rounded-xl transition-all ${
                                match.winner === match.player1 || (match.player1 === profile.username && match.winner === profile.username)
                                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-extrabold'
                                  : 'bg-black/30 border border-white/5 text-slate-300'
                              }`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs">
                                    {match.player1 === profile.username || match.player1 === 'Sen' ? '👤' : '🤖'}
                                  </span>
                                  <span className={`text-xs truncate ${match.player1 === profile.username || match.player1 === 'Sen' ? 'text-amber-300 font-black' : 'font-semibold'}`}>
                                    {match.player1 === profile.username || match.player1 === 'Sen' ? profile.username : match.player1}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                                  {match.score1 !== undefined && (
                                    <span className="font-bold">{match.score1}</span>
                                  )}
                                  {(match.winner === match.player1 || (match.player1 === profile.username && match.winner === profile.username)) && (
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
                                match.winner === match.player2 || (match.player2 === profile.username && match.winner === profile.username)
                                  ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-extrabold'
                                  : 'bg-black/30 border border-white/5 text-slate-300'
                              }`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs">
                                    {match.player2 === profile.username || match.player2 === 'Sen' ? '👤' : '🤖'}
                                  </span>
                                  <span className={`text-xs truncate ${match.player2 === profile.username || match.player2 === 'Sen' ? 'text-amber-300 font-black' : 'font-semibold'}`}>
                                    {match.player2 === profile.username || match.player2 === 'Sen' ? profile.username : match.player2}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 font-mono text-xs">
                                  {match.score2 !== undefined && (
                                    <span className="font-bold">{match.score2}</span>
                                  )}
                                  {(match.winner === match.player2 || (match.player2 === profile.username && match.winner === profile.username)) && (
                                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                          {/* Action Footer */}
                          <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                              {match.status === 'completed'
                                ? t('completed_title', profile)
                                : isUserTurn
                                ? t('your_turn_title', profile)
                                : 'Bekliyor'}
                            </span>

                            {isUserTurn && (
                              <button
                                onClick={() => {
                                  sounds.playPlay(profile.settings);
                                  onPlayMatch(
                                    tournament.id,
                                    match.id,
                                    opponentDisplayName,
                                    tournament.format,
                                    tournament.botDifficulty,
                                    tournament.targetSets,
                                    tournament.turnDurationSeconds
                                  );
                                }}
                                className="px-4 py-1.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                              >
                                <Swords className="w-3 h-3" />
                                <span>{isFormat4P ? '⚔️ Masaya Gir' : isFormat2v2 ? '⚔️ Takım Maçı' : t('play_match_btn', profile)}</span>
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
