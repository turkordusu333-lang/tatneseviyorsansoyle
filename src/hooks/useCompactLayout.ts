import { useState, useEffect, useCallback } from 'react';

export interface DynamicSetDimensions {
  cardWidth: number; // in px
  cardHeight: number; // in px
  containerWidthClass: string;
  minAccordionHeightClass: string;
  stackOverlapClass: string;
  fanOffsetY: number;
  badgeSizeClass: string;
  rentBadgeClass: string;
  fontScaleClass: string;
}

export function useCompactLayout(initialValue = true) {
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('mono_deal_compact_layout');
      if (saved !== null) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore JSON parse errors
    }
    return initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem('mono_deal_compact_layout', JSON.stringify(isCompactLayout));
    } catch {
      // ignore storage errors
    }
  }, [isCompactLayout]);

  const toggleCompactLayout = useCallback(() => {
    setIsCompactLayout((prev) => !prev);
  }, []);

  /**
   * Auto-Resize & Layout Density calculation
   * Dynamically adjusts property set column widths, heights, card overlaps, and badge typography
   * based on card count and expand state so text/badges never clip or get cut off.
   */
  const getDynamicSetDimensions = useCallback(
    (
      cardCount: number,
      isExpanded: boolean,
      hasBuilding: boolean = false
    ): DynamicSetDimensions => {
      // Unified compact-sized dimensions for both normal and compact layout to look clean and structured
      let cardWidth = 40;
      let cardHeight = 58;

      // Auto-Resize logic based on content density (card count / house / hotel)
      if (cardCount >= 4) {
        cardWidth = 44;
        cardHeight = 62;
      } else if (cardCount >= 3 || hasBuilding) {
        cardWidth = 42;
        cardHeight = 60;
      }

      // Dynamic Container Column Width Class
      let containerWidthClass = '';
      if (cardCount >= 4) {
        containerWidthClass = 'w-[48px] sm:w-[56px] md:w-[66px] p-0.5 sm:p-1';
      } else if (cardCount >= 3 || hasBuilding) {
        containerWidthClass = 'w-[46px] sm:w-[54px] md:w-[64px] p-0.5 sm:p-1';
      } else {
        containerWidthClass = 'w-[44px] sm:w-[52px] md:w-[62px] p-0.5 sm:p-1';
      }

      // Dynamic Accordion Height Class (carefully synchronized with card dimensions)
      let minAccordionHeightClass = '';
      if (isExpanded) {
        minAccordionHeightClass = cardCount >= 4
          ? 'min-h-[115px] sm:min-h-[135px] md:min-h-[155px]'
          : 'min-h-[95px] sm:min-h-[115px] md:min-h-[135px]';
      } else {
        minAccordionHeightClass = cardCount >= 4
          ? 'min-h-[82px] sm:min-h-[90px] md:min-h-[98px]'
          : cardCount === 3
            ? 'min-h-[72px] sm:min-h-[80px] md:min-h-[88px]'
            : cardCount === 2
              ? 'min-h-[62px] sm:min-h-[70px] md:min-h-[78px]'
              : 'min-h-[58px]';
      }

      // Stack Overlap Margin Class (beautifully calibrated to ensure headers/banners are always visible and tight across mobile & desktop)
      let stackOverlapClass = '';
      if (cardCount >= 4) {
        stackOverlapClass = '-mt-[48px] sm:-mt-[49px] md:-mt-[50px]';
      } else if (cardCount >= 3) {
        stackOverlapClass = '-mt-[46px] sm:-mt-[47px] md:-mt-[48px]';
      } else {
        stackOverlapClass = '-mt-[45px] sm:-mt-[46px] md:-mt-[47px]';
      }

      const fanOffsetY = cardCount >= 4 ? 16 : 14;

      const badgeSizeClass = 'text-[6.5px] px-1 py-0.5 leading-none';

      const rentBadgeClass = 'text-[7px] sm:text-[8px] px-1 py-0.5 gap-0.5 justify-center';

      const fontScaleClass = 'text-[7px] sm:text-[8px] leading-tight font-black';

      return {
        cardWidth,
        cardHeight,
        containerWidthClass,
        minAccordionHeightClass,
        stackOverlapClass,
        fanOffsetY,
        badgeSizeClass,
        rentBadgeClass,
        fontScaleClass,
      };
    },
    []
  );

  return {
    isCompactLayout,
    setIsCompactLayout,
    toggleCompactLayout,
    getDynamicSetDimensions,
  };
}
