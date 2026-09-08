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

export function useCompactLayout(initialValue = false) {
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
      // Premium physical card dimensions for property sets
      let cardWidth = 46;
      let cardHeight = 66;

      // Auto-Resize logic based on content density (card count / house / hotel)
      if (cardCount >= 4) {
        cardWidth = 50;
        cardHeight = 72;
      } else if (cardCount >= 3 || hasBuilding) {
        cardWidth = 48;
        cardHeight = 68;
      }

      // Dynamic Container Column Width Class
      let containerWidthClass = '';
      if (cardCount >= 4) {
        containerWidthClass = 'w-[52px] sm:w-[62px] md:w-[72px] p-1 sm:p-1.5';
      } else if (cardCount >= 3 || hasBuilding) {
        containerWidthClass = 'w-[50px] sm:w-[60px] md:w-[70px] p-1 sm:p-1.5';
      } else {
        containerWidthClass = 'w-[48px] sm:w-[58px] md:w-[68px] p-1 sm:p-1.5';
      }

      // Dynamic Accordion Height Class (synchronized with card dimensions)
      let minAccordionHeightClass = '';
      if (isExpanded) {
        minAccordionHeightClass = cardCount >= 4
          ? 'min-h-[135px] sm:min-h-[155px] md:min-h-[175px]'
          : 'min-h-[110px] sm:min-h-[130px] md:min-h-[150px]';
      } else {
        minAccordionHeightClass = cardCount >= 4
          ? 'min-h-[96px] sm:min-h-[106px] md:min-h-[116px]'
          : cardCount === 3
            ? 'min-h-[84px] sm:min-h-[94px] md:min-h-[104px]'
            : cardCount === 2
              ? 'min-h-[72px] sm:min-h-[82px] md:min-h-[92px]'
              : 'min-h-[66px]';
      }

      // Stack Overlap Margin Class (calibrated so each card's colored top banner and title remain clearly visible)
      let stackOverlapClass = '';
      if (cardCount >= 4) {
        stackOverlapClass = '-mt-[48px] sm:-mt-[50px] md:-mt-[52px]';
      } else if (cardCount >= 3) {
        stackOverlapClass = '-mt-[47px] sm:-mt-[49px] md:-mt-[51px]';
      } else {
        stackOverlapClass = '-mt-[46px] sm:-mt-[48px] md:-mt-[50px]';
      }

      const fanOffsetY = cardCount >= 4 ? 20 : 16;

      const badgeSizeClass = 'text-[7.5px] px-1.5 py-0.5 leading-none';

      const rentBadgeClass = 'text-[8px] sm:text-[9px] px-1.5 py-0.5 gap-1 justify-center';

      const fontScaleClass = 'text-[8px] sm:text-[9px] leading-tight font-black';

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
