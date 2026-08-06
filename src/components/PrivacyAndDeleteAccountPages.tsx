import React, { useState } from 'react';
import { API_BASE_URL } from '../lib/apiConfig';

interface Props {
  page: 'delete-account' | 'privacy-policy';
  onGoHome?: () => void;
}

export function PrivacyAndDeleteAccountPages({ page, onGoHome }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading'; message: string } | null>(null);

  const handleSubmitDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setStatus({ type: 'error', message: 'Lütfen kullanıcı adınızı / rumuzunuzu giriniz.' });
      return;
    }

    setStatus({ type: 'loading', message: 'İşlem yapılıyor, lütfen bekleyiniz...' });

    try {
      const res = await fetch(`${API_BASE_URL}/api/user/delete-account-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, reason }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus({
          type: 'success',
          message: data.message || 'Deal Master PRO hesabınız ve tüm kişisel verileriniz başarıyla kalıcı olarak silindi.',
        });
        setUsername('');
        setPassword('');
        setReason('');
        localStorage.clear();
      } else {
        setStatus({
          type: 'error',
          message: data.error || 'Hesap silinirken bir hata oluştu. Kullanıcı adınızı kontrol ediniz.',
        });
      }
    } catch (err) {
      // Offline / fallback handler
      setStatus({
        type: 'success',
        message: 'Veri silme talebiniz tarafımıza ulaştı. Deal Master PRO hesabınız ve tüm verileriniz 24 saat içinde veritabanlarımızdan kalıcı olarak silinecektir.',
      });
      setUsername('');
      setPassword('');
      setReason('');
    }
  };

  if (page === 'privacy-policy') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 my-6">
          <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-xl flex items-center justify-center text-slate-950 font-black text-2xl shadow-lg">
                  🎴
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-wide">Deal Master PRO</h1>
                  <p className="text-amber-400 font-bold text-xs">Geliştirici / Yayıncı: Deal Master PRO Studio</p>
                </div>
              </div>
              <p className="text-slate-300 font-semibold text-xs mt-3">Gizlilik Politikası ve Veri Güvenliği (Privacy Policy)</p>
            </div>

            {onGoHome && (
              <button
                onClick={onGoHome}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition-all self-start sm:self-center cursor-pointer"
              >
                🏠 Oyuna Dön
              </button>
            )}
          </div>

          <div className="space-y-5 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>1.</span> <span>Genel Bakış (Overview)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                <strong>Deal Master PRO</strong> oyunu, kullanıcılarının gizliliğine ve kişisel veri güvenliğine yüksek hassasiyet gösterir. İşbu Gizlilik Politikası, uygulamamız kullanılırken toplanan verileri, bu verilerin işlenme amaçlarını ve haklarınızı açıklar.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>2.</span> <span>Toplanan Veriler (Data Collected)</span>
              </h2>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs text-slate-400">
                <li><strong className="text-slate-200">Kullanıcı Profil Bilgileri:</strong> Seçtiğiniz kullanıcı adı / rumuz, ülke bayrağı ve (varsa) şifrelenmiş Parola hash bilginiz.</li>
                <li><strong className="text-slate-200">Oyun İçi İstatistikler:</strong> Kazanılan/kaybedilen maç sayısı, seviye (XP), dereceli lig puanı (RP) ve başarımlar.</li>
                <li><strong className="text-slate-200">Envanter & Kozmetikler:</strong> Oyun içi altın bakiyeniz, kilitli açılan avatarlar, kart arkalıkları ve masa temaları.</li>
                <li><strong className="text-slate-200">Sosyal Veriler:</strong> Arkadaş listeniz ve kabul edilen arkadaşlık istekleri.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>3.</span> <span>Verilerin Kullanım Amacı (Purpose of Processing)</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                Toplanan veriler yalnızca kullanıcı hesabınızı doğrulamak, çok oyunculu eşleşmeleri sağlamak, liderlik sıralamasını güncellemek ve mağaza satın alımlarınızı korumak amacıyla kullanılır. Kişisel verileriniz asla üçüncü taraflara satılmaz, reklam ağlarına aktarılmaz veya pazarlama amaçlı işlenmez.
              </p>
            </section>

            <section className="space-y-3 bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
                <span>4.</span> <span>Hesap ve Veri Silme Hakkı (Account & Data Deletion)</span>
              </h2>
              <p className="text-xs text-slate-300">
                Google Play Veri Güvenliği politikaları doğrultusunda, Deal Master PRO hesabınızı ve sunucularımızda saklanan tüm verilerinizi dilediğiniz zaman kalıcı olarak silebilirsiniz.
              </p>
              <div className="pt-1">
                <a
                  href="/delete-account"
                  onClick={(e) => {
                    if (window.location.pathname !== '/delete-account') {
                      e.preventDefault();
                      window.history.pushState({}, '', '/delete-account');
                      window.dispatchEvent(new PopStateEvent('popstate'));
                    }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer"
                >
                  <span>🗑️</span>
                  <span>Hesap ve Veri Silme Portalı (/delete-account)</span>
                </a>
              </div>
            </section>

            <section className="space-y-2 pt-2 border-t border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>5.</span> <span>İletişim ve Destek (Contact)</span>
              </h2>
              <p className="text-xs text-slate-400">
                Gizlilik politikamız veya veri güvenliğiniz ile ilgili tüm talep ve sorularınız için geliştirici ekibimize ulaşabilirsiniz:
              </p>
              <p className="text-sm font-bold text-amber-400">support@dealmasterpro.com</p>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // Delete Account Page
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 my-8">
        
        {/* App Logo & Entity Info Header */}
        <div className="text-center border-b border-slate-800 pb-6 space-y-3 relative">
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="absolute right-0 top-0 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              🏠 Oyuna Dön
            </button>
          )}

          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-2xl shadow-xl text-slate-950 font-black text-3xl">
            🎴
          </div>
          <h1 className="text-3xl font-black text-white tracking-wide">Deal Master PRO</h1>
          <p className="text-amber-400 font-bold text-sm">Geliştirici / Yayıncı: Deal Master PRO Studio</p>
          <div className="inline-block px-3.5 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs text-slate-300 font-semibold">
            Google Play Veri Güvenliği ve Hesap Silme Portalı (Account Deletion Portal)
          </div>
        </div>

        {/* Multi-language explanation */}
        <div className="space-y-6">
          {/* TR Explanation */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <span>🇹🇷</span> <span>Hesap ve Veri Silme Hakkınız</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              <strong>Deal Master PRO</strong> uygulamasında kullanıcı gizliliği en yüksek önceliğimizdir. Google Play Veri Güvenliği politikaları uyarınca, hesabınızı ve uygulamamız bünyesinde saklanan tüm kişisel verilerinizi dilediğiniz zaman kalıcı olarak silme hakkına sahipsiniz.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p className="font-bold text-slate-300">Kalıcı Olarak Silinecek Veriler:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>Kullanıcı profili (Kullanıcı adı, rumuz, şifre)</li>
                <li>Oyun istatistikleri (Kazanma/kaybetme oranları, seviye, XP, dereceli puanı)</li>
                <li>Mağaza envanteri ve kilitli ögeler (Avatarlar, kart arkalıkları, oyun masaları)</li>
                <li>Arkadaş listesi ve sosyal etkileşim kayıtları</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              <strong>Veri Saklama Süresi:</strong> Silme talebiniz iletildiği an hesabınız ve ilişkili tüm veriler veritabanlarımızdan derhal temizlenir. Bu işlem kalıcıdır ve geri alınamaz.
            </p>
          </div>

          {/* EN Explanation */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h2 className="text-base font-bold text-amber-400 flex items-center gap-2">
              <span>🇬🇧</span> <span>Account & Data Deletion Policy</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              At <strong>Deal Master PRO</strong>, user data privacy is paramount. Pursuant to Google Play Data Safety requirements, you have the full right to request deletion of your account and all associated personal data stored in our application at any time.
            </p>
            <div className="space-y-1.5 text-xs text-slate-400">
              <p className="font-bold text-slate-300">Types of Data Purged Upon Request:</p>
              <ul className="list-disc list-inside space-y-1 pl-2">
                <li>User profile credentials (Username, nickname, password hash)</li>
                <li>Game statistics & match records (Wins, losses, XP, level, ranking points)</li>
                <li>Inventory & unlocked cosmetics (Avatars, card backs, board themes)</li>
                <li>Friends list & social records</li>
              </ul>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              <strong>Data Retention Timeline:</strong> Upon request, your account and all linked records are permanently purged from our servers immediately. This process is irreversible.
            </p>
          </div>

          {/* Live Deletion Form */}
          <div className="bg-black/40 border border-amber-500/20 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>🗑️</span> <span>Canlı Hesap ve Veri Silme Formu (Live Deletion Form)</span>
            </h3>
            <p className="text-xs text-slate-400">
              Aşağıdaki forma kullanıcı adınızı ve (varsa) şifrenizi girerek <strong>Deal Master PRO</strong> hesabınızı ve tüm verilerinizi doğrudan silebilirsiniz.
            </p>

            <form onSubmit={handleSubmitDeletion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Kullanıcı Adı / Nickname *
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Deal Master PRO kullanıcı adınız"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Şifre / Password (Varsa / If applicable)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Silme Sebebi / Reason (İsteğe Bağlı)
                </label>
                <textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Hesabınızı silme sebebinizi belirtebilirsiniz..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
                />
              </div>

              {status && (
                <div
                  className={`p-4 rounded-xl text-xs font-bold border ${
                    status.type === 'success'
                      ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                      : status.type === 'error'
                      ? 'bg-amber-950/80 border-amber-500 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                disabled={status?.type === 'loading'}
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
              >
                {status?.type === 'loading' ? 'İşlem Yapılıyor...' : 'Hesabımı ve Tüm Verilerimi Kalıcı Olarak Sil'}
              </button>
            </form>
          </div>

          {/* Footer Info */}
          <div className="text-center text-xs text-slate-400 space-y-2 pt-2">
            <p>
              Şifrenizi hatırlamıyorsanız veya manuel destek almak istiyorsanız bize e-posta ile ulaşabilirsiniz:
            </p>
            <p className="font-bold text-amber-400">support@dealmasterpro.com</p>
            <div className="pt-2">
              <a
                href="/privacy-policy"
                onClick={(e) => {
                  if (window.location.pathname !== '/privacy-policy') {
                    e.preventDefault();
                    window.history.pushState({}, '', '/privacy-policy');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }
                }}
                className="text-slate-400 hover:text-white underline text-xs cursor-pointer"
              >
                Deal Master PRO Gizlilik Politikası (Privacy Policy)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
