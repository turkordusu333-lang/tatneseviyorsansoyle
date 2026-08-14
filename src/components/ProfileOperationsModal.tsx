import React from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { AvatarWithFrame } from './AvatarWithFrame';
import { sounds } from '../lib/SoundSystem';
import { API_BASE_URL } from '../lib/apiConfig';
import { COUNTRIES, getCountryByCode } from '../lib/countryData';
import { getLeagueTier } from './MainMenu';
import { STORE_ITEMS, AVATAR_EMOJIS } from './ShopDialog';

interface Props {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onClose: () => void;
  onOpenInventory?: () => void;
}

export const ProfileOperationsModal: React.FC<Props> = ({
  profile,
  onUpdateProfile,
  onClose,
  onOpenInventory,
}) => {
  const [activeTab, setActiveTab] = React.useState<'security' | 'profile' | 'stats'>('security');

  // Password state
  const [currentPasswordInput, setCurrentPasswordInput] = React.useState('');
  const [newPasswordInput, setNewPasswordInput] = React.useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = React.useState('');
  const [passwordMsg, setPasswordMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = React.useState(false);

  // Profile Edit state
  const [usernameInput, setUsernameInput] = React.useState(profile.username);
  const [countryInput, setCountryInput] = React.useState(profile.country || 'TR');
  const [customAvatarUrlInput, setCustomAvatarUrlInput] = React.useState(profile.avatarUrl || '');
  const [profileMsg, setProfileMsg] = React.useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Reset Code Simulation
  const [resetCode, setResetCode] = React.useState<string | null>(null);

  const hasExistingPassword = !!(profile.password && profile.password.trim() !== '');

  // Handle password submit (Add or Change)
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (hasExistingPassword) {
      if (currentPasswordInput.trim() !== profile.password) {
        setPasswordMsg({ type: 'error', text: 'Mevcut şifreniz hatalı!' });
        sounds.playAlert(profile.settings);
        return;
      }
    }

    if (!newPasswordInput || newPasswordInput.trim().length < 4) {
      setPasswordMsg({ type: 'error', text: 'Yeni şifre en az 4 karakter olmalıdır!' });
      sounds.playAlert(profile.settings);
      return;
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordMsg({ type: 'error', text: 'Yeni şifreler birbiriyle eşleşmiyor!' });
      sounds.playAlert(profile.settings);
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          password: newPasswordInput.trim(),
        }),
      });

      if (response.ok) {
        const updatedProfile = {
          ...profile,
          password: newPasswordInput.trim(),
        };
        onUpdateProfile(updatedProfile);
        setPasswordMsg({
          type: 'success',
          text: hasExistingPassword
            ? 'Şifreniz başarıyla güncellendi!'
            : 'Hesabınıza şifre başarıyla eklendi!',
        });
        setCurrentPasswordInput('');
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        sounds.playCoin(profile.settings);
      } else {
        const err = await response.json();
        setPasswordMsg({ type: 'error', text: err.error || 'Şifre güncellenirken hata oluştu.' });
        sounds.playAlert(profile.settings);
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: 'Sunucuyla iletişim kurulamadı.' });
      sounds.playAlert(profile.settings);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Handle Generate Password Reset Code
  const handleGenerateResetCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setResetCode(code);
    sounds.playPlay(profile.settings);
  };

  // Handle Profile Update (Username, Country, Custom Avatar)
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);

    const updated = {
      ...profile,
      username: usernameInput.trim() || profile.username,
      country: countryInput,
      avatarUrl: customAvatarUrlInput.trim() || undefined,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          country: countryInput,
          avatarUrl: customAvatarUrlInput.trim() || undefined,
        }),
      });

      if (response.ok) {
        onUpdateProfile(updated);
        setProfileMsg({ type: 'success', text: 'Profil bilgileriniz kaydedildi!' });
        sounds.playCoin(profile.settings);
      } else {
        setProfileMsg({ type: 'error', text: 'Profil güncellenemedi.' });
        sounds.playAlert(profile.settings);
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: 'Sunucu hatası oluştu.' });
      sounds.playAlert(profile.settings);
    }
  };

  const league = getLeagueTier(profile.rankPoints ?? 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-slate-900 border border-white/10 rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl text-left flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40 shrink-0">
          <div className="flex items-center gap-3">
            <AvatarWithFrame
              avatarId={profile.avatarId}
              avatarUrl={profile.avatarUrl}
              frameId={profile.settings.profileFrame || 'frame_none'}
              sizeClassName="w-12 h-12 text-2xl"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">{profile.username}</h3>
                <span className="text-base" title={getCountryByCode(profile.country).nameTr}>
                  {getCountryByCode(profile.country).flag}
                </span>
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${league.color}`}>
                  {league.icon} {league.name}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                LVL {profile.level} • {profile.coins} 💰 Altın • {profile.rankPoints ?? 0} RP
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              sounds.playPlay(profile.settings);
            }}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-400 hover:text-white transition-all text-sm font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex border-b border-white/10 bg-black/20 p-2 gap-2 shrink-0">
          <button
            onClick={() => {
              setActiveTab('security');
              sounds.playPlay(profile.settings);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-500'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            🔐 Şifre & Güvenlik
          </button>

          <button
            onClick={() => {
              setActiveTab('profile');
              sounds.playPlay(profile.settings);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-500'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            👤 Profil & Avatar
          </button>

          <button
            onClick={() => {
              setActiveTab('stats');
              sounds.playPlay(profile.settings);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'stats'
                ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 border border-red-500'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            📊 İstatistikler
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Security Status Banner */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between ${
                  hasExistingPassword
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{hasExistingPassword ? '🛡️' : '⚠️'}</span>
                  <div>
                    <h4 className="font-bold text-sm">
                      {hasExistingPassword ? 'Hesabınız Şifre İle Korunuyor' : 'Hesabınızda Şifre Tanımlı Değil'}
                    </h4>
                    <p className="text-xs opacity-80 mt-0.5">
                      {hasExistingPassword
                        ? 'Hesabınızın güvenliği aktif. Aşağıdan şifrenizi değiştirebilirsiniz.'
                        : 'Hesabınızı korumak ve diğer cihazlardan erişmek için bir şifre oluşturun.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Add / Change Password Form */}
              <form onSubmit={handlePasswordSubmit} className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-white/10 pb-3">
                  <span>🔑</span> {hasExistingPassword ? 'Şifre Değiştir' : 'Hesabına Şifre Ekle'}
                </h4>

                {hasExistingPassword && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Mevcut Şifre *
                    </label>
                    <input
                      type="password"
                      required
                      value={currentPasswordInput}
                      onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      {hasExistingPassword ? 'Yeni Şifre *' : 'Şifreniz *'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Şifreyi Doğrula *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={confirmPasswordInput}
                      onChange={(e) => setConfirmPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-mono"
                    />
                  </div>
                </div>

                {passwordMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    <span>{passwordMsg.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  {passwordLoading
                    ? 'Kaydediliyor...'
                    : hasExistingPassword
                    ? 'Şifreyi Güncelle'
                    : 'Şifreyi Kaydet'}
                </button>
              </form>

              {/* Password Reset Section */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>🔄</span> Şifre Sıfırlama Kodu
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Şifrenizi unuttuysanız veya başkasıyla hesabınızı paylaşmak istemiyorsanız, tek kullanımlık güvenlik kodu oluşturabilirsiniz.
                </p>

                {resetCode ? (
                  <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-center space-y-1">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block">Güvenlik Sıfırlama Kodunuz</span>
                    <span className="text-2xl font-mono font-black text-amber-300 tracking-widest">{resetCode}</span>
                    <p className="text-[11px] text-slate-300 mt-1">Bu kodu kaydedin. Şifrenizi sıfırlarken bu kodu kullanabilirsiniz.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGenerateResetCode}
                    className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    🎲 Güvenlik Sıfırlama Kodu Oluştur
                  </button>
                )}
              </div>

              {/* Account & Data Deletion (Google Play Compliance) */}
              <div className="bg-red-950/20 border border-red-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                  <span>🗑️</span>
                  <span>Hesap ve Veri Silme (Google Play Veri Güvenliği)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Deal Master PRO</strong> hesabınızı ve sunucularımızda saklanan tüm verilerinizi (oyun istatistikleri, mağaza envanteri, arkadaş listesi) dilediğiniz zaman kalıcı olarak silebilirsiniz.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm(`"${profile.username}" hesabınızı ve TÜM verilerinizi kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/user/delete-account-request`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              username: profile.username,
                              password: profile.password,
                              userId: profile.id,
                              reason: 'Uygulama içi kullanıcı isteği',
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(data.message || 'Hesabınız ve tüm verileriniz silindi.');
                            localStorage.clear();
                            window.location.reload();
                          } else {
                            alert('Hata: ' + (data.error || 'Hesap silinemedi.'));
                          }
                        } catch (err) {
                          alert('Sunucuyla iletişim kurulamadı.');
                        }
                      }
                    }}
                    className="px-4 py-2.5 bg-red-600/80 hover:bg-red-600 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    🗑️ Hesabımı ve Verilerimi Kalıcı Olarak Sil
                  </button>

                  <a
                    href="/delete-account"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5"
                  >
                    <span>🌐</span>
                    <span>Web Silme Bağlantısını Aç (/delete-account)</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <form onSubmit={handleProfileSave} className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
                <h4 className="font-bold text-white text-sm flex items-center gap-2 border-b border-white/10 pb-3">
                  <span>⚙️</span> Profil Bilgilerini Güncelle
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    required
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Ülke Seçimi 🌍
                  </label>
                  <select
                    value={countryInput}
                    onChange={(e) => setCountryInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 transition-all font-bold cursor-pointer"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                        {c.flag} {c.nameTr} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                {profileMsg && (
                  <div
                    className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                      profileMsg.type === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}
                  >
                    <span>{profileMsg.type === 'success' ? '✓' : '⚠️'}</span>
                    <span>{profileMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-red-600/20 cursor-pointer"
                >
                  Değişiklikleri Kaydet
                </button>
              </form>

              {/* Select from unlocked avatars */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-3">
                <h4 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>👑</span> Hazır Avatarlarım
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {Object.entries(AVATAR_EMOJIS).map(([avatarId, emoji]) => {
                    const isSelected = profile.avatarId === avatarId && !profile.avatarUrl;
                    return (
                      <button
                        key={avatarId}
                        type="button"
                        onClick={async () => {
                          const updated = {
                            ...profile,
                            avatarId,
                            avatarUrl: undefined,
                          };
                          onUpdateProfile(updated);
                          setCustomAvatarUrlInput('');
                          sounds.playCoin(profile.settings);
                          await fetch(`${API_BASE_URL}/api/settings/save`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ userId: profile.id, settings: { avatarId } }),
                          });
                        }}
                        className={`aspect-square rounded-2xl border-2 p-2 flex flex-col items-center justify-center text-2xl transition-all cursor-pointer ${
                          isSelected
                            ? 'border-red-500 bg-red-500/20 ring-2 ring-red-500/40'
                            : 'border-white/10 bg-black/40 hover:border-white/30'
                        }`}
                      >
                        <span>{emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-slate-200">{profile.stats.gamesPlayed}</span>
                  <p className="text-xs text-slate-400 mt-1">Toplam Maç</p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-red-500">{profile.stats.gamesWon}</span>
                  <p className="text-xs text-slate-400 mt-1">Galibiyet</p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-slate-500">{profile.stats.gamesLost}</span>
                  <p className="text-xs text-slate-400 mt-1">Mağlubiyet</p>
                </div>
                <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                  <span className="text-2xl font-black text-indigo-400">
                    {profile.stats.gamesPlayed > 0
                      ? Math.round((profile.stats.gamesWon / profile.stats.gamesPlayed) * 100)
                      : 0}%
                  </span>
                  <p className="text-xs text-slate-400 mt-1">Kazanma Oranı</p>
                </div>
              </div>

              {onOpenInventory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenInventory();
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-red-600/25 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🎒</span> Benim Envanterime Git
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
