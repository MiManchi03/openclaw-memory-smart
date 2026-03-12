export interface SmartMemoryConfig {
  tasks: TaskConfig;
  context: ContextConfig;
  entities: EntityConfig;
  storage: StorageConfig;
}

export interface TaskConfig {
  maxActiveTasks: number;
  checkIntervalMs: number;
  maxRetryOnFail: number;
}

export interface ContextConfig {
  maxConversations: number;
  messagesPerConversation: number;
  maxTokensPerContext: number;
  recoveryCount: number;
}

export interface EntityConfig {
  maxEntities: number;
  minStrengthToKeep: number;
  decayCheckIntervalMs: number;
  strengthDecayRate: number;
  extractionScoreThreshold: number;
  queryBoost: number;
  idle30DaysPenalty: number;
  idle90DaysPenalty: number;
}

export interface StorageConfig {
  dbPath: string;
  maxDbSizeMB: number;
  autoVacuum: boolean;
}

export const defaultConfig: SmartMemoryConfig = {
  tasks: {
    maxActiveTasks: 100,
    checkIntervalMs: 60000,
    maxRetryOnFail: 3,
  },
  context: {
    maxConversations: 50,
    messagesPerConversation: 100,
    maxTokensPerContext: 4000,
    recoveryCount: 10,
  },
  entities: {
    maxEntities: 1000,
    minStrengthToKeep: 10,
    decayCheckIntervalMs: 3600000,
    strengthDecayRate: 0.9,
    extractionScoreThreshold: 0.3,
    queryBoost: 0.15,
    idle30DaysPenalty: 0.2,
    idle90DaysPenalty: 0.3,
  },
  storage: {
    dbPath: "./.openclaw-memory",
    maxDbSizeMB: 500,
    autoVacuum: true,
  },
};

export const lowEndConfig: SmartMemoryConfig = {
  ...defaultConfig,
  tasks: { ...defaultConfig.tasks, maxActiveTasks: 20 },
  context: {
    ...defaultConfig.context,
    maxConversations: 10,
    maxTokensPerContext: 2000,
  },
  entities: { ...defaultConfig.entities, maxEntities: 200 },
};

export const highEndConfig: SmartMemoryConfig = {
  ...defaultConfig,
  tasks: { ...defaultConfig.tasks, maxActiveTasks: 500 },
  context: {
    ...defaultConfig.context,
    maxConversations: 200,
    maxTokensPerContext: 8000,
  },
  entities: { ...defaultConfig.entities, maxEntities: 5000 },
};

import os from "node:os";

export function detectHardwareProfile(): "low" | "default" | "high" {
  const totalMemory = os.totalmem() / (1024 * 1024 * 1024);

  if (totalMemory <= 4) {
    return "low";
  }
  if (totalMemory <= 16) {
    return "default";
  }
  return "high";
}

export function selectConfigByHardware(): SmartMemoryConfig {
  const profile = detectHardwareProfile();

  switch (profile) {
    case "low":
      return lowEndConfig;
    case "high":
      return highEndConfig;
    default:
      return defaultConfig;
  }
}
