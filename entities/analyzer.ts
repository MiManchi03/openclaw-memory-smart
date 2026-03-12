import type { EntityCategory } from "../types.js";
import * as storage from "./storage.js";

export interface AnalysisResult {
  shouldRemember: boolean;
  importance: "high" | "medium" | "low";
  extractedEntities: ExtractedEntityInfo[];
}

export interface ExtractedEntityInfo {
  category: EntityCategory;
  key: string;
  value: string;
  confidence: number;
}

interface PersonalInfo {
  pattern: RegExp;
  category: EntityCategory;
  key: string;
}

const personalInfoPatterns: PersonalInfo[] = [
  { pattern: /身[高长][\s:：]*(\d+(?:\.\d+)?)\s*([Cc][Mm]|厘米|公分)/, category: "personal", key: "身高" },
  { pattern: /体[重肥][\s:：]*(\d+(?:\.\d+)?)\s*([Kk][Gg]|公斤|斤)/, category: "personal", key: "体重" },
  { pattern: /年龄[\s:：]*(\d+)\s*岁/, category: "personal", key: "年龄" },
  { pattern: /(\d+)\s*岁[男女性]?/, category: "personal", key: "年龄" },
  { pattern: /性[别别][\s:：]*([男女])/, category: "personal", key: "性别" },
  { pattern: /身高(\d+)/, category: "personal", key: "身高" },
  { pattern: /体重(\d+)/, category: "personal", key: "体重" },
  { pattern: /血型[\s:：]*([AABBOOAB])/i, category: "personal", key: "血型" },
  { pattern: /MBTI[\s:：]*([INTJ][ENFP][ISTJ][ESFJ]{0,4})/i, category: "personal", key: "MBTI" },
  { pattern: /(INFP|INTJ|INTP|INFJ|ENFP|ENTP|ENFJ|ENTJ|ISFP|ISTP|ISFJ|ESFP|ESTP|ESFJ|ESTJ)/i, category: "personal", key: "MBTI" },
];

const preferencePatterns: PersonalInfo[] = [
  { pattern: /喜欢[\s:：]*([^，。,.]+)/, category: "preference", key: "喜欢" },
  { pattern: /偏好[\s:：]*([^，。,.]+)/, category: "preference", key: "偏好" },
  { pattern: /不喜欢[\s:：]*([^，。,.]+)/, category: "preference", key: "不喜欢" },
  { pattern: /爱吃[\s:：]*([^，。,.]+)/, category: "preference", key: "饮食偏好" },
  { pattern: /常吃[\s:：]*([^，。,.]+)/, category: "preference", key: "饮食偏好" },
  { pattern: /喜欢穿[\s:：]*([^，。,.]+)/, category: "preference", key: "穿着偏好" },
  { pattern: /喜欢听[\s:：]*([^，。,.]+)/, category: "preference", key: "音乐偏好" },
  { pattern: /喜欢看[\s:：]*([^，。,.]+)/, category: "preference", key: "影视偏好" },
  { pattern: /喜欢玩[\s:：]*([^，。,.]+)/, category: "preference", key: "游戏偏好" },
  { pattern: /用[\s:：]*([^，。,.]+)(鼠标|键盘|耳机)/, category: "preference", key: "外设偏好" },
];

const habitPatterns: PersonalInfo[] = [
  { pattern: /每天[^\s]{0,10}(跑步|锻炼|运动|健身|冥想|读书|写作)/, category: "habit", key: "日常习惯" },
  { pattern: /习惯[^\s]{0,10}(跑步|锻炼|运动|健身|冥想|读书|写作)/, category: "habit", key: "日常习惯" },
  { pattern: /经常[^\s]{0,10}(跑步|锻炼|运动|健身|冥想|读书|写作)/, category: "habit", key: "日常习惯" },
  { pattern: /每[天周月][^\s]{0,10}(跑步|锻炼|运动|健身|冥想|读书|写作)/, category: "habit", key: "日常习惯" },
];

const relationshipPatterns: PersonalInfo[] = [
  { pattern: /(老婆|妻子|老公|丈夫|男朋友|女朋友|爸爸|妈妈|儿子|女儿)[\s:：]*([^，。,.]+)/, category: "relationship", key: "家庭关系" },
  { pattern: /(养|有)[^\s]{0,5}(狗|猫|宠物)/, category: "relationship", key: "宠物" },
];

const allPatterns = [...personalInfoPatterns, ...preferencePatterns, ...habitPatterns, ...relationshipPatterns];

export async function analyzeMessage(
  userId: string,
  message: string
): Promise<AnalysisResult> {
  const lowerMessage = message.toLowerCase();

  if (isNoise(lowerMessage)) {
    return {
      shouldRemember: false,
      importance: "low",
      extractedEntities: [],
    };
  }

  const extractedEntities: ExtractedEntityInfo[] = [];

  for (const patternInfo of allPatterns) {
    const match = message.match(patternInfo.pattern);
    if (match && match[1]) {
      extractedEntities.push({
        category: patternInfo.category,
        key: patternInfo.key,
        value: match[1].trim(),
        confidence: 0.7,
      });
    }
  }

  if (extractedEntities.length === 0) {
    return {
      shouldRemember: false,
      importance: "low",
      extractedEntities: [],
    };
  }

  const importance = determineImportance(extractedEntities);

  return {
    shouldRemember: true,
    importance,
    extractedEntities,
  };
}

function isNoise(message: string): boolean {
  const noisePatterns = [
    /^[\s啊呢吧嘛哦呀哈嘿哎喂嗨]+$/,
    /^(你好|谢谢|再见|好的|知道了|明白)$/,
    /^(今天|明天|天气|不错|很好|还行)$/,
    /^[\d\s\W]+$/,
  ];

  for (const pattern of noisePatterns) {
    if (pattern.test(message)) {
      return true;
    }
  }

  if (message.length < 3) {
    return true;
  }

  return false;
}

function determineImportance(entities: ExtractedEntityInfo[]): "high" | "medium" | "low" {
  const hasPersonal = entities.some((e) => e.category === "personal");
  const hasRelationship = entities.some((e) => e.category === "relationship");

  if (hasPersonal || hasRelationship) {
    return "high";
  }

  const hasPreference = entities.some((e) => e.category === "preference");

  if (hasPreference) {
    return "medium";
  }

  return "low";
}

export async function processExtractedEntities(
  userId: string,
  entities: ExtractedEntityInfo[],
  sourceMessage: string
): Promise<void> {
  for (const entity of entities) {
    storage.getOrUpdateEntity(userId, entity.category, entity.key, entity.value, sourceMessage);

    const pref = storage.getPreference(entity.category);
    storage.updatePreference(entity.category, {
      totalExtracted: (pref?.totalExtracted ?? 0) + 1,
      lastExtracted: Date.now(),
    });
  }
}

export function adjustPreferenceOnQuery(category: string): void {
  const preference = storage.getPreference(category);

  if (!preference) {
    storage.updatePreference(category, {
      totalQueried: 1,
      lastQueried: Date.now(),
      score: 0.5,
    });
    return;
  }

  storage.updatePreference(category, {
    totalQueried: preference.totalQueried + 1,
    lastQueried: Date.now(),
  });
}

export function decayAllPreferences(): void {
  const preferences = storage.getAllPreferences();
  const now = Date.now();

  for (const pref of preferences) {
    let penalty = 0;

    if (pref.lastQueried) {
      const daysSinceLastQuery = (now - pref.lastQueried) / (1000 * 60 * 60 * 24);

      if (daysSinceLastQuery > 90) {
        penalty = 0.3;
      } else if (daysSinceLastQuery > 30) {
        penalty = 0.2;
      }
    }

    if (penalty > 0) {
      const newScore = Math.max(0.05, pref.score - penalty);
      storage.updatePreference(pref.category, { score: newScore });
    }
  }
}

export function detectNegativeFeedback(userMessage: string): string[] {
  const negativePatterns = [
    /不想.{0,10}(\S+)/,
    /不要.{0,10}(\S+)/,
    /别问.{0,10}(\S+)/,
    /别提.{0,10}(\S+)/,
    /别再提.{0,10}(\S+)/,
    /不想提.{0,10}(\S+)/,
    /不想说.{0,10}(\S+)/,
    /不要说.{0,10}(\S+)/,
    /不要问.{0,10}(\S+)/,
    /别问我.{0,10}(\S+)/,
    /(?:很?|太)讨厌.*(\S+)/,
    /(?:很?|太)反感.*(\S+)/,
    /不要.*提到.*(\S+)/,
    /别.*提到.*(\S+)/,
  ];

  const foundKeys: string[] = [];
  
  for (const pattern of negativePatterns) {
    const match = userMessage.match(pattern);
    if (match && match[1]) {
      foundKeys.push(match[1]);
    }
  }
  
  return foundKeys;
}
