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
      // Base dimensions with 25% scale increase for compact layout (from 32px x 46px to 40px x 58px)
      let cardWidth = isCompactLayout ? 40 : 52;
      let cardHeight = isCompactLayout ? 58 : 76;

      // Auto-Resize logic based on content density (card count / house / hotel)
      if (isCompactLayout) {
        if (cardCount >= 4) {
          // Extra dense sets auto-expand slightly for max legibility
          cardWidth = 44;
          cardHeight = 62;
        } else if (cardCount >= 3 || hasBuilding) {
          cardWidth = 42;
          cardHeight = 60;
        }
      } else {
        if (cardCount >= 4) {
          cardWidth = 56;
          cardHeight = 82;
        }
      }

      // Dynamic Container Column Width Class
      let containerWidthClass = '';
      if (isCompactLayout) {
        if (cardCount >= 4) {
          containerWidthClass = 'w-[46px] sm:w-[56px] md:w-[66px] p-1';
        } else if (cardCount >= 3 || hasBuilding) {
          containerWidthClass = 'w-[44px] sm:w-[54px] md:w-[64px] p-1';
        } else {
          containerWidthClass = 'w-[42px] sm:w-[52px] md:w-[62px] p-1';
        }
      } else {
        containerWidthClass = 'w-[52px] sm:w-[64px] md:w-[76px] p-1.5';
      }

      // Dynamic Accordion Height Class
      let minAccordionHeightClass = '';
      if (isExpanded) {
        minAccordionHeightClass = isCompactLayout
          ? cardCount >= 4
            ? 'min-h-[110px] sm:min-h-[135px]'
            : 'min-h-[95px] sm:min-h-[120px]'
          : 'min-h-[140px] sm:min-h-[180px]';
      } else {
        minAccordionHeightClass = isCompactLayout
          ? cardCount >= 4
            ? 'min-h-[44px] sm:min-h-[54px]'
            : 'min-h-[38px] sm:min-h-[48px]'
          : 'min-h-[50px] sm:min-h-[68px]';
      }

      // Stack Overlap Margin Class (ensures headers remain visible)
      let stackOverlapClass = '';
      if (isCompactLayout) {
        if (cardCount >= 4) {
          stackOverlapClass = '-mt-[135%]';
        } else if (cardCount >= 3) {
          stackOverlapClass = '-mt-[142%]';
        } else {
          stackOverlapClass = '-mt-[148%]';
        }
      } else {
        stackOverlapClass = '-mt-[162%]';
      }

      const fanOffsetY = isCompactLayout ? (cardCount >= 4 ? 16 : 14) : 18;

      const badgeSizeClass = isCompactLayout
        ? 'text-[6.5px] px-1 py-0.5 leading-none'
        : 'text-[7.5px] px-1.5 py-0.5 leading-none';

      const rentBadgeClass = isCompactLayout
        ? 'text-[7.5px] sm:text-[8.5px] px-1 py-0.5'
        : 'text-[8.5px] sm:text-[10px] px-1.5 py-0.5';

      const fontScaleClass = isCompactLayout
        ? 'text-[7px] sm:text-[8px] leading-tight font-extrabold'
        : 'text-[8.5px] sm:text-[9.5px] leading-tight font-extrabold';

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
    [isCompactLayout]
  );

  return {
    isCompactLayout,
    setIsCompactLayout,
    toggleCompactLayout,
    getDynamicSetDimensions,
  };
}
