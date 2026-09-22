import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../lib/apiConfig';
import { StoreItem } from '../types';
import { HlsVideoPlayer, isVideoUrl } from './HlsVideoPlayer';

interface Quest {
  id: string;
  description: string;
  targetValue: number;
  rewardCoins: number;
  rewardXp: number;
}

interface Player {
  id: string;
  username: string;
  discordId?: string;
  avatarUrl?: string;
  level: number;
  xp: number;
  coins: number;
  gamesWon: number;
  gamesPlayed: number;
  friendsCount: number;
  isDiscord?: boolean;
  isGuest?: boolean;
}

interface AdminSettings {
  enable3DCardFlip: boolean;
  enablePropertySetGlow: boolean;
  enableFloatingEmojis: boolean;
  enableCoinFlyEffect: boolean;
  enableBuildingSmoke: boolean;
  enableHoverCardSidebar: boolean;
  enableUndoInTraining: boolean;
  questsEnabled: boolean;
  codexTabEnabled: boolean;
  rankedLeagueEnabled: boolean;
  turnTimeoutSeconds: number;
  actionTimeoutSeconds: number;
  targetSets: number;
  turnActionLimit: number;
  goldMultiplier: number;
  maintenanceMode: boolean;
  enableSystemVoiceovers: boolean;
  bonusTimePerActionSeconds?: number;
  botPracticeRewardsEnabled?: boolean;
  botMultiplayerRewardMultiplier?: number;
  matchmakingEnabled?: boolean;
  matchmakingEntryFee?: number;
  matchmakingWinnerShare?: number;
  matchmakingTimeSec?: number;
  rankedTurnDuration?: number;
  rankedCompleteSetWeight?: number;
  rankedIncompletePropWeight?: number;
  rankedBankCashWeight?: number;
  rankedSoloQueueOnly?: boolean;
  rankedAnonymity?: boolean;
  normalHandCardSize?: number;
  compactHandCardSize?: number;
  wheelEnabled?: boolean;
  wheelCooldownMinutes?: number;
  wheelAdDurationSeconds?: number;
  wheelReward1?: number;
  wheelReward2?: number;
  wheelReward3?: number;
  wheelReward4?: number;
  wheelReward5?: number;
  wheelReward6?: number;
  wheelAdMobAndroidAdUnitId?: string;
  wheelAdMobiOSAdUnitId?: string;
  wheelAdMobTestingMode?: boolean;
  rewardedAdCoinAmount?: number;
  bannerAdMobEnabled?: boolean;
  bannerAdMobAndroidAdUnitId?: string;
  bannerAdMobiOSAdUnitId?: string;
  bannerAdMobTestingMode?: boolean;
  adSenseEnabled?: boolean;
  adSenseClientId?: string;
  adSenseBannerSlotId?: string;
}

interface Stats {
  supabaseStatus: string;
  supabaseRowCount: number;
  totalUsersInMemory: number;
  activeRooms: number;
  activeTournamentsCount: number;
  uptimeSeconds: number;
}

interface Props {
  onSettingsUpdated?: (newSettings: AdminSettings) => void;
  onLogout?: () => void;
}

export const getAdminHeaders = (extra: Record<string, string> = {}) => {
  const token = localStorage.getItem('deal_master_admin_token') || 'deal-master-admin-token-2026-auth';
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra
  };
};

export const getAdminAuthHeader = () => {
  const token = localStorage.getItem('deal_master_admin_token') || 'deal-master-admin-token-2026-auth';
  return {
    'Authorization': `Bearer ${token}`
  };
};

export const AdminDashboard: React.FC<Props> = ({ onSettingsUpdated, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'rules' | 'security' | 'players' | 'quests' | 'achievements' | 'tournaments' | 'translations' | 'voices' | 'shop'>('analytics');

  // Password Change state
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeMsg, setPasswordChangeMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleChangeAdminPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeMsg(null);

    if (!currentAdminPassword.trim()) {
      setPasswordChangeMsg({ type: 'error', text: 'Lütfen mevcut yönetici şifrenizi giriniz.' });
      return;
    }
    if (!newAdminPassword.trim()) {
      setPasswordChangeMsg({ type: 'error', text: 'Lütfen yeni yönetici şifrenizi giriniz.' });
      return;
    }
    if (newAdminPassword.trim().length < 4) {
      setPasswordChangeMsg({ type: 'error', text: 'Yeni şifre en az 4 karakter olmalıdır.' });
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      setPasswordChangeMsg({ type: 'error', text: 'Yeni şifreler birbiriyle eşleşmiyor!' });
      return;
    }

    setPasswordChangeLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/change-password`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          currentPassword: currentAdminPassword.trim(),
          newPassword: newAdminPassword.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordChangeMsg({ type: 'success', text: 'Yönetici şifreniz başarıyla güncellendi!' });
        setNotification({ message: 'Yönetici şifreniz başarıyla güncellendi!', type: 'success' });
        setCurrentAdminPassword('');
        setNewAdminPassword('');
        setConfirmAdminPassword('');
      } else {
        setPasswordChangeMsg({ type: 'error', text: data.error || 'Şifre değiştirilemedi.' });
      }
    } catch (err) {
      console.error(err);
      setPasswordChangeMsg({ type: 'error', text: 'Sunucuyla bağlantı kurulamadı.' });
    } finally {
      setPasswordChangeLoading(false);
    }
  };
  const [settings, setSettings] = useState<AdminSettings>({
    enable3DCardFlip: true,
    enablePropertySetGlow: true,
    enableFloatingEmojis: true,
    enableCoinFlyEffect: true,
    enableBuildingSmoke: true,
    enableHoverCardSidebar: true,
    enableUndoInTraining: true,
    questsEnabled: true,
    codexTabEnabled: true,
    rankedLeagueEnabled: true,
    turnTimeoutSeconds: 35,
    actionTimeoutSeconds: 20,
    targetSets: 3,
    turnActionLimit: 3,
    goldMultiplier: 1.0,
    maintenanceMode: false,
    enableSystemVoiceovers: true,
    bonusTimePerActionSeconds: 10,
    botPracticeRewardsEnabled: false,
    botMultiplayerRewardMultiplier: 0.5,
    matchmakingEnabled: true,
    matchmakingEntryFee: 100,
    matchmakingWinnerShare: 80,
    matchmakingTimeSec: 10,
    rankedTurnDuration: 15,
    rankedCompleteSetWeight: 50,
    rankedIncompletePropWeight: 2,
    rankedBankCashWeight: 1,
    rankedSoloQueueOnly: true,
    rankedAnonymity: true,
    wheelEnabled: true,
    wheelCooldownMinutes: 60,
    wheelAdDurationSeconds: 8,
    wheelReward1: 50,
    wheelReward2: 100,
    wheelReward3: 200,
    wheelReward4: 500,
    wheelReward5: 1000,
    wheelReward6: 25,
    wheelAdMobAndroidAdUnitId: 'ca-app-pub-5045652074166668/6893680557',
    wheelAdMobiOSAdUnitId: '',
    wheelAdMobTestingMode: true,
    rewardedAdCoinAmount: 100,
    bannerAdMobEnabled: true,
    bannerAdMobAndroidAdUnitId: 'ca-app-pub-5045652074166668/1473978700',
    bannerAdMobiOSAdUnitId: '',
    bannerAdMobTestingMode: true,
    adSenseEnabled: true,
    adSenseClientId: 'ca-pub-5045652074166668',
    adSenseBannerSlotId: ''
  });

  const [stats, setStats] = useState<Stats>({
    supabaseStatus: 'loading',
    supabaseRowCount: 0,
    totalUsersInMemory: 0,
    activeRooms: 0,
    activeTournamentsCount: 0,
    uptimeSeconds: 0
  });

  const [players, setPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [editCoins, setEditCoins] = useState(0);
  const [editLevel, setEditLevel] = useState(1);
  const [editXp, setEditXp] = useState(0);

  // New Player Creation State (Server Database)
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [newPlayerUsername, setNewPlayerUsername] = useState('');
  const [newPlayerCoins, setNewPlayerCoins] = useState(1000);
  const [newPlayerLevel, setNewPlayerLevel] = useState(1);
  const [newPlayerXp, setNewPlayerXp] = useState(0);
  const [newPlayerDiscordId, setNewPlayerDiscordId] = useState('');

  // Local Accounts (Browser Storage / LocalStorage)
  const [localAccounts, setLocalAccounts] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('mono_deal_saved_accounts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [newLocalUsername, setNewLocalUsername] = useState('');

  const [quests, setQuests] = useState<any[]>([]);
  const [newQuestDesc, setNewQuestDesc] = useState('');
  const [newQuestTarget, setNewQuestTarget] = useState(3);
  const [newQuestCoins, setNewQuestCoins] = useState(50);
  const [newQuestXp, setNewQuestXp] = useState(40);
  const [newQuestType, setNewQuestType] = useState('games_played');

  const [achievements, setAchievements] = useState<any[]>([]);
  const [newAchTitle, setNewAchTitle] = useState('');
  const [newAchDesc, setNewAchDesc] = useState('');
  const [newAchTarget, setNewAchTarget] = useState(5);
  const [newAchCoins, setNewAchCoins] = useState(150);
  const [newAchType, setNewAchType] = useState('games_played');

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [tournamentName, setTournamentName] = useState('');
  const [tournamentDescription, setTournamentDescription] = useState('');
  const [tournamentFormat, setTournamentFormat] = useState<'1v1' | '4player' | '2v2_team'>('1v1');
  const [tournamentBotDifficulty, setTournamentBotDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('medium');
  const [tournamentMaxParticipants, setTournamentMaxParticipants] = useState<number>(8);
  const [tournamentAllowBots, setTournamentAllowBots] = useState<boolean>(true);
  const [tournamentEntryFee, setTournamentEntryFee] = useState<number>(100);
  const [tournamentPrizeCoins, setTournamentPrizeCoins] = useState<number>(1000);
  const [tournamentPrizeXp, setTournamentPrizeXp] = useState<number>(300);
  const [tournamentTargetSets, setTournamentTargetSets] = useState<number>(3);
  const [tournamentTurnDuration, setTournamentTurnDuration] = useState<number>(30);
  const [tournamentTier, setTournamentTier] = useState<'bronze' | 'silver' | 'gold' | 'legend'>('gold');
  const [tournamentStatus, setTournamentStatus] = useState<'registration' | 'active'>('registration');
  const [tournamentPlayers, setTournamentPlayers] = useState('');

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Translation editing states
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({});
  const [editingLang, setEditingLang] = useState<string>('tr');
  const [newLangCode, setNewLangCode] = useState<string>('');
  const [newKeyName, setNewKeyName] = useState<string>('');
  const [newKeyDefaultVal, setNewKeyDefaultVal] = useState<string>('');
  const [transSearch, setTransSearch] = useState<string>('');

  interface VoiceItem {
    id: string;
    name: string;
    filename: string;
    scope?: 'global' | 'duel' | 'actor';
    trExists: boolean;
    enExists: boolean;
  }

  const defaultVoiceList: VoiceItem[] = [
    { id: 'place_bank', name: 'Bankaya Para Koyma', filename: 'place_bank.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'place_property', name: 'Mülk/Arazi Yerleştirme', filename: 'place_property.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'play_passgo', name: 'Çizgiden Geç (Pass & Go)', filename: 'play_passgo.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'play_birthday', name: 'Doğum Günü Kartı', filename: 'play_birthday.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'play_debt', name: 'Haciz / Borç Tahsildarı', filename: 'play_debt.mp3', scope: 'duel', trExists: false, enExists: false },
    { id: 'play_sly', name: 'Sinsi Anlaşma', filename: 'play_sly.mp3', scope: 'duel', trExists: false, enExists: false },
    { id: 'play_dealbreaker', name: 'Anlaşma Bozan', filename: 'play_dealbreaker.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'play_forced', name: 'Zoraki Takas', filename: 'play_forced.mp3', scope: 'duel', trExists: false, enExists: false },
    { id: 'play_double', name: 'Çift Kira', filename: 'play_double.mp3', scope: 'duel', trExists: false, enExists: false },
    { id: 'play_rent', name: 'Kira Kartı', filename: 'play_rent.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'play_jsn', name: 'Hayır Teşekkürler (JSN)', filename: 'play_jsn.mp3', scope: 'duel', trExists: false, enExists: false },
    { id: 'play_action', name: 'Diğer Aksiyon Kartları', filename: 'play_action.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'game_start', name: 'Oyun Başlangıcı (Start)', filename: 'game_start.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'your_turn', name: 'Sıra Sende Splash', filename: 'your_turn.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'end_turn', name: 'Turu Sonlandırma', filename: 'end_turn.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'set_completed', name: 'Mülk Seti Tamamlama', filename: 'set_completed.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'build_house', name: 'Ev İnşa Etme', filename: 'build_house.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'build_hotel', name: 'Otel İnşa Etme', filename: 'build_hotel.mp3', scope: 'actor', trExists: false, enExists: false },
    { id: 'bankruptcy', name: 'İflas Olayı (Bankruptcy)', filename: 'bankruptcy.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'victory', name: 'Kazanma / Zafer', filename: 'victory.mp3', scope: 'global', trExists: false, enExists: false },
    { id: 'defeat', name: 'Kaybetme / Yenilgi', filename: 'defeat.mp3', scope: 'global', trExists: false, enExists: false },
  ];

  const [voices, setVoices] = useState<VoiceItem[]>(defaultVoiceList);
  const [uploadLoading, setUploadLoading] = useState<string | null>(null);

  const fetchVoiceList = () => {
    fetch(`${API_BASE_URL}/api/admin/voice-list`, {
      headers: getAdminHeaders()
    })
      .then((res) => {
        if (!res.ok) throw new Error('API not available yet');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setVoices(data);
        } else {
          setVoices(defaultVoiceList);
        }
      })
      .catch((err) => {
        console.warn('Voice list API not running, using fallback:', err);
        setVoices(defaultVoiceList);
      });
  };

  const handleUploadVoice = (e: React.ChangeEvent<HTMLInputElement>, item: VoiceItem, lang: 'tr' | 'en') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.mp3')) {
      alert('Lütfen yalnızca .mp3 formatında ses dosyası yükleyin.');
      return;
    }

    setUploadLoading(`${item.id}_${lang}`);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64Data = reader.result as string;

      fetch(`${API_BASE_URL}/api/admin/upload-voice`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          lang,
          filename: item.filename,
          base64Data
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            fetchVoiceList();
            setNotification({ message: `${item.name} ses dosyası başarıyla yüklendi!`, type: 'success' });
          } else {
            alert('Yükleme başarısız: ' + (data.error || 'Bilinmeyen hata'));
          }
        })
        .catch((err) => {
          console.error('Upload voice error:', err);
          alert('Dosya yüklenirken ağ hatası oluştu.');
        })
        .finally(() => {
          setUploadLoading(null);
        });
    };
  };

  const playPreview = (filename: string, lang: 'tr' | 'en') => {
    const audioUrl = `${API_BASE_URL}/assets/sounds/voices/${lang}/${filename}?t=${Date.now()}`;
    const audio = new Audio(audioUrl);
    audio.volume = 0.8;
    audio.onerror = () => {
      setNotification({ message: `"${filename}" ses dosyası henüz yüklenmemiş veya sunucuda bulunamadı.`, type: 'error' });
    };
    audio.play().catch(() => {
      // Ignore autoplay deferred errors
    });
  };

  // Shop management state
  const [shopItems, setShopItems] = useState<StoreItem[]>([]);
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>('all');
  const [shopSearch, setShopSearch] = useState<string>('');
  const [isShopModalOpen, setIsShopModalOpen] = useState<boolean>(false);
  const [editingShopItem, setEditingShopItem] = useState<StoreItem | null>(null);
  const [shopModalTab, setShopModalTab] = useState<'basic' | 'design' | 'media' | 'locks'>('basic');
  const [isPlayingShopAudio, setIsPlayingShopAudio] = useState<boolean>(false);
  const [shopAudioPlayer, setShopAudioPlayer] = useState<HTMLAudioElement | null>(null);

  const [shopForm, setShopForm] = useState<{
    name: string;
    category: StoreItem['category'];
    price: number;
    description: string;
    mediaType: 'image' | 'gif' | 'video';
    mediaUrl: string;
    previewColor: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';
    overlayMode: 'normal' | 'overlay' | 'screen' | 'multiply' | 'color-dodge' | 'soft-light' | 'hard-light';
    overlayOpacity: number;
    glowColor: string;
    particleEffect: 'none' | 'sparkles' | 'fire' | 'snow' | 'matrix' | 'bubbles' | 'stars';
    discountPercent: number;
    // New Advanced Customizations
    gradientStart: string;
    gradientEnd: string;
    gradientDirection: 'to-r' | 'to-br' | 'to-b' | 'to-tr' | 'radial';
    borderStyle: 'solid' | 'gold_ornate' | 'cyber_dashed' | 'neon_glow' | 'fiery' | 'none';
    borderWidth: number;
    borderColor: string;
    animType: 'none' | 'pulse' | 'floating' | 'shimmer' | 'rainbow_wave' | 'spin_glow';
    badgeText: string;
    badgeColor: string;
    badgeBg: string;
    audioUrl: string;
    requiredLevel: number;
    requiredLeague: string;
    stockLimit: number | '';
  }>({
    name: '',
    category: 'avatar',
    price: 250,
    description: '',
    mediaType: 'image',
    mediaUrl: '',
    previewColor: '',
    rarity: 'common',
    overlayMode: 'normal',
    overlayOpacity: 0.5,
    glowColor: '#6366f1',
    particleEffect: 'none',
    discountPercent: 0,
    gradientStart: '',
    gradientEnd: '',
    gradientDirection: 'to-br',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#334155',
    animType: 'none',
    badgeText: '',
    badgeColor: '#ffffff',
    badgeBg: '#ef4444',
    audioUrl: '',
    requiredLevel: 0,
    requiredLeague: '',
    stockLimit: ''
  });
  const [shopMediaUploading, setShopMediaUploading] = useState<boolean>(false);

  const fetchShopItems = () => {
    fetch(`${API_BASE_URL}/api/shop/items`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setShopItems(data);
        }
      })
      .catch((err) => console.error('Error fetching shop items:', err));
  };

  const handleOpenAddShopModal = () => {
    setEditingShopItem(null);
    setShopModalTab('basic');
    setShopForm({
      name: '',
      category: 'avatar',
      price: 250,
      description: '',
      mediaType: 'image',
      mediaUrl: '',
      previewColor: '',
      rarity: 'common',
      overlayMode: 'normal',
      overlayOpacity: 0.5,
      glowColor: '#6366f1',
      particleEffect: 'none',
      discountPercent: 0,
      gradientStart: '',
      gradientEnd: '',
      gradientDirection: 'to-br',
      borderStyle: 'solid',
      borderWidth: 1,
      borderColor: '#334155',
      animType: 'none',
      badgeText: '',
      badgeColor: '#ffffff',
      badgeBg: '#ef4444',
      audioUrl: '',
      requiredLevel: 0,
      requiredLeague: '',
      stockLimit: ''
    });
    setIsShopModalOpen(true);
  };

  const handleOpenEditShopModal = (item: StoreItem) => {
    setEditingShopItem(item);
    setShopModalTab('basic');
    setShopForm({
      name: item.name,
      category: item.category,
      price: item.price,
      description: item.description || '',
      mediaType: item.mediaType || 'image',
      mediaUrl: item.mediaUrl || '',
      previewColor: item.previewColor || '',
      rarity: item.rarity || 'common',
      overlayMode: item.overlayMode || 'normal',
      overlayOpacity: item.overlayOpacity ?? 0.5,
      glowColor: item.glowColor || '#6366f1',
      particleEffect: item.particleEffect || 'none',
      discountPercent: item.discountPercent || 0,
      gradientStart: item.gradientStart || '',
      gradientEnd: item.gradientEnd || '',
      gradientDirection: item.gradientDirection || 'to-br',
      borderStyle: item.borderStyle || 'solid',
      borderWidth: item.borderWidth ?? 1,
      borderColor: item.borderColor || '#334155',
      animType: item.animType || 'none',
      badgeText: item.badgeText || '',
      badgeColor: item.badgeColor || '#ffffff',
      badgeBg: item.badgeBg || '#ef4444',
      audioUrl: item.audioUrl || '',
      requiredLevel: item.requiredLevel || 0,
      requiredLeague: item.requiredLeague || '',
      stockLimit: item.stockLimit !== undefined ? item.stockLimit : ''
    });
    setIsShopModalOpen(true);
  };

  const toggleShopAudioPreview = (url?: string) => {
    const targetUrl = url || shopForm.audioUrl;
    if (!targetUrl) return;

    if (isPlayingShopAudio && shopAudioPlayer) {
      shopAudioPlayer.pause();
      setIsPlayingShopAudio(false);
      return;
    }

    const fullUrl = targetUrl.startsWith('http') ? targetUrl : `${API_BASE_URL}${targetUrl}`;
    const audio = new Audio(fullUrl);
    audio.volume = 0.8;
    audio.onended = () => setIsPlayingShopAudio(false);
    audio.onerror = () => {
      setIsPlayingShopAudio(false);
      setNotification({ message: 'Ses dosyası oynatılamadı veya bulunamadı.', type: 'error' });
    };
    audio.play().then(() => {
      setShopAudioPlayer(audio);
      setIsPlayingShopAudio(true);
    }).catch(() => {
      setIsPlayingShopAudio(false);
    });
  };

  const handleSaveShopItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopForm.name.trim()) {
      setNotification({ message: 'Lütfen ürün adını giriniz.', type: 'error' });
      return;
    }

    const isVideo = isVideoUrl(shopForm.mediaUrl, shopForm.mediaType);
    const finalForm = {
      ...shopForm,
      mediaType: isVideo ? ('video' as const) : shopForm.mediaType,
      stockLimit: shopForm.stockLimit === '' ? undefined : Number(shopForm.stockLimit)
    };

    const endpoint = editingShopItem ? '/api/admin/shop/update' : '/api/admin/shop/add';
    const payload = editingShopItem ? { id: editingShopItem.id, ...finalForm } : finalForm;

    fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShopItems(data.items);
          setIsShopModalOpen(false);
          setNotification({
            message: editingShopItem ? 'Ürün başarıyla güncellendi!' : 'Yeni ürün başarıyla eklendi!',
            type: 'success'
          });
        } else {
          setNotification({ message: data.error || 'İşlem başarısız.', type: 'error' });
        }
      })
      .catch((err) => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası oluştu.', type: 'error' });
      });
  };

  const handleDeleteShopItem = (itemId: string, name: string) => {
    if (!window.confirm(`"${name}" ürününü mağazadan silmek istediğinize emin misiniz?`)) return;

    fetch(`${API_BASE_URL}/api/admin/shop/delete`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ itemId })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setShopItems(data.items);
          setNotification({ message: 'Ürün mağazadan silindi.', type: 'success' });
        } else {
          setNotification({ message: data.error || 'Silme hatası.', type: 'error' });
        }
      })
      .catch((err) => console.error(err));
  };

  const handleShopFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isAudioUpload = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      alert('Dosya boyutu çok yüksek! Lütfen 25MB altı bir dosya seçin.');
      return;
    }

    setShopMediaUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      fetch(`${API_BASE_URL}/api/admin/shop/upload-media`, {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          filename: file.name,
          base64Data
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            if (isAudioUpload || file.type.includes('audio') || file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg')) {
              setShopForm((prev) => ({
                ...prev,
                audioUrl: data.url
              }));
              setNotification({ message: 'Ses dosyası başarıyla yüklendi!', type: 'success' });
            } else {
              let autoType: 'image' | 'gif' | 'video' = 'image';
              if (file.type.includes('gif') || file.name.toLowerCase().endsWith('.gif')) autoType = 'gif';
              else if (file.type.includes('video') || isVideoUrl(file.name)) autoType = 'video';

              setShopForm((prev) => ({
                ...prev,
                mediaUrl: data.url,
                mediaType: autoType
              }));
              setNotification({ message: 'Medya dosyası başarıyla yüklendi!', type: 'success' });
            }
          } else {
            alert('Yükleme başarısız: ' + (data.error || 'Bilinmeyen hata'));
          }
        })
        .catch((err) => {
          console.error(err);
          alert('Yükleme hatası.');
        })
        .finally(() => {
          setShopMediaUploading(false);
        });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (activeTab === 'voices') {
      fetchVoiceList();
    } else if (activeTab === 'quests') {
      fetchQuests();
    } else if (activeTab === 'achievements') {
      fetchAchievements();
    } else if (activeTab === 'tournaments') {
      fetchTournaments();
    } else if (activeTab === 'shop') {
      fetchShopItems();
    }
  }, [activeTab]);

  // Auto-clear notification after 3 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load Initial Settings & Stats
  useEffect(() => {
    fetchSettings();
    fetchStats();
    fetchPlayers();
    fetchQuests();
    fetchAchievements();
    fetchTournaments();
    fetchTranslations();

    const interval = setInterval(fetchStats, 5000); // refresh stats every 5s
    return () => clearInterval(interval);
  }, []);

  const fetchTranslations = () => {
    fetch(`${API_BASE_URL}/api/translations`)
      .then(res => res.json())
      .then(data => {
        if (data) setTranslations(data);
      })
      .catch(err => console.error('Error fetching translations:', err));
  };

  const handleSaveTranslations = (updated = translations) => {
    fetch(`${API_BASE_URL}/api/translations/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ translations: updated })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTranslations(data.translations);
          setNotification({ message: 'Çeviriler başarıyla sunucuya kaydedildi!', type: 'success' });
        } else {
          setNotification({ message: 'Çeviriler kaydedilemedi.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası.', type: 'error' });
      });
  };

  const handleAddLanguage = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newLangCode.trim().toLowerCase();
    if (!code) return;
    if (translations[code]) {
      setNotification({ message: 'Bu dil kodu zaten mevcut!', type: 'error' });
      return;
    }
    // Clone tr baseline or empty
    const baseline = translations['tr'] || {};
    const updated = { ...translations, [code]: { ...baseline } };
    setTranslations(updated);
    handleSaveTranslations(updated);
    setNewLangCode('');
    setNotification({ message: `Yeni dil (${code}) eklendi!`, type: 'success' });
  };

  const handleAddTranslationKey = (e: React.FormEvent) => {
    e.preventDefault();
    const key = newKeyName.trim();
    if (!key) return;

    const firstLang = Object.keys(translations)[0] || 'tr';
    if (translations[firstLang] && translations[firstLang][key] !== undefined) {
      setNotification({ message: 'Bu kelime anahtarı zaten mevcut!', type: 'error' });
      return;
    }

    const updated = { ...translations };
    Object.keys(updated).forEach(lang => {
      updated[lang] = {
        ...updated[lang],
        [key]: lang === 'tr' ? newKeyDefaultVal : key
      };
    });

    setTranslations(updated);
    handleSaveTranslations(updated);
    setNewKeyName('');
    setNewKeyDefaultVal('');
    setNotification({ message: `Yeni kelime anahtarı (${key}) eklendi!`, type: 'success' });
  };

  const handleTranslationChange = (lang: string, key: string, value: string) => {
    setTranslations(prev => ({
      ...prev,
      [lang]: {
        ...prev[lang],
        [key]: value
      }
    }));
  };

  const fetchSettings = () => {
    fetch(`${API_BASE_URL}/api/admin/settings`, {
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data) setSettings(data);
      })
      .catch(err => console.error('Error fetching settings:', err));
  };

  const fetchStats = () => {
    fetch(`${API_BASE_URL}/api/admin/stats`, {
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data) setStats(data);
      })
      .catch(err => console.error('Error fetching stats:', err));
  };

  const fetchPlayers = () => {
    fetch(`${API_BASE_URL}/api/admin/players`, {
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data) setPlayers(data);
      })
      .catch(err => console.error('Error fetching players:', err));
  };

  const fetchQuests = () => {
    fetch(`${API_BASE_URL}/api/admin/quests`, {
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data) setQuests(data);
      })
      .catch(err => console.error('Error fetching quests:', err));
  };

  const fetchAchievements = () => {
    fetch(`${API_BASE_URL}/api/admin/achievements`, {
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data) setAchievements(data);
      })
      .catch(err => console.error('Error fetching achievements:', err));
  };

  const fetchTournaments = () => {
    fetch(`${API_BASE_URL}/api/tournaments`)
      .then(res => res.json())
      .then(data => {
        if (data) setTournaments(data);
      })
      .catch(err => console.error('Error fetching tournaments:', err));
  };

  const handleSaveSettings = (updatedSettings = settings) => {
    fetch(`${API_BASE_URL}/api/admin/settings`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ settings: updatedSettings })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSettings(data.settings);
          if (onSettingsUpdated) onSettingsUpdated(data.settings);
          setNotification({ message: 'Ayarlar başarıyla kaydedildi!', type: 'success' });
        } else {
          setNotification({ message: 'Ayarlar kaydedilemedi.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucuyla bağlantı kurulamadı.', type: 'error' });
      });
  };

  const handleToggle = (key: keyof AdminSettings) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    handleSaveSettings(next);
  };

  const handleSliderChange = (key: keyof AdminSettings, val: number) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
  };

  const handleUpdatePlayer = () => {
    if (!selectedPlayer) return;
    fetch(`${API_BASE_URL}/api/admin/players/update`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        userId: selectedPlayer.id,
        coins: editCoins,
        level: editLevel,
        xp: editXp
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotification({ message: `${selectedPlayer.username} profili güncellendi!`, type: 'success' });
          fetchPlayers();
          setSelectedPlayer(null);
        } else {
          setNotification({ message: 'Güncelleme başarısız.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası.', type: 'error' });
      });
  };

  const handleCreateServerPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerUsername.trim()) {
      setNotification({ message: 'Kullanıcı adı boş bırakılamaz.', type: 'error' });
      return;
    }

    fetch(`${API_BASE_URL}/api/admin/players/add`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        username: newPlayerUsername.trim(),
        coins: newPlayerCoins,
        level: newPlayerLevel,
        xp: newPlayerXp,
        discordId: newPlayerDiscordId.trim() || undefined
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotification({ message: `"${data.player.username}" veritabanına başarıyla eklendi!`, type: 'success' });
          setIsAddPlayerModalOpen(false);
          setNewPlayerUsername('');
          setNewPlayerCoins(1000);
          setNewPlayerLevel(1);
          setNewPlayerXp(0);
          setNewPlayerDiscordId('');
          fetchPlayers();
        } else {
          setNotification({ message: data.error || 'Oyuncu eklenemedi.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası oluştu.', type: 'error' });
      });
  };

  const handleDeleteServerPlayer = (p: Player) => {
    if (!window.confirm(`"${p.username}" kullanıcısını VERİTABANINDAN ve SUNUCUDAN kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) return;

    fetch(`${API_BASE_URL}/api/admin/players/delete`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ userId: p.id })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotification({ message: data.message || 'Oyuncu başarıyla silindi.', type: 'success' });
          fetchPlayers();
          if (selectedPlayer?.id === p.id) setSelectedPlayer(null);
        } else {
          setNotification({ message: data.error || 'Silme işlemi başarısız.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası oluştu.', type: 'error' });
      });
  };

  const handleClearPlaceholders = () => {
    if (!window.confirm("Tüm geçici misafir (Oyuncu_*, user-guest-*) ve hayalet Discord (Discord Oyuncusu) hesaplarını veritabanından kalıcı olarak temizlemek istiyor musunuz?")) return;

    fetch(`${API_BASE_URL}/api/admin/players/clear-placeholders`, {
      method: 'POST',
      headers: getAdminHeaders()
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setNotification({ message: data.message, type: 'success' });
          fetchPlayers();
        } else {
          setNotification({ message: data.error || 'Temizleme başarısız.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası oluştu.', type: 'error' });
      });
  };

  // Local Storage Account Handlers
  const handleDeleteLocalAccount = (username: string) => {
    if (!window.confirm(`"${username}" yerel hesabını bu cihazın önbelleğinden silmek istiyor musunuz?`)) return;

    const updated = localAccounts.filter((a: any) => a.username !== username);
    localStorage.setItem('mono_deal_saved_accounts', JSON.stringify(updated));
    localStorage.removeItem(`deal_master_local_profile_${username.toLowerCase()}`);
    if (localStorage.getItem('last_logged_username') === username) {
      localStorage.removeItem('last_logged_username');
    }
    setLocalAccounts(updated);
    setNotification({ message: `"${username}" hesabı bu cihazdan temizlendi.`, type: 'success' });
  };

  const handleAddLocalAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocalUsername.trim()) return;
    const trimmed = newLocalUsername.trim();

    if (localAccounts.some((a: any) => a.username.toLowerCase() === trimmed.toLowerCase())) {
      setNotification({ message: 'Bu isimde bir yerel hesap zaten kayıtlı.', type: 'error' });
      return;
    }

    const newAcc = {
      username: trimmed,
      lastLogin: Date.now(),
      coins: 1000,
      level: 1
    };
    const updated = [newAcc, ...localAccounts];
    localStorage.setItem('mono_deal_saved_accounts', JSON.stringify(updated));
    setLocalAccounts(updated);
    setNewLocalUsername('');
    setNotification({ message: `"${trimmed}" hesabı cihaza yerel olarak kaydedildi!`, type: 'success' });
  };

  const handleClearAllLocalData = () => {
    if (!window.confirm("DİKKAT! Bu cihazdaki TÜM yerel kayıtlı hesaplar, çevrimdışı profiller ve oturum önbelleği silinecek. Emin misiniz?")) return;

    localStorage.removeItem('mono_deal_saved_accounts');
    localStorage.removeItem('last_logged_username');
    localStorage.removeItem('deal_master_offline_profile');
    localStorage.removeItem('deal_master_last_profile');
    localStorage.removeItem('deal_master_last_auth');
    localStorage.removeItem('deal_master_auth_user');
    localStorage.removeItem('discord_access_token');
    
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('deal_master_local_profile_')) {
        localStorage.removeItem(k);
      }
    });

    setLocalAccounts([]);
    setNotification({ message: 'Tüm yerel hesaplar ve önbellek başarıyla sıfırlandı!', type: 'success' });
  };

  const handleAddQuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestDesc.trim()) return;

    fetch(`${API_BASE_URL}/api/admin/quests/add`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        description: newQuestDesc.trim(),
        targetValue: newQuestTarget,
        rewardCoins: newQuestCoins,
        rewardXp: newQuestXp,
        type: newQuestType
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQuests(data.quests);
          setNewQuestDesc('');
          setNotification({ message: 'Yeni günlük görev eklendi!', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleDeleteQuest = (questId: string) => {
    fetch(`${API_BASE_URL}/api/admin/quests/delete`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ questId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setQuests(data.quests);
          setNotification({ message: 'Görev başarıyla silindi.', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleAddAchievement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAchTitle.trim() || !newAchDesc.trim()) return;

    fetch(`${API_BASE_URL}/api/admin/achievements/add`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        title: newAchTitle.trim(),
        description: newAchDesc.trim(),
        targetValue: newAchTarget,
        rewardCoins: newAchCoins,
        type: newAchType
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAchievements(data.achievements);
          setNewAchTitle('');
          setNewAchDesc('');
          setNotification({ message: 'Yeni kalıcı başarım eklendi!', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleDeleteAchievement = (achievementId: string) => {
    fetch(`${API_BASE_URL}/api/admin/achievements/delete`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ achievementId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAchievements(data.achievements);
          setNotification({ message: 'Başarım başarıyla silindi.', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleSaveTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentName.trim()) {
      setNotification({ message: 'Lütfen turnuva adını giriniz.', type: 'error' });
      return;
    }

    fetch(`${API_BASE_URL}/api/admin/tournaments/save`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({
        id: editingTournamentId || undefined,
        name: tournamentName.trim(),
        description: tournamentDescription.trim(),
        format: tournamentFormat,
        botDifficulty: tournamentBotDifficulty,
        maxParticipants: Number(tournamentMaxParticipants),
        allowBots: true,
        entryFee: Number(tournamentEntryFee),
        prizeCoins: Number(tournamentPrizeCoins),
        prizeXp: Number(tournamentPrizeXp),
        targetSets: Number(tournamentTargetSets),
        turnDurationSeconds: Number(tournamentTurnDuration),
        tier: tournamentTier,
        icon: tournamentFormat === '4player' ? '👥' : (tournamentFormat === '2v2_team' ? '⚔️' : (tournamentTier === 'legend' ? '👑' : tournamentTier === 'gold' ? '🥇' : '🥉')),
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setEditingTournamentId(null);
          setTournamentName('');
          setTournamentDescription('');
          setTournaments(data.tournaments);
          setNotification({ message: editingTournamentId ? 'Turnuva başarıyla güncellendi!' : `"${tournamentName}" turnuvası başarıyla oluşturuldu!`, type: 'success' });
        } else {
          setNotification({ message: data.error || 'İşlem başarısız.', type: 'error' });
        }
      })
      .catch(err => {
        console.error(err);
        setNotification({ message: 'Sunucu hatası.', type: 'error' });
      });
  };

  const handleEditTournament = (t: any) => {
    setEditingTournamentId(t.id);
    setTournamentName(t.name || '');
    setTournamentDescription(t.description || '');
    setTournamentFormat(t.format || '1v1');
    setTournamentBotDifficulty(t.botDifficulty || 'medium');
    setTournamentMaxParticipants(t.maxParticipants || 8);
    setTournamentEntryFee(t.entryFee || 100);
    setTournamentPrizeCoins(t.prizeCoins || 1000);
    setTournamentPrizeXp(t.prizeXp || 300);
    setTournamentTargetSets(t.targetSets || 3);
    setTournamentTurnDuration(t.turnDurationSeconds || 30);
    setTournamentTier(t.tier || 'gold');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingTournamentId(null);
    setTournamentName('');
    setTournamentDescription('');
    setTournamentFormat('1v1');
    setTournamentBotDifficulty('medium');
    setTournamentMaxParticipants(8);
    setTournamentEntryFee(100);
    setTournamentPrizeCoins(1000);
    setTournamentPrizeXp(300);
    setTournamentTargetSets(3);
    setTournamentTurnDuration(30);
  };

  const handleDeleteTournament = (tournamentId: string) => {
    if (!window.confirm('Bu turnuvayı silmek istediğinize emin misiniz?')) return;
    fetch(`${API_BASE_URL}/api/admin/tournaments/delete`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ tournamentId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTournaments(data.tournaments);
          if (selectedTournamentId === tournamentId) setSelectedTournamentId(null);
          setNotification({ message: 'Turnuva başarıyla silindi.', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleAdvanceTournamentRound = (tournamentId: string) => {
    fetch(`${API_BASE_URL}/api/admin/tournaments/advance`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ tournamentId })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTournaments(data.tournaments);
          setNotification({ message: 'Turnuva turu otomatik simüle edildi ve ilerletildi!', type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const handleAdminSubmitMatchScore = (tournamentId: string, matchId: string, winnerName: string, score1: number, score2: number) => {
    fetch(`${API_BASE_URL}/api/tournaments/match/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, matchId, winnerName, score1, score2 })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setTournaments(data.tournaments);
          setNotification({ message: `Maç sonucu girildi: ${winnerName} kazandı!`, type: 'success' });
        }
      })
      .catch(err => console.error(err));
  };

  const selectPlayerForEdit = (p: Player) => {
    setSelectedPlayer(p);
    setEditCoins(p.coins);
    setEditLevel(p.level);
    setEditXp(p.xp);
  };

  const filteredPlayers = players.filter(p =>
    p.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatUptime = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    const seconds = sec % 60;
    return `${hours}s ${minutes}d ${seconds}s`;
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-950/80 backdrop-blur-xl rounded-2xl border border-slate-800 text-slate-100 overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🛠️</span>
          <div>
            <h2 className="text-lg font-bold tracking-wide bg-gradient-to-r from-red-400 to-amber-400 bg-clip-text text-transparent">YÖNETİCİ KONTROL PANELİ</h2>
            <p className="text-xs text-slate-400">Gerçek zamanlı sunucu, veritabanı, kural ve lobi yönetimi</p>
          </div>
        </div>
        {notification && (
          <div className={`px-4 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${notification.type === 'success' ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400' : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
            }`}>
            {notification.message}
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Nav */}
        <div className="w-64 bg-slate-950/40 border-r border-slate-900 flex flex-col p-4 gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>⚙️</span> Sistem Analitiği
          </button>
          <button
            onClick={() => setActiveTab('rules')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'rules' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>⚙️</span> Oyun Kuralları
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'security' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🔐</span> Güvenlik & Şifre
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'players' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>👥</span> Oyuncu Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('quests')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'quests' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>📜</span> Görev Tasarımcısı
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'achievements' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🏅</span> Başarımlar & Rozetler
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'tournaments' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🏆</span> Turnuva Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('translations')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'translations' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🌐</span> Dil & Kelime Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('voices')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'voices' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🗣️</span> Seslendirme Yönetimi
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`w-full px-4 py-3 rounded-xl text-left text-sm font-semibold flex items-center gap-3 transition-all ${activeTab === 'shop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
          >
            <span>🛒</span> Mağaza Ürün Yönetimi
          </button>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full mt-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center gap-2 border border-rose-500/20 transition-all cursor-pointer active:scale-95"
            >
              <span>🔒</span>
              <span>Yönetici Oturumunu Kapat</span>
            </button>
          )}

          <div className="mt-auto p-4 rounded-xl bg-slate-900/40 border border-slate-900 flex flex-col gap-2">
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Durum Kontrolü</span>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${stats.supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs text-slate-400">Supabase Database</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-slate-400">Sunucu Çevrimiçi</span>
            </div>
          </div>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-950/20">
          {/* TAB 1: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stat 1 */}
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Toplam Oyuncu (Memory / DB)</span>
                  <span className="text-3xl font-extrabold text-indigo-400">{stats.totalUsersInMemory} <span className="text-slate-600 text-lg">/</span> {stats.supabaseRowCount}</span>
                  <span className="text-[10px] text-slate-500">Supabase ve lokal yedeklerdeki toplam oyuncu</span>
                </div>
                {/* Stat 2 */}
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Aktif Oda / Canlı Lobi</span>
                  <span className="text-3xl font-extrabold text-amber-400">{stats.activeRooms}</span>
                  <span className="text-[10px] text-slate-500">Oynanmakta olan güncel çok oyunculu maçlar</span>
                </div>
                {/* Stat 3 */}
                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Sunucu Çalışma Süresi</span>
                  <span className="text-lg font-bold text-emerald-400 mt-2">{formatUptime(stats.uptimeSeconds)}</span>
                  <span className="text-[10px] text-slate-500">Node.js sunucusu kesintisiz ayakta kalma süresi</span>
                </div>
              </div>

              {/* Database sync status panel */}
              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">Veritabanı Entegrasyon Durumu</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-900">
                    <span className="text-xs text-slate-400">Supabase Bağlantı Durumu</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${stats.supabaseStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                      {stats.supabaseStatus === 'connected' ? 'BAĞLI (ONLINE)' : 'ÇEVRİMDIŞI (FALLBACK AKTİF)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-900">
                    <span className="text-xs text-slate-400">Otomatik Çevrimdışı JSON Yedekleme</span>
                    <span className="text-xs text-emerald-400 font-semibold">AKTİF (Çift Yazma Korumalı)</span>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-b border-slate-900">
                    <span className="text-xs text-slate-400">Aktif Turnuva Havuzu</span>
                    <span className="text-xs text-indigo-400 font-bold">{stats.activeTournamentsCount} Turnuva</span>
                  </div>
                </div>
              </div>

              {/* Maintenance Mode & Emergency Stop */}
              <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-rose-400">Acil Durum & Bakım Modu</h3>
                  <p className="text-xs text-slate-400 mt-1">Bakım modunu aktif ederek yeni oyuncuların lobi kurmasını veya çok oyunculu maçlara girmesini geçici olarak askıya alabilirsiniz.</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => handleToggle('maintenanceMode')}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md ${settings.maintenanceMode ? 'bg-rose-600 text-white shadow-rose-600/25' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                    {settings.maintenanceMode ? 'Bakım Modunu Kapat' : 'Bakım Modunu Aktif Et'}
                  </button>
                  {settings.maintenanceMode && (
                    <span className="text-xs text-rose-400 font-semibold animate-pulse">⚠️ Sunucu şu an bakım modunda!</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RULES */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Global Oyun ve Sistem Ayarları</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Toggles */}
                <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-semibold">Görsel ve Mekanik Toggles</span>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">3D Kart Döndürme Efekti</span>
                    <input
                      type="checkbox"
                      checked={settings.enable3DCardFlip}
                      onChange={() => handleToggle('enable3DCardFlip')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Özelleştirilmiş Mülk Set Kenar Işıması (Glow)</span>
                    <input
                      type="checkbox"
                      checked={settings.enablePropertySetGlow}
                      onChange={() => handleToggle('enablePropertySetGlow')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Masaüstü Hover Kart Önizleme Paneli (Sidebar)</span>
                    <input
                      type="checkbox"
                      checked={settings.enableHoverCardSidebar}
                      onChange={() => handleToggle('enableHoverCardSidebar')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Günlük Görevleri Göster</span>
                    <input
                      type="checkbox"
                      checked={settings.questsEnabled}
                      onChange={() => handleToggle('questsEnabled')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Dünya Sıralaması (League) Aktif</span>
                    <input
                      type="checkbox"
                      checked={settings.rankedLeagueEnabled}
                      onChange={() => handleToggle('rankedLeagueEnabled')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Pratik Modunda Hamle Geri Alma (Undo)</span>
                    <input
                      type="checkbox"
                      checked={settings.enableUndoInTraining}
                      onChange={() => handleToggle('enableUndoInTraining')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300">Karakter Seslendirmelerini Etkinleştir (TR/EN)</span>
                    <input
                      type="checkbox"
                      checked={settings.enableSystemVoiceovers}
                      onChange={() => handleToggle('enableSystemVoiceovers')}
                      className="w-4 h-4 accent-indigo-600 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Rules Sliders */}
                <div className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-6">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2 font-semibold">Kural Limitleri</span>
                  {/* Slider 1 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Sıra Süresi Zaman Aşımı (AFK)</span>
                      <span className="text-indigo-400 font-bold">{settings.turnTimeoutSeconds} Saniye</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      value={settings.turnTimeoutSeconds}
                      onChange={(e) => handleSliderChange('turnTimeoutSeconds', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  {/* Slider 2 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Karar & Ödeme Yanıt Süresi Sınırı</span>
                      <span className="text-indigo-400 font-bold">{settings.actionTimeoutSeconds} Saniye</span>
                    </div>
                    <input
                      type="range"
                      min="5"
                      max="60"
                      step="5"
                      value={settings.actionTimeoutSeconds}
                      onChange={(e) => handleSliderChange('actionTimeoutSeconds', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  {/* Slider - Kart Oynama Ek Süresi */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Kart Oynama Ek Süresi (Bonus)</span>
                      <span className="text-emerald-400 font-bold">+{settings.bonusTimePerActionSeconds ?? 10} Saniye</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={settings.bonusTimePerActionSeconds ?? 10}
                      onChange={(e) => handleSliderChange('bonusTimePerActionSeconds', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  {/* Slider 3 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Kazanmak İçin Gereken Set Sayısı</span>
                      <span className="text-indigo-400 font-bold">{settings.targetSets} Set</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="5"
                      step="1"
                      value={settings.targetSets}
                      onChange={(e) => handleSliderChange('targetSets', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                  {/* Slider 4 */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">Altın Ödülü Çarpanı (Event boost)</span>
                      <span className="text-indigo-400 font-bold">{settings.goldMultiplier}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="5.0"
                      step="0.5"
                      value={settings.goldMultiplier}
                      onChange={(e) => handleSliderChange('goldMultiplier', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Kart Boyut Ayarları Kartı */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎴</span>
                  <div>
                    <h4 className="text-xs text-indigo-400 font-extrabold uppercase tracking-wider">
                      ELDEKİ KARTLARIN BOYUTU (DİNAMİK ÖLÇEKLENDİRME)
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Oyuncunun elindeki kartların boyutunu dinamik olarak ayarlayın. Hem normal hem de sıkışık (kompakt) yerleşim düzeni için ayrı ayrı kontrol edilebilir.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Normal Düzen Kart Boyutu */}
                  <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-bold">Normal Düzen Kart Boyutu</span>
                      <span className="text-indigo-400 font-black">%{settings.normalHandCardSize ?? 100}</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={settings.normalHandCardSize ?? 100}
                      onChange={(e) => handleSliderChange('normalHandCardSize', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      onTouchEnd={() => handleSaveSettings()}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-[9px] text-slate-500 block leading-tight">
                      Varsayılan: %100. Kart boyutunu büyüterek veya küçülterek oyun ekranı dengelenir.
                    </span>
                  </div>

                  {/* Sıkışık Düzen Kart Boyutu */}
                  <div className="space-y-2 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-bold">Sıkışık (Kompakt) Düzen Kart Boyutu</span>
                      <span className="text-indigo-400 font-black">%{settings.compactHandCardSize ?? 100}</span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="150"
                      step="5"
                      value={settings.compactHandCardSize ?? 100}
                      onChange={(e) => handleSliderChange('compactHandCardSize', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      onTouchEnd={() => handleSaveSettings()}
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                    <span className="text-[9px] text-slate-500 block leading-tight">
                      Varsayılan: %100. Sıkışık düzen etkinken eldeki kartların kaplayacağı alan ölçeklenir.
                    </span>
                  </div>
                </div>
              </div>

              {/* Bot & Ödül Yönetimi Card */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤖</span>
                  <div>
                    <h4 className="text-xs text-amber-400 font-extrabold uppercase tracking-wider">
                      BOT & OYUN İSTATİSTİK / ÖDÜL KONTROLLERİ
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Bot pratik modları ve çok oyunculu botlu odalar için ödül, tecrübe puanı (XP) ve istatistik kayıt kuralları.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Bot Pratik Ödülleri Toggle */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs text-slate-200 font-bold block">Bot Pratik Mod Ödül & İstatistikleri</span>
                      <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">
                        Açık ise pratik maçları oyun geçmişine eklenir, maç ve galibiyet/mağlubiyet sayılarını artırır, XP ve Altın verir. (Varsayılan: Kapalı)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.botPracticeRewardsEnabled ?? false}
                      onChange={() => handleToggle('botPracticeRewardsEnabled')}
                      className="w-5 h-5 accent-emerald-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Multiplayer Bot Rewards Multiplier */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Botlu Çok Oyunculu Maç Ödül Çarpanı</span>
                      <span className="text-amber-400 font-black text-sm px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        %{Math.round((settings.botMultiplayerRewardMultiplier ?? 0.5) * 100)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Çok oyunculu maçta en az 1 bot varsa oyuncuların kazanacağı XP ve Altın miktarını düşürür (%50 = yarı yarıya ödül).
                    </p>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={settings.botMultiplayerRewardMultiplier ?? 0.5}
                      onChange={(e) => handleSliderChange('botMultiplayerRewardMultiplier', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Otomatik Eşleşme (Matchmaking) Ayarları */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🤝</span>
                  <div>
                    <h4 className="text-xs text-indigo-400 font-extrabold uppercase tracking-wider">
                      OTOMATİK OYUNCU BULMA (MATCHMAKING) KONTROLLERİ
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Oyuncuların belli bir giriş ücretiyle otomatik eşleşmesini, havuz ödül dağılımını ve yapay zeka bekleme sürelerini yönetin.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Matchmaking Enabled Toggle */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs text-slate-200 font-bold block">Otomatik Eşleşme Etkin</span>
                      <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">
                        Açık ise oyuncular ana menüden otomatik eşleşme sırasına girebilir. (Varsayılan: Açık)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.matchmakingEnabled ?? false}
                      onChange={() => handleToggle('matchmakingEnabled')}
                      className="w-5 h-5 accent-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Matchmaking Entry Fee Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Giriş Ücreti (Altın)</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.matchmakingEntryFee ?? 100} Altın
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Sıraya girerken her oyuncudan düşülecek altın miktarı. Toplam ödül havuzunun temelini oluşturur.
                    </p>
                    <input
                      type="range"
                      min="10"
                      max="1000"
                      step="10"
                      value={settings.matchmakingEntryFee ?? 100}
                      onChange={(e) => handleSliderChange('matchmakingEntryFee', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Matchmaking Winner Share Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Kazanan Payout Yüzdesi</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        %{settings.matchmakingWinnerShare ?? 80}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Kazanan oyuncunun toplam havuzun (2x Giriş Ücreti) alacağı yüzde oranı. Kalan miktar sistem kasasında kalır.
                    </p>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="5"
                      value={settings.matchmakingWinnerShare ?? 80}
                      onChange={(e) => handleSliderChange('matchmakingWinnerShare', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Matchmaking Failsafe Time Sec Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Yapay Zeka Geçiş Süresi</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.matchmakingTimeSec ?? 10} Saniye
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Sırada beklerken başka gerçek oyuncu bulunamazsa, sistem tarafından akıllı Bot'un maça atanacağı bekleme süresi.
                    </p>
                    <input
                      type="range"
                      min="3"
                      max="60"
                      step="1"
                      value={settings.matchmakingTimeSec ?? 10}
                      onChange={(e) => handleSliderChange('matchmakingTimeSec', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Ranked Turn Duration Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Dereceli Hamle Süresi</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.rankedTurnDuration ?? 15} Saniye
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Dereceli maçlarda oyunculara tanınan hamle süresi limitidir. Temponun yüksek tutulmasını sağlar.
                    </p>
                    <input
                      type="range"
                      min="10"
                      max="30"
                      step="1"
                      value={settings.rankedTurnDuration ?? 15}
                      onChange={(e) => handleSliderChange('rankedTurnDuration', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Complete Sets Weight Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Tamamlanmış Set Puan Ağırlığı</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.rankedCompleteSetWeight ?? 50} Puan
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Maç bittiğinde kazanamayan oyuncuların tamamladığı her tam set başına verilecek skor puanı. (Varsayılan: 50)
                    </p>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="5"
                      value={settings.rankedCompleteSetWeight ?? 50}
                      onChange={(e) => handleSliderChange('rankedCompleteSetWeight', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Incomplete Properties Weight Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Parçalı Mülk Çarpanı</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.rankedIncompletePropWeight ?? 2}x
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Masadaki tamamlanmamış mülklerin milyon (M) değerinin skor puanı çarpanı. (Varsayılan: 2x)
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={settings.rankedIncompletePropWeight ?? 2}
                      onChange={(e) => handleSliderChange('rankedIncompletePropWeight', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Bank Cash Weight Slider */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-200 font-bold">Bankadaki Nakit Çarpanı</span>
                      <span className="text-indigo-400 font-black text-sm px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                        {settings.rankedBankCashWeight ?? 1}x
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed">
                      Bankadaki nakit paranızın milyon (M) değerinin skor puanı çarpanı. (Varsayılan: 1x)
                    </p>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="1"
                      value={settings.rankedBankCashWeight ?? 1}
                      onChange={(e) => handleSliderChange('rankedBankCashWeight', Number(e.target.value))}
                      onMouseUp={() => handleSaveSettings()}
                      className="w-full accent-indigo-500 cursor-pointer"
                    />
                  </div>

                  {/* Ranked Solo Queue Only Toggle */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs text-slate-200 font-bold block">Sadece Tekli Giriş (Solo Queue)</span>
                      <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">
                        Dereceli maçlara grup/parti halinde girişi engelleyerek teaming (ittifak) hilelerini önler.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.rankedSoloQueueOnly ?? true}
                      onChange={() => handleToggle('rankedSoloQueueOnly')}
                      className="w-5 h-5 accent-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>

                  {/* Ranked Anonymity Toggle */}
                  <div className="bg-slate-950/60 p-4 rounded-xl border border-white/5 flex items-center justify-between">
                    <div className="pr-3">
                      <span className="text-xs text-slate-200 font-bold block">Lobi Anonimliği</span>
                      <span className="text-[10px] text-slate-400 leading-relaxed block mt-1">
                        Eşleştirme ve oda lobisinde maç başlayana kadar oyuncu isimlerini ve avatarlarını gizler.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.rankedAnonymity ?? true}
                      onChange={() => handleToggle('rankedAnonymity')}
                      className="w-5 h-5 accent-indigo-500 cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>

              {/* Şans Çarkı (Lucky Wheel) Ayarları */}
              <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎡</span>
                  <div>
                    <h4 className="text-xs text-indigo-400 font-extrabold uppercase tracking-wider">
                      ŞANS ÇARKI (LUCKY WHEEL) AYARLARI
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Oyuncuların ücretsiz veya reklam izleyerek çark çevirip ödüller kazandığı mekaniği yönetin.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* Left Column: General Wheel Rules */}
                  <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-300 font-bold block border-b border-white/5 pb-2">Temel Kurallar</span>

                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-slate-300 font-medium">Şans Çarkı Etkin</span>
                      <input
                        type="checkbox"
                        checked={settings.wheelEnabled ?? true}
                        onChange={() => handleToggle('wheelEnabled')}
                        className="w-4 h-4 accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Çark Çevirme Bekleme Süresi</span>
                        <span className="text-indigo-400 font-black">{settings.wheelCooldownMinutes ?? 60} Dakika</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="1440"
                        step="5"
                        value={settings.wheelCooldownMinutes ?? 60}
                        onChange={(e) => handleSliderChange('wheelCooldownMinutes', Number(e.target.value))}
                        onMouseUp={() => handleSaveSettings()}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300">Reklam İzleme Süresi (Saniye / Bekleme Atla)</span>
                        <span className="text-emerald-400 font-black">{settings.wheelAdDurationSeconds ?? 8} Saniye</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        step="1"
                        value={settings.wheelAdDurationSeconds ?? 8}
                        onChange={(e) => handleSliderChange('wheelAdDurationSeconds', Number(e.target.value))}
                        onMouseUp={() => handleSaveSettings()}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>

                    {/* Google AdSense (Web) Configuration */}
                    <div className="border-t border-white/5 pt-3.5 mt-3.5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block">🌐 Google AdSense (Web Reklamları)</span>
                        <input
                          type="checkbox"
                          checked={settings.adSenseEnabled ?? true}
                          onChange={() => handleToggle('adSenseEnabled')}
                          className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                        />
                      </div>

                      <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5 space-y-2.5">
                        <div className="space-y-1">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">AdSense Publisher ID (Client)</label>
                          <input
                            type="text"
                            placeholder="ca-pub-5045652074166668"
                            value={settings.adSenseClientId ?? 'ca-pub-5045652074166668'}
                            onChange={(e) => {
                              const next = { ...settings, adSenseClientId: e.target.value };
                              setSettings(next);
                            }}
                            onBlur={() => handleSaveSettings()}
                            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">AdSense Banner Slot ID (Opsiyonel)</label>
                          <input
                            type="text"
                            placeholder="Örn: 1234567890"
                            value={settings.adSenseBannerSlotId ?? ''}
                            onChange={(e) => {
                              const next = { ...settings, adSenseBannerSlotId: e.target.value };
                              setSettings(next);
                            }}
                            onBlur={() => handleSaveSettings()}
                            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Google AdMob (Mobil Uygulama) Configuration */}
                    <div className="border-t border-white/5 pt-3.5 mt-3.5 space-y-3.5">
                      <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">📱 Google AdMob (Mobil / Android & iOS)</span>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-xs text-slate-300 font-medium">Test Reklam Modu (Global)</span>
                        <input
                          type="checkbox"
                          checked={settings.wheelAdMobTestingMode ?? true}
                          onChange={() => handleToggle('wheelAdMobTestingMode')}
                          className="w-4 h-4 accent-indigo-600 cursor-pointer"
                        />
                      </div>

                      {/* Ödüllü Reklam (Rewarded Video) */}
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5 space-y-2">
                        <span className="text-[11px] text-amber-400 font-bold block">🎥 Ödüllü Video Reklamı (Deal Card)</span>

                        <div className="space-y-1">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">Android Rewarded Unit ID</label>
                          <input
                            type="text"
                            placeholder="ca-app-pub-5045652074166668/6893680557"
                            value={settings.wheelAdMobAndroidAdUnitId ?? ''}
                            onChange={(e) => {
                              const next = { ...settings, wheelAdMobAndroidAdUnitId: e.target.value };
                              setSettings(next);
                            }}
                            onBlur={() => handleSaveSettings()}
                            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">Ödül Altın Miktarı</label>
                          <input
                            type="number"
                            placeholder="100"
                            value={settings.rewardedAdCoinAmount ?? 100}
                            onChange={(e) => handleSliderChange('rewardedAdCoinAmount', Number(e.target.value))}
                            onBlur={() => handleSaveSettings()}
                            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      {/* Banner Reklamı (Banner Ads) */}
                      <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-indigo-400 font-bold block">📱 Banner Reklamı (Mobil Alt Bar)</span>
                          <input
                            type="checkbox"
                            checked={settings.bannerAdMobEnabled ?? true}
                            onChange={() => handleToggle('bannerAdMobEnabled')}
                            className="w-3.5 h-3.5 accent-indigo-600 cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[9px] text-slate-400 font-bold uppercase">Android Banner Unit ID</label>
                          <input
                            type="text"
                            placeholder="ca-app-pub-5045652074166668/1473978700"
                            value={settings.bannerAdMobAndroidAdUnitId ?? ''}
                            onChange={(e) => {
                              const next = { ...settings, bannerAdMobAndroidAdUnitId: e.target.value };
                              setSettings(next);
                            }}
                            onBlur={() => handleSaveSettings()}
                            className="w-full px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Wedges / Rewards Configuration */}
                  <div className="space-y-4 bg-slate-950/40 p-4 rounded-xl border border-white/5">
                    <span className="text-xs text-slate-300 font-bold block border-b border-white/5 pb-2">Çark Bölmeleri ve Ödülleri</span>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 1 (Gold)</label>
                        <input
                          type="number"
                          value={settings.wheelReward1 ?? 50}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward1: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 2 (Gold)</label>
                        <input
                          type="number"
                          value={settings.wheelReward2 ?? 100}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward2: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 3 (Gold)</label>
                        <input
                          type="number"
                          value={settings.wheelReward3 ?? 200}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward3: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 4 (Gold)</label>
                        <input
                          type="number"
                          value={settings.wheelReward4 ?? 500}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward4: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 5 (Gold)</label>
                        <input
                          type="number"
                          value={settings.wheelReward5 ?? 1000}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward5: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Bölme 6 (XP)</label>
                        <input
                          type="number"
                          value={settings.wheelReward6 ?? 25}
                          onChange={(e) => {
                            const next = { ...settings, wheelReward6: Number(e.target.value) };
                            setSettings(next);
                          }}
                          onBlur={() => handleSaveSettings()}
                          className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
                        />
                      </div>
                    </div>
                    <span className="block text-[9px] text-slate-500 leading-tight">
                      * Not: Değişiklikler anında kaydedilir ve oyuncuların çark ekranında güncellenir.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2.5 tracking-wide">
                  <span className="text-amber-400 text-2xl">🔐</span> Yönetim Paneli Güvenliği & Şifre Değiştirme
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Yönetici paneline erişirken kullandığınız oturum şifresini buradan güncelleyebilir ve güvenlik durumunu kontrol edebilirsiniz.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Password Change Form */}
                <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden backdrop-blur-sm">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-600/10 rounded-full filter blur-2xl pointer-events-none" />

                  <div className="flex items-center gap-3 border-b border-slate-800/80 pb-4 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">
                      🛡️
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-200 uppercase tracking-wider">Yönetici Şifresini Güncelle</h4>
                      <span className="text-[11px] text-slate-400">Şifreniz sunucuda güvenli şekilde güncellenecektir.</span>
                    </div>
                  </div>

                  <form onSubmit={handleChangeAdminPassword} className="space-y-4">
                    {/* Current Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        Mevcut Yönetici Şifresi <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={currentAdminPassword}
                        onChange={(e) => setCurrentAdminPassword(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        required
                      />
                    </div>

                    {/* New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        Yeni Yönetici Şifresi <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Yeni şifreniz (En az 4 karakter)"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        required
                        minLength={4}
                      />
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-300 block">
                        Yeni Şifre Tekrarı <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Yeni şifreyi tekrar giriniz"
                        value={confirmAdminPassword}
                        onChange={(e) => setConfirmAdminPassword(e.target.value)}
                        className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                        required
                        minLength={4}
                      />
                    </div>

                    {/* Notification Messages */}
                    {passwordChangeMsg && (
                      <div
                        className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${passwordChangeMsg.type === 'success'
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                          }`}
                      >
                        <span>{passwordChangeMsg.type === 'success' ? '✅' : '⚠️'}</span>
                        <span>{passwordChangeMsg.text}</span>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <button
                        type="submit"
                        disabled={passwordChangeLoading}
                        className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        {passwordChangeLoading ? (
                          <>
                            <span className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            <span>Kaydediliyor...</span>
                          </>
                        ) : (
                          <>
                            <span>💾</span>
                            <span>Şifreyi Değiştir & Kaydet</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Security Overview & Info Card */}
                <div className="space-y-4">
                  <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-3">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider border-b border-slate-800 pb-2">
                      <span>🔒</span> Güvenlik Durumu
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Yönetici Oturumu:</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Doğrulandı
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">API Koruması:</span>
                        <span className="text-indigo-300 font-mono font-bold">Bearer Token</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Gizli Giriş:</span>
                        <span className="text-amber-400 font-semibold">Aktif (5x Tıklama)</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-3xl p-5 shadow-lg space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                      <span>💡</span> Güvenlik İpuçları
                    </div>
                    <ul className="text-[11px] text-slate-300 space-y-1.5 list-disc list-inside leading-relaxed">
                      <li>Yönetici şifrenizi kimseyle paylaşmayınız.</li>
                      <li>Şifrenizi değiştirdiğinizde hemen geçerli olur.</li>
                      <li>İşiniz bittiğinde sol alttaki <strong>"Yönetici Oturumunu Kapat"</strong> butonuyla paneli kilitlemeniz önerilir.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PLAYERS & ACCOUNT MANAGEMENT */}
          {activeTab === 'players' && (
            <div className="space-y-8">
              {/* Header & Quick Action Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                    <span>👥</span> Oyuncu Hesap & Profil Yönetimi
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Veritabanı (Supabase/Sunucu) ve bu tarayıcıdaki yerel hesapları ekleyin, düzenleyin veya silin.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder="Veritabanında oyuncu ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="px-3.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 w-48"
                  />
                  <button
                    onClick={() => setIsAddPlayerModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>➕</span> Yeni Hesap Ekle
                  </button>
                  <button
                    onClick={handleClearPlaceholders}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Oyuncu_*, DiscordPlayer_*, Discord Oyuncusu gibi geçici/hayalet hesapları temizler"
                  >
                    <span>🧹</span> Hayalet Hesapları Temizle
                  </button>
                  <button
                    onClick={fetchPlayers}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>🔄</span> Yenile
                  </button>
                </div>
              </div>

              {/* Add Player to Database Modal / Expandable Form */}
              {isAddPlayerModalOpen && (
                <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-950 p-5 rounded-2xl border border-indigo-500/30 space-y-4 shadow-xl">
                  <div className="flex justify-between items-center border-b border-indigo-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-400 text-base">➕</span>
                      <h4 className="text-sm font-bold text-slate-100">Veritabanına Yeni Oyuncu Hesabı Ekle</h4>
                    </div>
                    <button
                      onClick={() => setIsAddPlayerModalOpen(false)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800/60"
                    >
                      ✕ Kapat
                    </button>
                  </div>

                  <form onSubmit={handleCreateServerPlayer} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Kullanıcı Adı *</label>
                        <input
                          type="text"
                          required
                          placeholder="Örn: KralOyuncu"
                          value={newPlayerUsername}
                          onChange={(e) => setNewPlayerUsername(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Başlangıç Altını</label>
                        <input
                          type="number"
                          value={newPlayerCoins}
                          onChange={(e) => setNewPlayerCoins(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Seviye (Level)</label>
                        <input
                          type="number"
                          min="1"
                          value={newPlayerLevel}
                          onChange={(e) => setNewPlayerLevel(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 uppercase font-bold">Deneyim (XP)</label>
                        <input
                          type="number"
                          min="0"
                          value={newPlayerXp}
                          onChange={(e) => setNewPlayerXp(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 uppercase font-bold">Discord Kullanıcı ID (Snowflake - İsteğe Bağlı)</label>
                      <input
                        type="text"
                        placeholder="Örn: 163045930814144512 (Discord kullanıcısı ile otomatik eşleşmesi için)"
                        value={newPlayerDiscordId}
                        onChange={(e) => setNewPlayerDiscordId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddPlayerModalOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                      >
                        İptal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-bold transition-all shadow-lg cursor-pointer"
                      >
                        Hesabı Veritabanına Kaydet
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit Selected Player Form */}
              {selectedPlayer && (
                <div className="bg-slate-900/60 border border-indigo-500/40 rounded-2xl p-5 space-y-4 shadow-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                      <span>✏️</span> {selectedPlayer.username} Profili Düzenleniyor
                      {selectedPlayer.isDiscord && (
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                          Discord
                        </span>
                      )}
                    </h4>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="text-xs text-slate-500 hover:text-slate-300"
                    >
                      Kapat
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Altın Bakiyesi</label>
                      <input
                        type="number"
                        value={editCoins}
                        onChange={(e) => setEditCoins(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Seviye (Level)</label>
                      <input
                        type="number"
                        value={editLevel}
                        onChange={(e) => setEditLevel(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Deneyim Puanı (XP)</label>
                      <input
                        type="number"
                        value={editXp}
                        onChange={(e) => setEditXp(Number(e.target.value))}
                        className="w-full px-3 py-2 text-sm rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleUpdatePlayer}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold cursor-pointer"
                    >
                      Değişiklikleri Kaydet
                    </button>
                    <button
                      onClick={() => setSelectedPlayer(null)}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                    >
                      İptal
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 1: VERİTABANI VE SUNUCU HESAPLARI TABLOSU */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                      🌐 Veritabanı & Sunucu Hesapları
                    </span>
                    <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                      {filteredPlayers.length} Oyuncu
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Kalıcı olarak Supabase ve users.json üzerinde saklanan hesaplar
                  </span>
                </div>

                <div className="bg-slate-900/30 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/50 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="px-5 py-3">Oyuncu</th>
                        <th className="px-5 py-3">Hesap Türü</th>
                        <th className="px-5 py-3">Seviye & XP</th>
                        <th className="px-5 py-3">Altın</th>
                        <th className="px-5 py-3">Galibiyet / Toplam</th>
                        <th className="px-5 py-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {filteredPlayers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                            Hiçbir oyuncu bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        filteredPlayers.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3">
                                {p.avatarUrl ? (
                                  <img
                                    src={p.avatarUrl}
                                    alt={p.username}
                                    className="w-8 h-8 rounded-full border border-slate-700 object-cover bg-slate-800"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300 text-xs">
                                    {p.username.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-slate-200">{p.username}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{p.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3">
                              {p.isDiscord ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-md font-medium">
                                  <span>💬</span> Discord
                                </span>
                              ) : p.isGuest ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-md font-medium">
                                  <span>👤</span> Misafir
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                                  <span>⭐</span> Kayıtlı
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3 text-slate-300">
                              <span className="font-bold text-slate-200">Lvl {p.level}</span>{' '}
                              <span className="text-[10px] text-slate-400">({p.xp} XP)</span>
                            </td>
                            <td className="px-5 py-3 text-amber-400 font-bold">
                              {p.coins.toLocaleString()} 🪙
                            </td>
                            <td className="px-5 py-3 text-slate-400">
                              <span className="text-emerald-400 font-semibold">{p.gamesWon}</span> / {p.gamesPlayed} Maç
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => selectPlayerForEdit(p)}
                                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-all cursor-pointer"
                                  title="Seviye ve bakiye düzenle"
                                >
                                  ✏️ Düzenle
                                </button>
                                <button
                                  onClick={() => handleDeleteServerPlayer(p)}
                                  className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-[11px] font-medium transition-all cursor-pointer"
                                  title="Veritabanından kalıcı olarak sil"
                                >
                                  🗑️ Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 2: BU CİHAZDAKİ YEREL HESAPLAR & ÖNBELLEK (LOCALSTORAGE) */}
              <div className="space-y-4 pt-4 border-t border-slate-800/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                      <span>💻</span> Bu Cihazdaki Yerel / Tarayıcı Hesapları
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Giriş ekranındaki hızlı hesap seçici (LocalStorage) ve çevrimdışı profil önbelleğini yönetin.
                    </p>
                  </div>
                  <button
                    onClick={handleClearAllLocalData}
                    className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>⚠️</span> Bu Cihazdaki Tüm Önbelleği & Hesapları Sıfırla
                  </button>
                </div>

                {/* Quick Add Local Account Form */}
                <form onSubmit={handleAddLocalAccount} className="flex items-center gap-2 max-w-md">
                  <input
                    type="text"
                    placeholder="Yeni yerel hesap adı..."
                    value={newLocalUsername}
                    onChange={(e) => setNewLocalUsername(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    + Cihaza Kaydet
                  </button>
                </form>

                {/* Local Accounts Grid / Cards */}
                {localAccounts.length === 0 ? (
                  <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-4 text-center text-xs text-slate-500">
                    Bu cihazın tarayıcısında kayıtlı yerel hesap bulunmuyor.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {localAccounts.map((acc: any) => (
                      <div
                        key={acc.username}
                        className="bg-slate-900/40 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 group hover:border-slate-700 transition-all"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-200 truncate flex items-center gap-1.5">
                            <span>👤</span> {acc.username}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {acc.coins ? `${acc.coins} 🪙` : '1,000 🪙'} • Lvl {acc.level || 1}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteLocalAccount(acc.username)}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-bold border border-rose-500/20 transition-all cursor-pointer"
                          title="Cihazdan kaldır"
                        >
                          ✕ Sil
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: QUESTS */}
          {activeTab === 'quests' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Günlük Görev Havuzu Tasarımcısı</h3>
                <p className="text-xs text-slate-500 mt-1">Sistemdeki tüm aktif oyuncular için günlük görev havuzunu yönetin. Değişiklikler anında tüm çevrimiçi profillere yansıtılır.</p>
              </div>

              {/* Add quest form */}
              <form onSubmit={handleAddQuest} className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-bold">Yeni Günlük Görev Ekle</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 uppercase font-bold">Görev Açıklaması</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: 3 kez bankaya para yerleştir."
                      value={newQuestDesc}
                      onChange={(e) => setNewQuestDesc(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Gereken Eylem Tipi</label>
                      <select
                        value={newQuestType}
                        onChange={(e) => setNewQuestType(e.target.value)}
                        className="w-full px-2 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="games_played">Maç Oyna</option>
                        <option value="games_won">Maç Kazan</option>
                        <option value="money_banked">Para Bankala</option>
                        <option value="cards_stolen">Mülk/Kart Çal</option>
                        <option value="sets_completed">Set Tamamla</option>
                        <option value="rent_collected">Kira Topla</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Hedef Değer</label>
                      <input
                        type="number"
                        min="1"
                        value={newQuestTarget}
                        onChange={(e) => setNewQuestTarget(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Altın Ödülü</label>
                      <input
                        type="number"
                        min="1"
                        value={newQuestCoins}
                        onChange={(e) => setNewQuestCoins(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">XP Ödülü</label>
                      <input
                        type="number"
                        min="1"
                        value={newQuestXp}
                        onChange={(e) => setNewQuestXp(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold cursor-pointer"
                >
                  Görevi Havuza Ekle
                </button>
              </form>

              {/* Active Quests Pool List */}
              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 space-y-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Aktif Görev Havuzu ({quests.length})</span>
                <div className="space-y-2">
                  {quests.map((q) => (
                    <div key={q.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-200">{q.description}</p>
                          <span className="px-2 py-0.5 rounded bg-slate-850 border border-slate-800 text-[9px] text-indigo-400 uppercase font-mono">
                            {q.type === 'games_played' && 'Maç'}
                            {q.type === 'games_won' && 'Kazanma'}
                            {q.type === 'money_banked' && 'Bankalama'}
                            {q.type === 'cards_stolen' && 'Çalma'}
                            {q.type === 'sets_completed' && 'Set'}
                            {q.type === 'rent_collected' && 'Kira'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Hedef: {q.targetValue} | Ödül: {q.rewardCoins} Altın, {q.rewardXp} XP</p>
                      </div>
                      <button
                        onClick={() => handleDeleteQuest(q.id)}
                        className="p-2 px-3 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold transition-all cursor-pointer text-[10px]"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                  {quests.length === 0 && (
                    <p className="text-slate-500 text-center py-6 text-xs">Havuzda tanımlı özel görev yok. Sunucu yerel varsayılanları kullanacak.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: ACHIEVEMENTS */}
          {activeTab === 'achievements' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Kalıcı Başarımlar & Rozetler</h3>
                <p className="text-xs text-slate-500 mt-1">Kullanıcıların ömür boyu kilidini açabileceği başarımları ve rozetleri tasarlayın. Oyuncuların ilerlemeleri kalıcı olarak izlenir.</p>
              </div>

              {/* Add achievement form */}
              <form onSubmit={handleAddAchievement} className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-bold">Yeni Kalıcı Başarım Ekle</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Başarım Başlığı</label>
                      <input
                        type="text"
                        required
                        placeholder="Örn: Emlak Kralı"
                        value={newAchTitle}
                        onChange={(e) => setNewAchTitle(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Açıklama / Koşul Metni</label>
                      <input
                        type="text"
                        required
                        placeholder="Örn: Toplamda 15 mülk seti tamamla."
                        value={newAchDesc}
                        onChange={(e) => setNewAchDesc(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Eylem Tipi</label>
                      <select
                        value={newAchType}
                        onChange={(e) => setNewAchType(e.target.value)}
                        className="w-full px-2 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="games_played">Toplam Maç</option>
                        <option value="games_won">Toplam Kazanma</option>
                        <option value="money_banked">Para Bankalama</option>
                        <option value="cards_stolen">Mülk/Kart Çalma</option>
                        <option value="sets_completed">Set Tamamlama</option>
                        <option value="rent_collected">Kira Toplama</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Eşik Değer (Hedef)</label>
                      <input
                        type="number"
                        min="1"
                        value={newAchTarget}
                        onChange={(e) => setNewAchTarget(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Altın Ödülü</label>
                      <input
                        type="number"
                        min="1"
                        value={newAchCoins}
                        onChange={(e) => setNewAchCoins(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold cursor-pointer"
                >
                  Başarımı Kaydet ve Yayınla
                </button>
              </form>

              {/* Achievements list */}
              <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 space-y-4">
                <span className="text-xs text-slate-400 uppercase tracking-wider block font-semibold">Mevcut Kalıcı Başarımlar ({achievements.length})</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {achievements.map((ach) => (
                    <div key={ach.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🏅</span>
                          <span className="font-bold text-slate-200">{ach.title}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[8px] text-amber-400 font-mono">
                            {ach.rewardCoins} 🪙
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed">{ach.description}</p>
                        <p className="text-[10px] text-slate-500">
                          Eylem: <span className="font-mono text-indigo-400">{ach.type}</span> | Limit: <span className="text-slate-300 font-bold">{ach.targetValue}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAchievement(ach.id)}
                        className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold cursor-pointer text-[10px] transition-all"
                      >
                        Sil
                      </button>
                    </div>
                  ))}
                  {achievements.length === 0 && (
                    <p className="text-slate-500 col-span-2 text-center py-6 text-xs">Tanımlanmış başarım veya rozet yok.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">🏆 Turnuva Fabrikası & Katalog Yöneticisi</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Oyuncuların oynayabileceği kişiye özel bot turnuvalarını yapılandırın. Formatları (1v1, 4 Kişilik, 2v2 Takım), bot seviyelerini, kuralları ve ödülleri dilediğiniz gibi belirleyin.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form: Create or Edit Tournament */}
                <div className="lg:col-span-1 bg-slate-900/40 border border-slate-800 p-5 rounded-2xl space-y-4 h-fit">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs text-slate-300 uppercase tracking-wider block font-bold">
                      {editingTournamentId ? '✏️ Turnuvayı Düzenle' : '🏆 Yeni Turnuva Oluştur'}
                    </span>
                    {editingTournamentId && (
                      <button
                        onClick={handleCancelEdit}
                        className="text-[10px] text-rose-400 hover:underline font-bold cursor-pointer"
                      >
                        İptal Et
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveTournament} className="space-y-3.5">
                    {/* Turnuva Adı */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Turnuva Adı</label>
                      <input
                        type="text"
                        required
                        placeholder="Örn: 🥇 Şampiyonlar Arenası"
                        value={tournamentName}
                        onChange={(e) => setTournamentName(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>

                    {/* Turnuva Açıklaması */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Açıklama</label>
                      <input
                        type="text"
                        placeholder="Örn: 8 kişilik eleme kupası. Yeni taktikleri test edin!"
                        value={tournamentDescription}
                        onChange={(e) => setTournamentDescription(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Turnuva Formatı */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Oyun Formatı</label>
                      <select
                        value={tournamentFormat}
                        onChange={(e) => {
                          const fmt = e.target.value as any;
                          setTournamentFormat(fmt);
                          if (fmt === '2v2_team' || fmt === '4player') {
                            setTournamentMaxParticipants(4);
                          } else {
                            setTournamentMaxParticipants(8);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="1v1">🤺 1 vs 1 Düello Elemesi</option>
                        <option value="4player">👥 4 Kişilik Masa Turnuvası (Masa Birincileri Finalde)</option>
                        <option value="2v2_team">⚔️ 2 vs 2 Takım Şampiyonası (Bot Partner ile)</option>
                      </select>
                    </div>

                    {/* Bot Zorluk Seviyesi */}
                    <div className="space-y-1">
                      <label className="text-[10px] text-amber-400 uppercase font-bold flex items-center gap-1">
                        <span>🤖 Bot Zorluk Seviyesi</span>
                      </label>
                      <select
                        value={tournamentBotDifficulty}
                        onChange={(e) => setTournamentBotDifficulty(e.target.value as any)}
                        className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                      >
                        <option value="easy">🟢 Kolay (Acemi / Yeni Başlayan Botlar)</option>
                        <option value="medium">🟡 Orta (Standart Dengeli Botlar)</option>
                        <option value="hard">🔴 Zor (Kurnaz / Taktikçi Botlar)</option>
                        <option value="expert">🟣 Efsane / Grandmaster (Apex Usta Botlar)</option>
                      </select>
                    </div>

                    {/* Oyuncu Sayısı & Kademe */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Katılımcı Sayısı</label>
                        <select
                          value={tournamentMaxParticipants}
                          onChange={(e) => setTournamentMaxParticipants(Number(e.target.value))}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                        >
                          {tournamentFormat === '2v2_team' ? (
                            <>
                              <option value={4}>4 Katılımcı (2 Takım - Doğrudan Final)</option>
                              <option value={8}>8 Katılımcı (4 Takım - 2 Yarı Final + Final)</option>
                              <option value={16}>16 Katılımcı (8 Takım - 4 Çeyrek + Yarı + Final)</option>
                              <option value={32}>32 Katılımcı (16 Takım - Son 16 + Çeyrek + Final)</option>
                              <option value={64}>64 Katılımcı (32 Takım - Büyük Takım Ligi)</option>
                            </>
                          ) : tournamentFormat === '4player' ? (
                            <>
                              <option value={4}>4 Katılımcı (1 Masa - Tek Maç Final)</option>
                              <option value={8}>8 Katılımcı (2 Masa - Masaların 1.leri Finalde)</option>
                              <option value={12}>12 Katılımcı (3 Masa - Masaların 1.leri Finalde)</option>
                              <option value={16}>16 Katılımcı (4 Masa - Masaların 1.leri Finalde)</option>
                              <option value={32}>32 Katılımcı (8 Masa - Masaların 1.leri Yarı/Final)</option>
                              <option value={64}>64 Katılımcı (16 Masa - Büyük Masa Şampiyonası)</option>
                            </>
                          ) : (
                            <>
                              <option value={2}>2 Katılımcı (Tek Maç Düello)</option>
                              <option value={4}>4 Katılımcı (2 Yarı Final + Final)</option>
                              <option value={8}>8 Katılımcı (Çeyrek + Yarı + Final)</option>
                              <option value={16}>16 Katılımcı (Son 16 + Çeyrek + Yarı + Final)</option>
                              <option value={32}>32 Katılımcı (Son 32 + Son 16 + Çeyrek + Final)</option>
                              <option value={64}>64 Katılımcı (Devasa 64 Kişilik Nakavt Ligi)</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Kademe / Tier</label>
                        <select
                          value={tournamentTier}
                          onChange={(e) => setTournamentTier(e.target.value as any)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-bold"
                        >
                          <option value="bronze">🥉 Bronz Arena</option>
                          <option value="silver">🥈 Gümüş Kupa</option>
                          <option value="gold">🥇 Şampiyonlar Kupası</option>
                          <option value="legend">👑 Efsaneler Turnuvası</option>
                        </select>
                      </div>
                    </div>

                    {/* Oyun Kuralları: Hedef Set & Tur Süresi */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                      <div className="space-y-1">
                        <label className="text-[10px] text-indigo-400 uppercase font-bold">Hedef Set</label>
                        <select
                          value={tournamentTargetSets}
                          onChange={(e) => setTournamentTargetSets(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none"
                        >
                          <option value={2}>2 Tam Set (Hızlı)</option>
                          <option value={3}>3 Tam Set (Standart)</option>
                          <option value={4}>4 Tam Set (Uzun / Takım)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-indigo-400 uppercase font-bold">Hamle Süresi</label>
                        <select
                          value={tournamentTurnDuration}
                          onChange={(e) => setTournamentTurnDuration(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-900 border border-slate-800 text-slate-100 focus:outline-none"
                        >
                          <option value={20}>20 Saniye (Blitz)</option>
                          <option value={30}>30 Saniye (Standart)</option>
                          <option value={45}>45 Saniye (Geniş)</option>
                        </select>
                      </div>
                    </div>

                    {/* Ödüller & Giriş Ücreti */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Giriş (🪙)</label>
                        <input
                          type="number"
                          min={0}
                          value={tournamentEntryFee}
                          onChange={(e) => setTournamentEntryFee(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Ödül (🪙)</label>
                        <input
                          type="number"
                          min={0}
                          value={tournamentPrizeCoins}
                          onChange={(e) => setTournamentPrizeCoins(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold">Ödül (XP)</label>
                        <input
                          type="number"
                          min={0}
                          value={tournamentPrizeXp}
                          onChange={(e) => setTournamentPrizeXp(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-600 hover:from-indigo-500 hover:to-amber-500 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                    >
                      {editingTournamentId ? '💾 Turnuva Değişikliklerini Kaydet' : '🏆 Turnuvayı Kataloğa Ekle'}
                    </button>
                  </form>
                </div>

                {/* Tournaments List & Management */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300 uppercase tracking-wider block font-bold">
                        Aktif Turnuva Kataloğu ({tournaments.length})
                      </span>
                    </div>

                    <div className="space-y-3">
                      {tournaments.map((t) => (
                        <div
                          key={t.id}
                          className="p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base">{t.icon || '🏆'}</span>
                              <h4 className="font-extrabold text-white text-sm">{t.name}</h4>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                {t.format === '4player' ? '👥 4 Kişilik Masa' : (t.format === '2v2_team' ? '⚔️ 2v2 Takım' : '🤺 1v1 Düello')}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Bot: {t.botDifficulty || 'medium'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-400 leading-relaxed max-w-xl">
                              {t.description || 'Kişiye özel tek oyunculu bot turnuvası.'}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400 pt-1">
                              <span>🪙 Giriş: <strong className="text-white">{t.entryFee || 0}</strong></span>
                              <span>🏆 Ödül: <strong className="text-amber-300">{t.prizeCoins || 1000} 🪙</strong> + <strong className="text-indigo-300">{t.prizeXp || 300} XP</strong></span>
                              <span>👥 Katılımcı: <strong className="text-white">{t.maxParticipants || 8}</strong></span>
                              <span>🎯 Hedef: <strong className="text-white">{t.targetSets || 3} Set</strong></span>
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center gap-2 shrink-0 justify-end">
                            <button
                              onClick={() => handleEditTournament(t)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                            >
                              ✏️ Düzenle
                            </button>
                            <button
                              onClick={() => handleDeleteTournament(t.id)}
                              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold cursor-pointer transition-all active:scale-95"
                            >
                              🗑️ Sil
                            </button>
                          </div>
                        </div>
                      ))}
                      {tournaments.length === 0 && (
                        <p className="text-slate-500 text-center py-6 text-xs">Aktif veya kayıtlı turnuva şablonu bulunmamaktadır.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DYNAMIC TRANSLATIONS */}
          {activeTab === 'translations' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-4">
                <div>
                  <h3 className="text-base font-bold uppercase tracking-wider text-slate-200">Çoklu Dil & Kelime Düzenleyici</h3>
                  <p className="text-xs text-slate-500 mt-1">Oyun genelindeki tüm metinleri, kart adlarını ve butonları anlık olarak düzenleyin.</p>
                </div>
                <button
                  onClick={() => handleSaveTranslations()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg cursor-pointer"
                >
                  💾 Çevirileri Kaydet
                </button>
              </div>

              {/* Grid: Forms to Add Language & Keys */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Form 1: Add Language */}
                <form onSubmit={handleAddLanguage} className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-bold">Yeni Dil Ekle</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Dil Kodu (Örn: fr, de, es, ru)"
                      value={newLangCode}
                      onChange={(e) => setNewLangCode(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                    >
                      Ekle
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Yeni dil eklendiğinde, sistem otomatik olarak Türkçe (tr) dilindeki tüm kelimeleri yeni dile kopyalayacaktır.
                  </p>
                </form>

                {/* Form 2: Add Word/Key */}
                <form onSubmit={handleAddTranslationKey} className="bg-slate-900/30 border border-slate-800 p-5 rounded-2xl space-y-4">
                  <span className="text-xs text-slate-400 uppercase tracking-wider block font-bold">Yeni Kelime Anahtarı Ekle</span>
                  <div className="space-y-2">
                    <input
                      type="text"
                      required
                      placeholder="Kelime Anahtarı (Örn: lobby_welcome)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Varsayılan Değer (TR)"
                        value={newKeyDefaultVal}
                        onChange={(e) => setNewKeyDefaultVal(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
                      >
                        Anahtar Ekle
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Translation Editing Panel */}
              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-900 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 uppercase font-bold">Düzenlenecek Dil:</span>
                    <div className="flex gap-1">
                      {Object.keys(translations).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setEditingLang(lang)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer ${editingLang === lang
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Search Key Input */}
                  <input
                    type="text"
                    placeholder="Kelime ara..."
                    value={transSearch}
                    onChange={(e) => setTransSearch(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 focus:outline-none focus:border-indigo-500 w-full sm:w-48"
                  />
                </div>

                {/* Table of Keys */}
                <div className="max-h-[400px] overflow-y-auto border border-slate-850 rounded-xl scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        <th className="p-3 w-1/3 border-b border-slate-800">Anahtar</th>
                        <th className="p-3 w-2/3 border-b border-slate-800">Metin / Değer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {Object.keys(translations[editingLang] || {})
                        .filter(key => key.toLowerCase().includes(transSearch.toLowerCase()) || (translations[editingLang]?.[key] || '').toLowerCase().includes(transSearch.toLowerCase()))
                        .map((key) => (
                          <tr key={key} className="hover:bg-slate-900/25 transition-colors">
                            <td className="p-3 font-mono text-slate-400 select-all font-semibold break-all">{key}</td>
                            <td className="p-3">
                              <input
                                type="text"
                                value={translations[editingLang]?.[key] || ''}
                                onChange={(e) => handleTranslationChange(editingLang, key, e.target.value)}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-850 text-slate-200 focus:outline-none focus:border-indigo-600 focus:bg-slate-950 transition-all font-semibold"
                              />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'voices' && (
            <div className="space-y-6">
              <div className="border-b border-slate-900 pb-4">
                <h3 className="text-base font-bold uppercase tracking-wider text-slate-200">Karakter Seslendirmeleri Yönetimi</h3>
                <p className="text-xs text-slate-500 mt-1">Oynanan kart hamlelerinin seslendirme dosyalarını (.mp3) yükleyin ve test edin.</p>
              </div>

              <div className="bg-slate-900/20 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950/80 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                        <th className="p-3 border-b border-slate-800">Hamle / Kart</th>
                        <th className="p-3 border-b border-slate-800">Duyulma Kapsamı</th>
                        <th className="p-3 border-b border-slate-800">Dosya Adı</th>
                        <th className="p-3 border-b border-slate-800 text-center">Türkçe Ses (TR)</th>
                        <th className="p-3 border-b border-slate-800 text-center">İngilizce Ses (EN)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40 text-xs">
                      {voices.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-900/25 transition-colors">
                          <td className="p-3 font-semibold text-slate-200">{item.name}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.scope === 'global'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : item.scope === 'duel'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                              }`}>
                              {item.scope === 'global'
                                ? 'Herkes (Küresel)'
                                : item.scope === 'duel'
                                  ? 'Aktör ve Hedef'
                                  : 'Sadece Aktör'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-400 text-[11px]">{item.filename}</td>

                          {/* TR Column */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {item.trExists ? (
                                <button
                                  onClick={() => playPreview(item.filename, 'tr')}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold border border-emerald-500/30 rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1"
                                >
                                  🔊 Dinle
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-semibold italic">Yüklenmedi</span>
                              )}

                              <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[10px] transition-all cursor-pointer border border-slate-750 flex items-center justify-center min-w-[70px]">
                                {uploadLoading === `${item.id}_tr` ? (
                                  <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-slate-300 border-t-transparent rounded-full" />
                                ) : (
                                  'Dosya Seç'
                                )}
                                <input
                                  type="file"
                                  accept=".mp3"
                                  onChange={(e) => handleUploadVoice(e, item, 'tr')}
                                  className="hidden"
                                  disabled={uploadLoading !== null}
                                />
                              </label>
                            </div>
                          </td>

                          {/* EN Column */}
                          <td className="p-3">
                            <div className="flex items-center justify-center gap-2">
                              {item.enExists ? (
                                <button
                                  onClick={() => playPreview(item.filename, 'en')}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold border border-emerald-500/30 rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1"
                                >
                                  🔊 Dinle
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-semibold italic">Yüklenmedi</span>
                              )}

                              <label className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-lg text-[10px] transition-all cursor-pointer border border-slate-750 flex items-center justify-center min-w-[70px]">
                                {uploadLoading === `${item.id}_en` ? (
                                  <span className="animate-spin inline-block w-2.5 h-2.5 border-2 border-slate-300 border-t-transparent rounded-full" />
                                ) : (
                                  'Dosya Seç'
                                )}
                                <input
                                  type="file"
                                  accept=".mp3"
                                  onChange={(e) => handleUploadVoice(e, item, 'en')}
                                  className="hidden"
                                  disabled={uploadLoading !== null}
                                />
                              </label>
                            </div>
                          </td>

                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SHOP MANAGEMENT */}
          {activeTab === 'shop' && (() => {
            const filteredShopItems = shopItems.filter((item) => {
              const matchesCategory = shopCategoryFilter === 'all' || item.category === shopCategoryFilter;
              const matchesSearch = item.name.toLowerCase().includes(shopSearch.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(shopSearch.toLowerCase()));
              return matchesCategory && matchesSearch;
            });

            const mediaItemsCount = shopItems.filter(i => !!i.mediaUrl).length;

            return (
              <div className="space-y-6">
                {/* Header & Stats Bar */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>🛍️</span> Mağaza Ürün Katalog Yönetimi
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Mağazaya dinamik resim, GIF animasyonu veya video içerikli yeni ürünler ekleyin, düzenleyin veya kaldırın.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddShopModal}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer flex items-center gap-2"
                  >
                    <span>➕</span> Yeni Ürün Ekle
                  </button>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
                    <span className="text-3xl">📦</span>
                    <div>
                      <div className="text-xl font-bold text-white">{shopItems.length}</div>
                      <div className="text-xs text-slate-400">Toplam Mağaza Ürünü</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
                    <span className="text-3xl">🎬</span>
                    <div>
                      <div className="text-xl font-bold text-emerald-400">{mediaItemsCount}</div>
                      <div className="text-xs text-slate-400">Özel Medyalı (GIF/Video/Resim)</div>
                    </div>
                  </div>
                  <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center gap-3">
                    <span className="text-3xl">📂</span>
                    <div>
                      <div className="text-xl font-bold text-amber-400">9 Kategori</div>
                      <div className="text-xs text-slate-400">Avatar, Tahta, Kaplama vs.</div>
                    </div>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                  <div className="w-full md:w-64 relative">
                    <input
                      type="text"
                      placeholder="Ürün adı veya açıklama ara..."
                      value={shopSearch}
                      onChange={(e) => setShopSearch(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                    {shopSearch && (
                      <button
                        onClick={() => setShopSearch('')}
                        className="absolute right-3 top-2 text-slate-500 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                    {[
                      { id: 'all', label: 'Tümü' },
                      { id: 'avatar', label: '👑 Avatar' },
                      { id: 'card_back', label: '🃏 Kart Görünümü' },
                      { id: 'board_theme', label: '🎨 Masa Teması' },
                      { id: 'card_skin', label: '✨ Kart Kaplaması' },
                      { id: 'player_board', label: '🏆 Oyuncu Tahtası' },
                      { id: 'profile_frame', label: '🖼️ Profil Çerçevesi' },
                      { id: 'celebration_sound', label: '🎵 Zafer Sesi' },
                      { id: 'action_vfx', label: '💥 Efektler' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setShopCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${shopCategoryFilter === cat.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Products Table Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredShopItems.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/20 rounded-2xl border border-slate-800 border-dashed">
                      <span className="text-4xl block mb-2">🔍</span>
                      Aramanıza veya seçilen kategoriye uygun ürün bulunamadı.
                    </div>
                  ) : (
                    filteredShopItems.map((item) => (
                      <div
                        key={item.id}
                        className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-lg group relative overflow-hidden"
                      >
                        <div>
                          {/* Media Preview Box */}
                          <div className="w-full h-36 bg-slate-950 border border-slate-850 rounded-xl overflow-hidden relative flex items-center justify-center mb-3 group-hover:border-indigo-500/30 transition-all">
                            {item.mediaUrl ? (
                              isVideoUrl(item.mediaUrl, item.mediaType) ? (
                                <HlsVideoPlayer
                                  src={item.mediaUrl}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img
                                  src={item.mediaUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-600">
                                <span className="text-3xl">🎨</span>
                                <span className="text-[10px] font-mono">Varsayılan Tematik Görünüm</span>
                              </div>
                            )}

                            {/* Badge */}
                            <div className="absolute top-2 right-2 bg-slate-900/90 border border-slate-750 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-slate-300">
                              {item.mediaUrl ? (
                                isVideoUrl(item.mediaUrl, item.mediaType) ? '🎬 VİDEO' :
                                  item.mediaType === 'gif' || item.mediaUrl.endsWith('.gif') ? '✨ GIF' : '🖼️ RESİM'
                              ) : (
                                '⚙️ STANDART'
                              )}
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-bold text-white text-sm line-clamp-1">{item.name}</h4>
                            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 font-extrabold text-xs rounded-full whitespace-nowrap">
                              💰 {item.price} Altın
                            </span>
                          </div>

                          <p className="text-slate-400 text-xs line-clamp-2 mb-3 min-h-[32px]">
                            {item.description || 'Açıklama belirtilmedi.'}
                          </p>
                        </div>

                        {/* Category & Action Buttons */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-950 px-2 py-1 rounded-md">
                            {item.category}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditShopModal(item)}
                              className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              ✏️ Düzenle
                            </button>
                            <button
                              onClick={() => handleDeleteShopItem(item.id, item.name)}
                              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              🗑️ Sil
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* ADD / EDIT PRODUCT MODAL */}
                {isShopModalOpen && (
                  <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[100] p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl p-6 relative shadow-2xl overflow-y-auto max-h-[92vh] space-y-5">
                      {/* Modal Header */}
                      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-xl">
                            {editingShopItem ? '✏️' : '✨'}
                          </div>
                          <div>
                            <h3 className="text-base font-extrabold text-white">
                              {editingShopItem ? 'Mağaza Ürününü Düzenle' : 'Yeni Mağaza Ürünü Ekle'}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              Oyun içinde anında canlı görünecek tüm görsel, gradyan, efekt ve kilit ayarlarını belirleyin.
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (isPlayingShopAudio && shopAudioPlayer) shopAudioPlayer.pause();
                            setIsShopModalOpen(false);
                          }}
                          className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Sub-Tabs Selector */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-slate-800">
                        {[
                          { id: 'basic', label: '📌 Temel Bilgi', desc: 'İsim, Kategori, Fiyat' },
                          { id: 'design', label: '🎨 Tasarım & FX', desc: 'Gradyan, Kenarlık, Glow' },
                          { id: 'media', label: '🎬 Medya & Ses', desc: 'Görsel, Video, MP3' },
                          { id: 'locks', label: '🔒 Kilit & Rozet', desc: 'Seviye, Lig, Rozet' },
                        ].map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setShopModalTab(tab.id as any)}
                            className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center ${shopModalTab === tab.id
                              ? 'bg-indigo-600 text-white font-extrabold shadow-md shadow-indigo-600/30'
                              : 'text-slate-400 hover:text-white hover:bg-slate-900 font-medium'
                              }`}
                          >
                            <span className="text-xs">{tab.label}</span>
                            <span className="text-[8.5px] opacity-70 hidden sm:inline">{tab.desc}</span>
                          </button>
                        ))}
                      </div>

                      <form onSubmit={handleSaveShopItem} className="space-y-4">
                        {/* ──────────────────────────────────────────────────────────
                            TAB 1: TEMEL BİLGİLER
                        ────────────────────────────────────────────────────────── */}
                        {shopModalTab === 'basic' && (
                          <div className="space-y-4 animate-fadeIn">
                            <div>
                              <label className="block text-xs font-bold text-slate-300 mb-1">
                                Ürün Adı *
                              </label>
                              <input
                                type="text"
                                required
                                placeholder="Örn: Efsanevi Siber Ejderha Avatarı"
                                value={shopForm.name}
                                onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Kategori *
                                </label>
                                <select
                                  value={shopForm.category}
                                  onChange={(e) => setShopForm({ ...shopForm, category: e.target.value as any })}
                                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
                                >
                                  <option value="avatar">👑 Avatar</option>
                                  <option value="card_back">🃏 Kart Görünümü (Arkası)</option>
                                  <option value="board_theme">🎨 Masa Teması</option>
                                  <option value="card_skin">✨ Kart Kaplaması</option>
                                  <option value="player_board">🏆 Oyuncu Tahtası</option>
                                  <option value="profile_frame">🖼️ Profil Çerçevesi</option>
                                  <option value="celebration_sound">🎵 Zafer Sesi</option>
                                  <option value="action_vfx">💥 Efekt (VFX)</option>
                                  <option value="game_music">🎶 Maç Fon Müziği</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Fiyat (Altın Miktarı) *
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    required
                                    value={shopForm.price}
                                    onChange={(e) => setShopForm({ ...shopForm, price: Number(e.target.value) })}
                                    className="w-full px-3.5 py-2.5 pl-8 bg-slate-950 border border-slate-800 rounded-xl text-xs text-amber-300 font-black focus:outline-none focus:border-indigo-500"
                                  />
                                  <span className="absolute left-2.5 top-2.5 text-xs">💰</span>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Enderlik Seviyesi (Rarity) *
                                </label>
                                <select
                                  value={shopForm.rarity}
                                  onChange={(e) => setShopForm({ ...shopForm, rarity: e.target.value as any })}
                                  className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                >
                                  <option value="common">⚪ Yaygın (Common)</option>
                                  <option value="rare">🔵 Nadir (Rare)</option>
                                  <option value="epic">🟣 Epik (Epic)</option>
                                  <option value="legendary">🟡 Efsanevi (Legendary)</option>
                                  <option value="mythic">🔥 Mistik (Mythic)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  İndirim Yüzdesi (%)
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="90"
                                    value={shopForm.discountPercent}
                                    onChange={(e) => setShopForm({ ...shopForm, discountPercent: Number(e.target.value) })}
                                    placeholder="0 (İndirim yok)"
                                    className="w-full px-3.5 py-2.5 pr-7 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                                  />
                                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">%</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-300 mb-1">
                                Açıklama & Hikaye
                              </label>
                              <textarea
                                rows={2}
                                placeholder="Ürünün özelliklerini ve görünümünü açıklayın..."
                                value={shopForm.description}
                                onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })}
                                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-normal"
                              />
                            </div>
                          </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            TAB 2: TASARIM & GÖRSEL EFEKTLER
                        ────────────────────────────────────────────────────────── */}
                        {shopModalTab === 'design' && (
                          <div className="space-y-4 animate-fadeIn">
                            {/* Gradient Background Controls */}
                            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                              <span className="text-[11px] font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🌈</span> Arka Plan Gradyan & Renkleri (CSS Gradient)
                              </span>
                              <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Başlangıç Rengi</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={shopForm.gradientStart || '#3b82f6'}
                                      onChange={(e) => setShopForm({ ...shopForm, gradientStart: e.target.value })}
                                      className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                                    />
                                    <input
                                      type="text"
                                      value={shopForm.gradientStart}
                                      onChange={(e) => setShopForm({ ...shopForm, gradientStart: e.target.value })}
                                      placeholder="#3b82f6"
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-white"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Bitiş Rengi</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={shopForm.gradientEnd || '#ec4899'}
                                      onChange={(e) => setShopForm({ ...shopForm, gradientEnd: e.target.value })}
                                      className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                                    />
                                    <input
                                      type="text"
                                      value={shopForm.gradientEnd}
                                      onChange={(e) => setShopForm({ ...shopForm, gradientEnd: e.target.value })}
                                      placeholder="#ec4899"
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-white"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Gradyan Yönü</span>
                                  <select
                                    value={shopForm.gradientDirection}
                                    onChange={(e) => setShopForm({ ...shopForm, gradientDirection: e.target.value as any })}
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none"
                                  >
                                    <option value="to-br">↘️ Çapraz (Sağ-Alt)</option>
                                    <option value="to-r">➡️ Sağa (Yatay)</option>
                                    <option value="to-b">⬇️ Aşağı (Dikey)</option>
                                    <option value="to-tr">↗️ Çapraz (Sağ-Üst)</option>
                                    <option value="radial">🔘 Radyal (Merkezden)</option>
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Border & Outline Controls */}
                            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                              <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🔲</span> Kenarlık Stili & Işıltısı (Border FX)
                              </span>
                              <div className="grid grid-cols-3 gap-2.5">
                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Kenarlık Tipi</span>
                                  <select
                                    value={shopForm.borderStyle}
                                    onChange={(e) => setShopForm({ ...shopForm, borderStyle: e.target.value as any })}
                                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-white focus:outline-none font-medium"
                                  >
                                    <option value="solid">Düz Çizgi (Solid)</option>
                                    <option value="gold_ornate">👑 Altın İşlemeli</option>
                                    <option value="cyber_dashed">⚡ Siber Kesikli</option>
                                    <option value="neon_glow">💡 Neon Işıltılı</option>
                                    <option value="fiery">🔥 Alevli Kor</option>
                                    <option value="none">Kenarlık Yok</option>
                                  </select>
                                </div>

                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Kalınlık: {shopForm.borderWidth}px</span>
                                  <input
                                    type="range"
                                    min="1"
                                    max="5"
                                    value={shopForm.borderWidth}
                                    onChange={(e) => setShopForm({ ...shopForm, borderWidth: Number(e.target.value) })}
                                    className="w-full h-2 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-500 mt-2"
                                  />
                                </div>

                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Kenarlık Rengi</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={shopForm.borderColor || '#334155'}
                                      onChange={(e) => setShopForm({ ...shopForm, borderColor: e.target.value })}
                                      className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                                    />
                                    <input
                                      type="text"
                                      value={shopForm.borderColor}
                                      onChange={(e) => setShopForm({ ...shopForm, borderColor: e.target.value })}
                                      placeholder="#334155"
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Glow, Animation & Particles */}
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="block text-xs font-bold text-slate-300 mb-1">Animasyon Tipi</span>
                                <select
                                  value={shopForm.animType}
                                  onChange={(e) => setShopForm({ ...shopForm, animType: e.target.value as any })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none font-semibold"
                                >
                                  <option value="none">Yok (Statik)</option>
                                  <option value="pulse">💓 Nefes Alma (Pulse)</option>
                                  <option value="floating">🌊 Yüzen / Dalgalanan (Floating)</option>
                                  <option value="shimmer">✨ Hologram Işıltısı (Shimmer)</option>
                                  <option value="rainbow_wave">🌈 RGB Gökkuşağı Dalgası</option>
                                  <option value="spin_glow">🌀 Dönen Parıltı (Spin Glow)</option>
                                </select>
                              </div>

                              <div>
                                <span className="block text-xs font-bold text-slate-300 mb-1">Parçacık Efekti (Particle FX)</span>
                                <select
                                  value={shopForm.particleEffect}
                                  onChange={(e) => setShopForm({ ...shopForm, particleEffect: e.target.value as any })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none font-semibold"
                                >
                                  <option value="none">Yok (None)</option>
                                  <option value="sparkles">✨ Işıltı Sparkles</option>
                                  <option value="fire">🔥 Alev Embers</option>
                                  <option value="snow">❄️ Kar Taneleri</option>
                                  <option value="matrix">🟢 Matrix Kod Yağmuru</option>
                                  <option value="bubbles">🫧 Sualtı Baloncukları</option>
                                  <option value="stars">⭐ Yıldız Parlamaları</option>
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <span className="block text-xs font-bold text-slate-300 mb-1">Işıldama / Glow Rengi</span>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={shopForm.glowColor || '#6366f1'}
                                    onChange={(e) => setShopForm({ ...shopForm, glowColor: e.target.value })}
                                    className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer p-0.5"
                                  />
                                  <input
                                    type="text"
                                    value={shopForm.glowColor}
                                    onChange={(e) => setShopForm({ ...shopForm, glowColor: e.target.value })}
                                    placeholder="#6366f1"
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white"
                                  />
                                </div>
                              </div>

                              <div>
                                <span className="block text-xs font-bold text-slate-300 mb-1">
                                  Overlay Opaklık: %{Math.round(shopForm.overlayOpacity * 100)}
                                </span>
                                <input
                                  type="range"
                                  min="0.1"
                                  max="1.0"
                                  step="0.05"
                                  value={shopForm.overlayOpacity}
                                  onChange={(e) => setShopForm({ ...shopForm, overlayOpacity: parseFloat(e.target.value) })}
                                  className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500 mt-3"
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            TAB 3: MEDYA & SES
                        ────────────────────────────────────────────────────────── */}
                        {shopModalTab === 'media' && (
                          <div className="space-y-4 animate-fadeIn">
                            {/* Visual Media Upload */}
                            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                              <label className="block text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🎬</span> Görsel / GIF / Video Dosyası
                              </label>

                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  { id: 'image', label: '🖼️ Resim' },
                                  { id: 'gif', label: '✨ GIF' },
                                  { id: 'video', label: '🎬 Video' },
                                ].map((mt) => (
                                  <button
                                    type="button"
                                    key={mt.id}
                                    onClick={() => setShopForm({ ...shopForm, mediaType: mt.id as any })}
                                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border ${shopForm.mediaType === mt.id
                                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                                      }`}
                                  >
                                    {mt.label}
                                  </button>
                                ))}
                              </div>

                              <div className="space-y-2">
                                <label className="w-full py-2.5 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold border border-indigo-500/40 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2">
                                  {shopMediaUploading ? (
                                    <>
                                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-indigo-300 border-t-transparent rounded-full" />
                                      Yükleniyor...
                                    </>
                                  ) : (
                                    <>
                                      <span>📤</span> Cihazdan Görsel / GIF / Video Seç
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/*,video/mp4,video/webm,application/x-mpegURL,application/vnd.apple.mpegurl,.m3u8"
                                    onChange={(e) => handleShopFileUpload(e, false)}
                                    className="hidden"
                                    disabled={shopMediaUploading}
                                  />
                                </label>

                                <input
                                  type="text"
                                  placeholder="veya Medya URL: https://domain.com/media.gif veya /assets/uploads/..."
                                  value={shopForm.mediaUrl}
                                  onChange={(e) => {
                                    const url = e.target.value;
                                    let autoType = shopForm.mediaType;
                                    if (isVideoUrl(url)) autoType = 'video';
                                    else if (url.toLowerCase().includes('.gif')) autoType = 'gif';
                                    setShopForm({ ...shopForm, mediaUrl: url, mediaType: autoType });
                                  }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                />
                              </div>
                            </div>

                            {/* Audio / Music Upload */}
                            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                              <label className="block text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🎵</span> Özel Zafer Sesi / Fon Müziği (MP3 / WAV / OGG)
                              </label>

                              <div className="space-y-2">
                                <label className="w-full py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold border border-emerald-500/40 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-2">
                                  {shopMediaUploading ? (
                                    <>
                                      <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full" />
                                      Yükleniyor...
                                    </>
                                  ) : (
                                    <>
                                      <span>🎙️</span> Cihazdan Ses / Müzik Dosyası Seç (MP3/WAV/OGG)
                                    </>
                                  )}
                                  <input
                                    type="file"
                                    accept="audio/*,.mp3,.wav,.ogg"
                                    onChange={(e) => handleShopFileUpload(e, true)}
                                    className="hidden"
                                    disabled={shopMediaUploading}
                                  />
                                </label>

                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Ses URL: /assets/sounds/voices/tr/victory.mp3 veya online URL"
                                    value={shopForm.audioUrl}
                                    onChange={(e) => setShopForm({ ...shopForm, audioUrl: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                                  />
                                  {shopForm.audioUrl && (
                                    <button
                                      type="button"
                                      onClick={() => toggleShopAudioPreview()}
                                      className={`px-3 py-2 rounded-xl text-xs font-black shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${isPlayingShopAudio
                                        ? 'bg-rose-600 text-white animate-pulse'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                                        }`}
                                    >
                                      <span>{isPlayingShopAudio ? '⏸️ Durdur' : '▶️ Dinle'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            TAB 4: KİLİT & ÖZEL ROZET ŞARTLARI
                        ────────────────────────────────────────────────────────── */}
                        {shopModalTab === 'locks' && (
                          <div className="space-y-4 animate-fadeIn">
                            {/* Custom Badge Creator */}
                            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
                              <span className="text-[11px] font-black text-pink-300 uppercase tracking-wider flex items-center gap-1.5">
                                <span>🏷️</span> Ürün Köşe Rozeti (Custom Badge)
                              </span>
                              <div className="grid grid-cols-3 gap-2.5">
                                <div className="col-span-1">
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Rozet Metni</span>
                                  <input
                                    type="text"
                                    placeholder="Örn: 🔥 YENİ"
                                    value={shopForm.badgeText}
                                    onChange={(e) => setShopForm({ ...shopForm, badgeText: e.target.value })}
                                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                                  />
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Rozet Arka Planı</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={shopForm.badgeBg || '#ef4444'}
                                      onChange={(e) => setShopForm({ ...shopForm, badgeBg: e.target.value })}
                                      className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                                    />
                                    <input
                                      type="text"
                                      value={shopForm.badgeBg}
                                      onChange={(e) => setShopForm({ ...shopForm, badgeBg: e.target.value })}
                                      placeholder="#ef4444"
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-white"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <span className="block text-[10px] text-slate-400 font-semibold mb-1">Rozet Yazı Rengi</span>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={shopForm.badgeColor || '#ffffff'}
                                      onChange={(e) => setShopForm({ ...shopForm, badgeColor: e.target.value })}
                                      className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer p-0.5"
                                    />
                                    <input
                                      type="text"
                                      value={shopForm.badgeColor}
                                      onChange={(e) => setShopForm({ ...shopForm, badgeColor: e.target.value })}
                                      placeholder="#ffffff"
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-white"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Unlock Restrictions & Stock */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Kilit Seviyesi (Level)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="0 (Kilit Yok)"
                                  value={shopForm.requiredLevel || ''}
                                  onChange={(e) => setShopForm({ ...shopForm, requiredLevel: Number(e.target.value) })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                                />
                                <span className="text-[9px] text-slate-500 mt-0.5 block">Örn: 10 = Sadece Seviye 10+</span>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Kilit Ligi
                                </label>
                                <select
                                  value={shopForm.requiredLeague}
                                  onChange={(e) => setShopForm({ ...shopForm, requiredLeague: e.target.value })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                                >
                                  <option value="">Kilit Yok (Tüm Ligler)</option>
                                  <option value="bronze">🥉 Bronz ve Üzeri</option>
                                  <option value="silver">🥈 Gümüş ve Üzeri</option>
                                  <option value="gold">🥇 Altın ve Üzeri</option>
                                  <option value="platinum">💎 Platin ve Üzeri</option>
                                  <option value="diamond">💠 Elmas ve Üzeri</option>
                                  <option value="champion">🏆 Şampiyon Ligi</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1">
                                  Sınırlı Stok Limiti
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Boş = Sınırsız"
                                  value={shopForm.stockLimit}
                                  onChange={(e) => setShopForm({ ...shopForm, stockLimit: e.target.value === '' ? '' : Number(e.target.value) })}
                                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none"
                                />
                                <span className="text-[9px] text-slate-500 mt-0.5 block">Örn: 50 = Toplam 50 adet</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ──────────────────────────────────────────────────────────
                            CANLI İNTERAKTİF ÖNİZLEME KUTUSU (ALL TABS)
                        ────────────────────────────────────────────────────────── */}
                        <div className="p-3.5 bg-slate-950 border border-slate-800/90 rounded-2xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1.5">
                              <span>👁️</span> Canlı Önizleme (Oyunda Böyle Görünecek):
                            </span>
                            <div className="flex items-center gap-1.5">
                              {shopForm.discountPercent > 0 && (
                                <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-full shadow-md animate-bounce">
                                  %{shopForm.discountPercent} İNDİRİM
                                </span>
                              )}
                              {shopForm.requiredLevel > 0 && (
                                <span className="bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                  Lv.{shopForm.requiredLevel}+
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Dynamic Card Container */}
                          <div
                            className={`relative w-full h-44 rounded-2xl overflow-hidden flex items-center justify-center transition-all ${shopForm.animType === 'pulse' ? 'animate-pulse' :
                              shopForm.animType === 'floating' ? 'animate-bounce' :
                                shopForm.animType === 'shimmer' ? 'shadow-[inset_0_0_30px_rgba(255,255,255,0.3)]' :
                                  ''
                              }`}
                            style={{
                              background: shopForm.gradientStart && shopForm.gradientEnd
                                ? shopForm.gradientDirection === 'radial'
                                  ? `radial-gradient(circle, ${shopForm.gradientStart}, ${shopForm.gradientEnd})`
                                  : `linear-gradient(${shopForm.gradientDirection === 'to-r' ? '90deg' :
                                    shopForm.gradientDirection === 'to-b' ? '180deg' :
                                      shopForm.gradientDirection === 'to-tr' ? '45deg' : '135deg'
                                  }, ${shopForm.gradientStart}, ${shopForm.gradientEnd})`
                                : shopForm.previewColor || '#090d16',
                              borderColor: shopForm.borderColor || shopForm.glowColor || '#334155',
                              borderWidth: `${shopForm.borderWidth || 1}px`,
                              borderStyle: shopForm.borderStyle === 'cyber_dashed' ? 'dashed' : shopForm.borderStyle === 'none' ? 'none' : 'solid',
                              boxShadow: shopForm.glowColor
                                ? `0 0 25px ${shopForm.glowColor}66, inset 0 0 15px ${shopForm.glowColor}33`
                                : '0 4px 15px rgba(0,0,0,0.6)'
                            }}
                          >
                            {/* Rarity Badge Overlay (Top-Left) */}
                            <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none flex flex-col gap-1">
                              <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-wider shadow-md backdrop-blur-md ${shopForm.rarity === 'mythic' ? 'bg-gradient-to-r from-red-600/90 via-pink-600/90 to-purple-600/90 text-white border-pink-400 animate-pulse' :
                                shopForm.rarity === 'legendary' ? 'bg-amber-500/90 text-amber-100 border-amber-300 animate-pulse' :
                                  shopForm.rarity === 'epic' ? 'bg-purple-600/90 text-purple-100 border-purple-400' :
                                    shopForm.rarity === 'rare' ? 'bg-blue-600/90 text-blue-100 border-blue-400' :
                                      'bg-slate-800/80 text-slate-300 border-slate-600'
                                }`}>
                                {shopForm.rarity === 'mythic' ? '🔥 MİSTİK' :
                                  shopForm.rarity === 'legendary' ? '🟡 EFSANEVİ' :
                                    shopForm.rarity === 'epic' ? '🟣 EPİK' :
                                      shopForm.rarity === 'rare' ? '🔵 NADİR' : '⚪ YAYGIN'}
                              </span>

                              {/* Custom Badge Text if defined */}
                              {shopForm.badgeText && (
                                <span
                                  className="px-2 py-0.5 rounded-md text-[8.5px] font-black shadow uppercase tracking-wider self-start"
                                  style={{
                                    backgroundColor: shopForm.badgeBg || '#ef4444',
                                    color: shopForm.badgeColor || '#ffffff'
                                  }}
                                >
                                  {shopForm.badgeText}
                                </span>
                              )}
                            </div>

                            {/* Media / Video / Image with Overlay Opacity and Blend Mode */}
                            {shopForm.mediaUrl ? (
                              isVideoUrl(shopForm.mediaUrl, shopForm.mediaType) ? (
                                <HlsVideoPlayer
                                  src={shopForm.mediaUrl}
                                  style={{
                                    opacity: shopForm.overlayOpacity,
                                    mixBlendMode: (shopForm.overlayMode as any) || 'normal'
                                  }}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img
                                  src={shopForm.mediaUrl}
                                  alt="Önizleme"
                                  style={{
                                    opacity: shopForm.overlayOpacity,
                                    mixBlendMode: (shopForm.overlayMode as any) || 'normal'
                                  }}
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-1 text-slate-400">
                                <span className="text-3xl">
                                  {shopForm.category === 'avatar' ? '👑' :
                                    shopForm.category === 'card_back' ? '🃏' :
                                      shopForm.category === 'board_theme' ? '🎨' :
                                        shopForm.category === 'player_board' ? '🏆' :
                                          shopForm.category === 'celebration_sound' ? '🎵' : '✨'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 font-bold">
                                  {shopForm.name || 'Özel Tema Görünümü'}
                                </span>
                              </div>
                            )}

                            {/* Simulated Particle Effect Overlay */}
                            {shopForm.particleEffect && shopForm.particleEffect !== 'none' && (
                              <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                                {shopForm.particleEffect === 'sparkles' && (
                                  <div className="absolute inset-0 flex items-center justify-around text-amber-300 text-lg">
                                    <span className="animate-bounce">✨</span>
                                    <span className="animate-pulse delay-100">🌟</span>
                                    <span className="animate-bounce delay-200">✨</span>
                                  </div>
                                )}
                                {shopForm.particleEffect === 'fire' && (
                                  <div className="absolute inset-x-0 bottom-1 flex justify-around text-rose-500 text-xl animate-bounce">
                                    <span>🔥</span>
                                    <span className="delay-75">💥</span>
                                    <span className="delay-150">🔥</span>
                                  </div>
                                )}
                                {shopForm.particleEffect === 'snow' && (
                                  <div className="absolute inset-0 flex justify-around items-center text-blue-200 text-sm">
                                    <span className="animate-bounce">❄️</span>
                                    <span>🌨️</span>
                                    <span className="animate-bounce delay-100">❄️</span>
                                  </div>
                                )}
                                {shopForm.particleEffect === 'matrix' && (
                                  <div className="absolute inset-0 font-mono text-[10px] text-emerald-400 opacity-80 flex justify-between p-2">
                                    <span>01010</span>
                                    <span>11001</span>
                                    <span>00110</span>
                                  </div>
                                )}
                                {shopForm.particleEffect === 'bubbles' && (
                                  <div className="absolute inset-0 flex justify-around items-center text-cyan-300 text-base">
                                    <span>🫧</span>
                                    <span className="animate-bounce">🫧</span>
                                    <span>🫧</span>
                                  </div>
                                )}
                                {shopForm.particleEffect === 'stars' && (
                                  <div className="absolute inset-0 flex justify-around items-center text-yellow-300 text-sm">
                                    <span className="animate-ping">⭐</span>
                                    <span className="animate-pulse delay-150">⭐</span>
                                    <span className="animate-ping delay-300">⭐</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Contextual HUD label inside preview */}
                            <div className="absolute bottom-2 right-2 z-30 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white font-bold border border-white/10 flex items-center gap-1.5">
                              {shopForm.audioUrl && <span>🎵</span>}
                              <span>{shopForm.name || 'Ürün Adı'}</span>
                              <span className="text-amber-300 font-black">💰 {shopForm.price}</span>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const tabs: ('basic' | 'design' | 'media' | 'locks')[] = ['basic', 'design', 'media', 'locks'];
                                const currIdx = tabs.indexOf(shopModalTab);
                                if (currIdx > 0) setShopModalTab(tabs[currIdx - 1]);
                              }}
                              disabled={shopModalTab === 'basic'}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              ← Önceki Sekme
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const tabs: ('basic' | 'design' | 'media' | 'locks')[] = ['basic', 'design', 'media', 'locks'];
                                const currIdx = tabs.indexOf(shopModalTab);
                                if (currIdx < tabs.length - 1) setShopModalTab(tabs[currIdx + 1]);
                              }}
                              disabled={shopModalTab === 'locks'}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              Sonraki Sekme →
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (isPlayingShopAudio && shopAudioPlayer) shopAudioPlayer.pause();
                                setIsShopModalOpen(false);
                              }}
                              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                            >
                              İptal
                            </button>
                            <button
                              type="submit"
                              className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <span>💾</span>
                              <span>{editingShopItem ? 'Değişiklikleri Kaydet' : 'Ürünü Mağazaya Ekle'}</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
