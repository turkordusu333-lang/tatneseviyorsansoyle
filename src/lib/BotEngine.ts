import { Card, GamePlayer, MatchState, CardColor } from '../types';
import { MAX_IN_SET, RENT_VALUES } from './deck';

/**
 * Heuristics-based AI Decision Engine for Deal Master PRO Deal Bot
 */
export class BotEngine {
  /**
   * Helper to calculate rent value of a color set for a player
   */
  static getRentValue(player: GamePlayer, color: CardColor): number {
    const set = player.properties[color];
    if (!set || set.cards.length === 0) return 0;
    const count = Math.min(set.cards.length, MAX_IN_SET[color]);
    let val = RENT_VALUES[color]?.[count - 1] || 1;
    if (set.hasHouse) val += 3;
    if (set.hasHotel) val += 4;
    return val;
  }

  /**
   * Decide what action to take when it's the bot's turn to play.
   * Bot plays up to 3 cards. It chooses card-by-card.
   */
  static selectPlayAction(
    botPlayer: GamePlayer,
    matchState: MatchState,
    difficulty: 'easy' | 'medium' | 'hard' = 'medium'
  ): { cardId: string; targetZone: 'bank' | 'property' | 'action'; extraColor?: CardColor; payload?: any } | null {
    if (botPlayer.hand.length === 0) return null;

    // Easy AI occasional random play "mistakes" (Improvement #20)
    if (difficulty === 'easy' && Math.random() < 0.25) {
      const props = botPlayer.hand.filter((c) => c.type === 'property');
      if (props.length > 0) {
        return { cardId: props[Math.floor(Math.random() * props.length)].id, targetZone: 'property' };
      }
      const depositables = botPlayer.hand.filter((c) => c.value > 0);
      if (depositables.length > 0) {
        return { cardId: depositables[Math.floor(Math.random() * depositables.length)].id, targetZone: 'bank' };
      }
    }

    const otherPlayers = matchState.players.filter((p) => p.id !== botPlayer.id);

    // 1. Priority: Play properties (and wildcards) to complete sets
    const propertiesInHand = botPlayer.hand.filter((c) => c.type === 'property');
    if (propertiesInHand.length > 0) {
      // Find a property of a color we are already collecting, or a new color
      const chosenProp = propertiesInHand[0];
      if (chosenProp.color) {
        return { cardId: chosenProp.id, targetZone: 'property' };
      }
    }

    // Wildcards
    const wildcardsInHand = botPlayer.hand.filter((c) => c.type === 'wildcard');
    if (wildcardsInHand.length > 0) {
      const wild = wildcardsInHand[0];
      // Pick a color to use it as
      let targetColor: CardColor = wild.color || 'brown';
      if (wild.secondaryColor && botPlayer.properties[wild.secondaryColor]) {
        targetColor = wild.secondaryColor;
      } else if (wild.color && botPlayer.properties[wild.color]) {
        targetColor = wild.color;
      } else {
        // Fallback to any allowed color
        targetColor = wild.color || wild.secondaryColor || (wild.allowedColors && wild.allowedColors.length > 0 ? wild.allowedColors[0] as CardColor : 'brown');
      }
      return { cardId: wild.id, targetZone: 'property', extraColor: targetColor };
    }

    // 2. Play Houses or Hotels if we have a completed set
    const houseHotels = botPlayer.hand.filter((c) => c.type === 'house-hotel');
    if (houseHotels.length > 0) {
      const hh = houseHotels[0];
      // Find a completed set
      for (const colorKey in botPlayer.properties) {
        const color = colorKey as CardColor;
        const propSet = botPlayer.properties[color];
        if (propSet && propSet.cards.length >= MAX_IN_SET[color]) {
          if (hh.actionType === 'house' && !propSet.hasHouse && !propSet.hasHotel) {
            return { cardId: hh.id, targetZone: 'property', extraColor: color };
          }
          if (hh.actionType === 'hotel' && propSet.hasHouse && !propSet.hasHotel) {
            return { cardId: hh.id, targetZone: 'property', extraColor: color };
          }
        }
      }
    }

    // 3. Play Action Cards if useful (sly-deal, deal-breaker, forced-deal, rent, debt, birthday, pass-go)
    const actionCards = botPlayer.hand.filter((c) => c.type === 'action' || c.type === 'rent');

    // First let's look for game-changing steal cards: Deal Breaker
    const dealBreaker = actionCards.find((c) => c.actionType === 'deal-breaker');
    if (dealBreaker && otherPlayers.length > 0) {
      // Find completed sets to steal
      let bestTargetPlayer: GamePlayer | null = null;
      let bestColor: CardColor | null = null;
      let highestVal = 0;

      otherPlayers.forEach((op) => {
        Object.keys(op.properties).forEach((colorKey) => {
          const col = colorKey as CardColor;
          const propSet = op.properties[col];
          if (propSet && propSet.cards.length >= MAX_IN_SET[col]) {
            const setVal = propSet.cards.reduce((sum, c) => sum + c.value, 0);
            if (setVal > highestVal) {
              highestVal = setVal;
              bestTargetPlayer = op;
              bestColor = col;
            }
          }
        });
      });

      if (bestTargetPlayer && bestColor) {
        return {
          cardId: dealBreaker.id,
          targetZone: 'action',
          payload: { targetPlayerId: (bestTargetPlayer as GamePlayer).id, targetColor: bestColor }
        };
      }
    }

    // Sly Deal
    const slyDeal = actionCards.find((c) => c.actionType === 'sly-deal');
    if (slyDeal && otherPlayers.length > 0) {
      // Find incomplete sets containing cards to steal
      let bestTargetPlayer: GamePlayer | null = null;
      let bestCardToSteal: Card | null = null;
      let highestCardVal = 0;

      otherPlayers.forEach((op) => {
        Object.keys(op.properties).forEach((colorKey) => {
          const col = colorKey as CardColor;
          const propSet = op.properties[col];
          if (propSet && propSet.cards.length > 0 && propSet.cards.length < MAX_IN_SET[col]) {
            propSet.cards.forEach((c) => {
              if (c.value > highestCardVal) {
                highestCardVal = c.value;
                bestTargetPlayer = op;
                bestCardToSteal = c;
              }
            });
          }
        });
      });

      if (bestTargetPlayer && bestCardToSteal) {
        return {
          cardId: slyDeal.id,
          targetZone: 'action',
          payload: { targetPlayerId: (bestTargetPlayer as GamePlayer).id, targetCardId: (bestCardToSteal as Card).id }
        };
      }
    }

    // Forced Deal
    const forcedDeal = actionCards.find((c) => c.actionType === 'forced-deal');
    if (forcedDeal && otherPlayers.length > 0) {
      // We need one of our own cards from an incomplete set to give away
      let myCardToGive: Card | null = null;
      let lowestMyVal = 999;

      Object.keys(botPlayer.properties).forEach((colorKey) => {
        const col = colorKey as CardColor;
        const propSet = botPlayer.properties[col];
        if (propSet && propSet.cards.length > 0 && propSet.cards.length < MAX_IN_SET[col]) {
          propSet.cards.forEach((c) => {
            if (c.value < lowestMyVal) {
              lowestMyVal = c.value;
              myCardToGive = c;
            }
          });
        }
      });

      if (myCardToGive) {
        // Find an opponent card from an incomplete set to steal
        let opTargetPlayer: GamePlayer | null = null;
        let opCardToSteal: Card | null = null;
        let highestOpVal = 0;

        otherPlayers.forEach((op) => {
          Object.keys(op.properties).forEach((colorKey) => {
            const col = colorKey as CardColor;
            const propSet = op.properties[col];
            if (propSet && propSet.cards.length > 0 && propSet.cards.length < MAX_IN_SET[col]) {
              propSet.cards.forEach((c) => {
                if (c.value > highestOpVal) {
                  highestOpVal = c.value;
                  opTargetPlayer = op;
                  opCardToSteal = c;
                }
              });
            }
          });
        });

        // Only do Forced Deal if we steal something of equal or greater value
        if (opTargetPlayer && opCardToSteal && highestOpVal >= lowestMyVal) {
          return {
            cardId: forcedDeal.id,
            targetZone: 'action',
            payload: {
              targetPlayerId: (opTargetPlayer as GamePlayer).id,
              targetCardId: (opCardToSteal as Card).id,
              myCardId: (myCardToGive as Card).id
            }
          };
        }
      }
    }

    // Pass Go (Always play to draw cards)
    const passGo = actionCards.find((c) => c.actionType === 'pass-go');
    if (passGo) {
      return { cardId: passGo.id, targetZone: 'action' };
    }

    // Birthday
    const birthday = actionCards.find((c) => c.actionType === 'birthday');
    if (birthday) {
      return { cardId: birthday.id, targetZone: 'action' };
    }

    // Debt Collector
    const debtCollector = actionCards.find((c) => c.actionType === 'debt-collector');
    if (debtCollector && otherPlayers.length > 0) {
      // Target the player with the most assets (highest bank + property card values)
      const targetOp = otherPlayers.reduce((best, current) => {
        const bestVal = best.bank.reduce((sum, c) => sum + c.value, 0) + Object.values(best.properties).reduce((sum: number, set: any) => sum + (set?.cards?.reduce((s: number, card: Card) => s + card.value, 0) || 0), 0);
        const currentVal = current.bank.reduce((sum, c) => sum + c.value, 0) + Object.values(current.properties).reduce((sum: number, set: any) => sum + (set?.cards?.reduce((s: number, card: Card) => s + card.value, 0) || 0), 0);
        return currentVal > bestVal ? current : best;
      }, otherPlayers[0]);

      return {
        cardId: debtCollector.id,
        targetZone: 'action',
        payload: { targetPlayerId: targetOp.id }
      };
    }

    // Rent Cards
    const rentCards = actionCards.filter((c) => c.type === 'rent');
    if (rentCards.length > 0) {
      for (const card of rentCards) {
        // Check if multi-color rent card
        const isMultiRent = card.name.includes('Her Renk') || !card.color;
        if (isMultiRent) {
          // Find our color set with the highest rent value currently
          let bestColor: CardColor | null = null;
          let highestRent = 0;

          Object.keys(botPlayer.properties).forEach((colorKey) => {
            const col = colorKey as CardColor;
            const rentVal = this.getRentValue(botPlayer, col);
            if (rentVal > highestRent) {
              highestRent = rentVal;
              bestColor = col;
            }
          });

          if (bestColor && otherPlayers.length > 0) {
            const targetOp = otherPlayers.reduce((best, current) => {
              const bestVal = best.bank.reduce((sum, c) => sum + c.value, 0) + Object.values(best.properties).reduce((sum: number, set: any) => sum + (set?.cards?.reduce((s: number, card: Card) => s + card.value, 0) || 0), 0);
              const currentVal = current.bank.reduce((sum, c) => sum + c.value, 0) + Object.values(current.properties).reduce((sum: number, set: any) => sum + (set?.cards?.reduce((s: number, card: Card) => s + card.value, 0) || 0), 0);
              return currentVal > bestVal ? current : best;
            }, otherPlayers[0]);

            const hasDoubleRent = botPlayer.hand.some((c) => c.actionType === 'double-rent');
            return {
              cardId: card.id,
              targetZone: 'action',
              extraColor: bestColor,
              payload: { isDoubleRent: hasDoubleRent, targetPlayerId: targetOp.id }
            };
          }
        } else {
          // Specific or dual rent card (card.color and card.secondaryColor)
          const colorsToCheck: CardColor[] = [];
          if (card.color) colorsToCheck.push(card.color);
          if (card.secondaryColor) colorsToCheck.push(card.secondaryColor);
          if (card.allowedColors) {
            card.allowedColors.forEach((col) => colorsToCheck.push(col as CardColor));
          }

          let bestColor: CardColor | null = null;
          let highestRent = 0;

          colorsToCheck.forEach((col) => {
            const rentVal = this.getRentValue(botPlayer, col);
            if (rentVal > highestRent) {
              highestRent = rentVal;
              bestColor = col;
            }
          });

          if (bestColor) {
            const hasDoubleRent = botPlayer.hand.some((c) => c.actionType === 'double-rent');
            return {
              cardId: card.id,
              targetZone: 'action',
              extraColor: bestColor,
              payload: hasDoubleRent ? { isDoubleRent: true } : undefined
            };
          }
        }
      }
    }

    // 4. Bank some money if we have high-value money cards and want safety
    const moneyCards = botPlayer.hand.filter((c) => c.type === 'money');
    if (moneyCards.length > 0) {
      // Always keep some cards in hand, but bank high values
      const bestMoney = moneyCards.sort((a, b) => b.value - a.value)[0];
      return { cardId: bestMoney.id, targetZone: 'bank' };
    }

    // 5. If hand is too full, just bank an action card as money
    if (botPlayer.hand.length > 5) {
      const lowValueAction = actionCards.find((c) => c.actionType !== 'just-say-no');
      if (lowValueAction) {
        return { cardId: lowValueAction.id, targetZone: 'bank' };
      }
    }

    return null;
  }

  /**
   * Decide how the bot will pay a rent or demand of `amountDue` millions.
   * Returns a list of card IDs to pay with.
   */
  static selectPayment(botPlayer: GamePlayer, amountDue: number): string[] {
    const bankCards = botPlayer.bank.map((c) => ({ id: c.id, value: c.value, isProperty: false, isCompletedSet: false }));
    const propertyCards: { id: string; value: number; isProperty: boolean; isCompletedSet: boolean }[] = [];

    for (const colorKey in botPlayer.properties) {
      const color = colorKey as CardColor;
      const propSet = botPlayer.properties[color];
      if (!propSet) continue;

      const isCompleted = propSet.cards.length >= MAX_IN_SET[color];
      propSet.cards.forEach((c) => {
        propertyCards.push({ id: c.id, value: c.value, isProperty: true, isCompletedSet: isCompleted });
      });
    }

    const cards = [...bankCards, ...propertyCards];
    const totalValue = cards.reduce((sum, c) => sum + c.value, 0);
    if (totalValue <= amountDue) {
      return cards.map((c) => c.id);
    }

    // Solve for best subset
    let bestSubset: typeof cards | null = null;
    let bestValue = Infinity;
    let bestCompletedSetCount = Infinity;
    let bestPropCount = Infinity;
    let bestCardCount = Infinity;

    const n = cards.length;

    // To prevent any performance/hanging issues, if N is too large, use a fallback
    if (n > 14) {
      // Simple greedy fallback
      const sorted = [...cards].sort((a, b) => {
        if (a.isCompletedSet !== b.isCompletedSet) return a.isCompletedSet ? 1 : -1;
        if (a.isProperty !== b.isProperty) return a.isProperty ? 1 : -1;
        return a.value - b.value;
      });
      const selection: string[] = [];
      let sum = 0;
      for (const card of sorted) {
        if (sum < amountDue) {
          selection.push(card.id);
          sum += card.value;
        }
      }
      return selection;
    }

    const search = (index: number, current: typeof cards, currentSum: number, currentPropCount: number, currentCompletedSetCount: number) => {
      if (currentSum >= amountDue) {
        let update = false;
        if (currentSum < bestValue) {
          update = true;
        } else if (currentSum === bestValue) {
          if (currentCompletedSetCount < bestCompletedSetCount) {
            update = true;
          } else if (currentCompletedSetCount === bestCompletedSetCount) {
            if (currentPropCount < bestPropCount) {
              update = true;
            } else if (currentPropCount === bestPropCount) {
              if (current.length < bestCardCount) {
                update = true;
              }
            }
          }
        }

        if (update) {
          bestSubset = [...current];
          bestValue = currentSum;
          bestCompletedSetCount = currentCompletedSetCount;
          bestPropCount = currentPropCount;
          bestCardCount = current.length;
        }
        return;
      }

      if (index >= n) return;

      // Option 1: Include cards[index]
      const card = cards[index];
      current.push(card);
      search(
        index + 1,
        current,
        currentSum + card.value,
        currentPropCount + (card.isProperty ? 1 : 0),
        currentCompletedSetCount + (card.isCompletedSet ? 1 : 0)
      );
      current.pop();

      // Option 2: Exclude cards[index]
      search(index + 1, current, currentSum, currentPropCount, currentCompletedSetCount);
    };

    // Sort to optimize search (completed sets at the very end, single properties next, cheaper cash first)
    const sortedCards = [...cards].sort((a, b) => {
      if (a.isCompletedSet !== b.isCompletedSet) {
        return a.isCompletedSet ? 1 : -1; // Completed sets last
      }
      if (a.isProperty !== b.isProperty) {
        return a.isProperty ? 1 : -1; // Cash first, properties last
      }
      return a.value - b.value; // Cheaper first
    });

    search(0, [], 0, 0, 0);

    return bestSubset ? (bestSubset as typeof cards).map((c) => c.id) : [];
  }

  /**
   * Decide if the bot should use Just Say No to counter an action card.
   */
  static shouldPlayJustSayNo(botPlayer: GamePlayer): boolean {
    const hasJsn = botPlayer.hand.some((c) => c.actionType === 'just-say-no');
    // If targeted, 85% chance of countering immediately
    return hasJsn && Math.random() < 0.85;
  }

  /**
   * Choose which card to discard when hand size exceeds 7.
   */
  static selectDiscardCard(botPlayer: GamePlayer): string | null {
    if (botPlayer.hand.length <= 7) return null;

    // Discard lowest value card, prioritizing simple money cards or redundant action cards
    const sorted = [...botPlayer.hand].sort((a, b) => {
      // Prioritize keeping Just Say No and high value cards
      if (a.actionType === 'just-say-no') return 1;
      if (b.actionType === 'just-say-no') return -1;
      if (a.type === 'property' && b.type !== 'property') return 1;
      if (b.type === 'property' && a.type !== 'property') return -1;
      return a.value - b.value;
    });

    return sorted[0]?.id || null;
  }
}
