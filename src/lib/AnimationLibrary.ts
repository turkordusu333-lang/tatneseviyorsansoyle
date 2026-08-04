import { Variants } from 'motion/react';

/**
 * 🎮 Merkezileştirilmiş Framer Motion Animasyon Kütüphanesi (AnimationLibrary.ts)
 * Kart hareketleri, çekme, el koyma, hover efektleri ve yay fiziği (spring-physics) kütüphanesi.
 */

// 1. Gelişmiş Yay Fiziği (Spring Physics) Konfigürasyonları
export const SPRING_PRESETS = {
  // Ultra esnek ve dokunsal yay fiziği - kart dağıtma ve ele çekme için ideal
  bouncy: {
    type: 'spring' as const,
    stiffness: 450,
    damping: 16,
    mass: 0.8,
  },
  // Snappy, hızlı ve dinamik yay fiziği - kart sürükleme, yerine yerleşme ve hover için ideal
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 25,
    mass: 0.7,
  },
  // Yumuşak, derin ve akıcı hareket yayı - büyük kart uçuşları ve takaslar için ideal
  fluid: {
    type: 'spring' as const,
    stiffness: 180,
    damping: 20,
    mass: 1,
  },
  // Ağır ve güçlü etki yayı - Deal Breaker ve yüksek etkili kart çarpışmaları için ideal
  heavyImpact: {
    type: 'spring' as const,
    stiffness: 350,
    damping: 12,
    mass: 1.2,
  }
};

// 2. Kart Etkileşim Varyantları (Dağıtma, Çekme, El Koyma, Hover ve Tap)
export const CARD_VARIANTS: Variants = {
  // Kart çekme / ele gelme animasyonu (Draw/Deal)
  draw: {
    scale: 1,
    y: 0,
    rotate: 0,
    opacity: 1,
    transition: {
      scale: { ...SPRING_PRESETS.bouncy },
      y: { ...SPRING_PRESETS.bouncy },
      rotate: { ...SPRING_PRESETS.snappy },
      opacity: { duration: 0.25 }
    }
  },
  initialDraw: {
    scale: 0.3,
    y: 120,
    rotate: 15,
    opacity: 0,
  },
  // Kart oynama veya ıskarta alanına düşüş animasyonu
  play: {
    scale: [1, 1.15, 0.9, 1],
    rotate: [0, -10, 8, 0],
    y: [0, -40, 10, 0],
    transition: {
      duration: 0.55,
      ease: [0.25, 1, 0.5, 1]
    }
  },
  // Kart el koyma / zorla alma animasyonu (Deal Breaker, Sly Deal, Seizure)
  seizure: {
    scale: [1, 1.25, 0.8, 1],
    rotate: [0, 15, -15, 0],
    x: [0, -20, 20, 0],
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 15,
      mass: 0.9
    }
  },
  // Oyuncunun elindeki kartların üzerine gelindiğinde (Hover) esnek büyüme ve yukarı kalkma efekti
  hover: {
    y: -24,
    scale: 1.12,
    rotate: -1,
    zIndex: 50,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
    transition: {
      type: 'spring',
      stiffness: 450,
      damping: 15
    }
  },
  // Karta tıklandığında (Press/Tap) dokunsal içe çökme efekti
  tap: {
    scale: 0.94,
    y: -10,
    rotate: 1,
    transition: {
      type: 'spring',
      stiffness: 600,
      damping: 12
    }
  }
};

// 3. Modal ve Pop-up Pencerelerin Geçiş Varyantları
export const MODAL_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 15,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 360,
      damping: 22
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: {
      duration: 0.2,
      ease: 'easeIn'
    }
  }
};

// 4. Tepkisel Oyuncu Tahtası Arka Plan Dalgalanma ve Işıma Varyantları
export const BOARD_REACTION_VARIANTS: Variants = {
  idle: {
    boxShadow: '0 0 0px rgba(0,0,0,0)',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    scale: 1,
  },
  money_gain: {
    boxShadow: [
      '0 0 0px rgba(16, 185, 129, 0)',
      '0 0 25px rgba(16, 185, 129, 0.8)',
      '0 0 5px rgba(16, 185, 129, 0.2)'
    ],
    borderColor: '#34d399',
    scale: [1, 1.03, 1],
    transition: {
      duration: 1.2,
      ease: 'easeInOut',
      repeat: 1
    }
  },
  card_gain: {
    boxShadow: [
      '0 0 0px rgba(34, 211, 238, 0)',
      '0 0 25px rgba(34, 211, 238, 0.8)',
      '0 0 5px rgba(34, 211, 238, 0.2)'
    ],
    borderColor: '#22d3ee',
    scale: [1, 1.03, 1],
    transition: {
      duration: 1.2,
      ease: 'easeInOut',
      repeat: 1
    }
  },
  card_loss: {
    boxShadow: [
      '0 0 0px rgba(239, 68, 68, 0)',
      '0 0 20px rgba(239, 68, 68, 0.6)',
      '0 0 0px rgba(239, 68, 68, 0)'
    ],
    borderColor: '#ef4444',
    scale: [1, 0.97, 1],
    transition: {
      duration: 0.8,
      ease: 'easeInOut'
    }
  },
  deal_breaker_target: {
    boxShadow: [
      '0 0 0px rgba(217, 70, 239, 0)',
      '0 0 35px rgba(217, 70, 239, 0.9)',
      '0 0 10px rgba(217, 70, 239, 0.3)'
    ],
    borderColor: '#d946ef',
    scale: [1, 1.04, 0.98, 1],
    transition: {
      duration: 1.8,
      ease: 'easeInOut'
    }
  }
};

// 5. Oyun Tahtası Olayları ve Aksiyonları için Özel Efektler (ActionVFX)
export const ActionVFX = {
  // Ekran sarsma animasyonu (Framer Motion ile tetiklenebilir)
  screenShake: {
    shake: {
      x: [0, -12, 12, -10, 10, -6, 6, -3, 3, 0],
      y: [0, 8, -8, 6, -6, 4, -4, 2, -2, 0],
      rotate: [0, -1.5, 1.5, -1, 1, -0.5, 0.5, 0, 0, 0],
      transition: {
        duration: 0.65,
        ease: 'easeInOut'
      }
    },
    none: {
      x: 0,
      y: 0,
      rotate: 0
    }
  },
  // Yoğun parıltı dalgalanması (Glow Pulse)
  glowPulse: {
    pulse: {
      boxShadow: [
        '0 0 0px rgba(59, 130, 246, 0)',
        '0 0 35px rgba(59, 130, 246, 0.8)',
        '0 0 15px rgba(59, 130, 246, 0.4)',
        '0 0 0px rgba(59, 130, 246, 0)'
      ],
      scale: [1, 1.015, 0.99, 1],
      transition: {
        duration: 0.8,
        ease: 'easeInOut'
      }
    },
    successEdge: {
      borderColor: ['rgba(52, 211, 153, 0.2)', 'rgba(52, 211, 153, 1)', 'rgba(52, 211, 153, 0.2)'],
      boxShadow: [
        'inset 0 0 0px rgba(52, 211, 153, 0)',
        'inset 0 0 30px rgba(52, 211, 153, 0.4), 0 0 15px rgba(52, 211, 153, 0.2)',
        'inset 0 0 0px rgba(52, 211, 153, 0)'
      ],
      transition: {
        duration: 0.7,
        ease: 'easeOut'
      }
    }
  }
};

