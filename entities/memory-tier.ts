import type { EntityCategory, InfoType } from "../types.js";

export interface MemoryTier {
  tier: number;
  name: string;
  minDays: number;
  maxDays: number;
  diff: number;
}

export const MEMORY_TIERS: Record<number, MemoryTier> = {
  0: { tier: 0, name: "永久记忆", minDays: Infinity, maxDays: Infinity, diff: 0 },
  1: { tier: 1, name: "最高优先级", minDays: 60, maxDays: 60, diff: 0 },
  2: { tier: 2, name: "高优先级", minDays: 40, maxDays: 60, diff: 20 },
  3: { tier: 3, name: "中优先级", minDays: 25, maxDays: 40, diff: 15 },
  4: { tier: 4, name: "一般优先级", minDays: 15, maxDays: 25, diff: 10 },
  5: { tier: 5, name: "低优先级", minDays: 7, maxDays: 15, diff: 8 },
  6: { tier: 6, name: "弱记忆", minDays: 0, maxDays: 7, diff: 7 },
};

export const INITIAL_DAYS: Record<InfoType, number> = {
  core: 60,
  preference: 25,
  temporary: 7,
};

export const CATEGORY_TO_INFO_TYPE: Record<EntityCategory, InfoType> = {
  personal: "core",
  relationship: "core",
  preference: "preference",
  habit: "preference",
  event: "temporary",
  custom: "temporary",
};

export function getTier(remainingDays: number, isPermanent: boolean): number {
  if (isPermanent) { return 0; }
  if (remainingDays >= 60) { return 1; }
  if (remainingDays >= 40) { return 2; }
  if (remainingDays >= 25) { return 3; }
  if (remainingDays >= 15) { return 4; }
  if (remainingDays >= 7) { return 5; }
  return 6;
}

export function getTierDiff(tier: number): number {
  return MEMORY_TIERS[tier]?.diff ?? 7;
}

export function getTierInfo(remainingDays: number, isPermanent: boolean): MemoryTier {
  const tier = getTier(remainingDays, isPermanent);
  return MEMORY_TIERS[tier];
}

export function isWeakMemory(remainingDays: number, isPermanent: boolean): boolean {
  if (isPermanent) { return false; }
  return remainingDays < 7;
}

export function isMaxDays(remainingDays: number): boolean {
  return remainingDays >= 60;
}

export function getPreviousTierDiff(remainingDays: number, isPermanent: boolean): number {
  if (isPermanent) { return 0; }
  
  const currentTier = getTier(remainingDays, isPermanent);
  
  if (currentTier === 1) {
    return 0;
  }
  
  return getTierDiff(currentTier);
}
