import { getDb, closeDb } from "./shared/db.js";
import { defaultConfig, selectConfigByHardware } from "./config.js";
import * as taskStorage from "./tasks/storage.js";
import * as taskScheduler from "./tasks/scheduler.js";
import * as contextStorage from "./context/storage.js";
import * as entityStorage from "./entities/storage.js";
import * as entityAnalyzer from "./entities/analyzer.js";
import * as entityDecay from "./entities/decay.js";
import type { Task, Conversation, ExtractedEntity, ConversationMessage, TaskType } from "./types.js";

export interface SmartMemorySystem {
  initialize: () => void;
  shutdown: () => void;

  tasks: {
    create: (userId: string, input: string, taskType?: TaskType, implementation?: string) => Task;
    get: (id: string) => Task | null;
    list: (userId: string) => Task[];
    pause: (id: string) => void;
    resume: (id: string) => void;
    delete: (id: string) => void;
  };

  context: {
    create: (userId: string, agentId: string) => Conversation;
    get: (id: string) => Conversation | null;
    getRecent: (userId: string, count: number) => Conversation[];
    addMessage: (conversationId: string, message: ConversationMessage) => Conversation | null;
    search: (userId: string, query: string) => Conversation[];
    recover: (userId: string, count: number) => Conversation[];
  };

  entities: {
    analyze: (userId: string, message: string) => Promise<{ shouldRemember: boolean; importance: string; entities: ExtractedEntity[] }>;
    search: (userId: string, query: string) => ExtractedEntity[];
    refresh: (userId: string, query: string) => void;
  };

  scheduler: {
    start: () => void;
    stop: () => void;
    status: () => { running: boolean; activeTasks: number; dueTasks: number };
  };

  maintenance: {
    decay: (userId: string) => number;
    cleanup: (userId: string) => number;
  };
}

function createSmartMemory(): SmartMemorySystem {
  const config = selectConfigByHardware();

  let initialized = false;

  return {
    initialize(): void {
      if (initialized) {
        return;
      }

      getDb();

      taskScheduler.recoverTasks();

      taskScheduler.startScheduler(async (task: Task) => {
        console.log(`[SmartMemory] Task triggered: ${task.title || task.content}`);
      });

      setInterval(() => {
        const preferences = entityStorage.getAllPreferences();
        if (preferences.length > 0) {
          entityAnalyzer.decayAllPreferences();
        }
      }, config.entities.decayCheckIntervalMs);

      initialized = true;
    },

    shutdown(): void {
      taskScheduler.stopScheduler();
      closeDb();
      initialized = false;
    },

    tasks: {
      create(userId: string, input: string, taskType: TaskType = "reminder", implementation?: string): Task {
        return taskStorage.createTask(userId, input, taskType, implementation);
      },

      get(id: string): Task | null {
        return taskStorage.getTask(id);
      },

      list(userId: string): Task[] {
        return taskStorage.getTasksByUser(userId, "active");
      },

      pause(id: string): void {
        taskStorage.pauseTask(id);
      },

      resume(id: string): void {
        taskStorage.resumeTask(id);
      },

      delete(id: string): void {
        taskStorage.deleteTask(id);
      },
    },

    context: {
      create(userId: string, agentId: string): Conversation {
        return contextStorage.createConversation(userId, agentId);
      },

      get(id: string): Conversation | null {
        return contextStorage.getConversation(id);
      },

      getRecent(userId: string, count: number): Conversation[] {
        return contextStorage.getMostRecentConversations(userId, count);
      },

      addMessage(conversationId: string, message: ConversationMessage): Conversation | null {
        return contextStorage.addMessageToConversation(conversationId, message);
      },

      search(userId: string, query: string): Conversation[] {
        return contextStorage.searchConversations(userId, query);
      },

      recover(userId: string, count: number): Conversation[] {
        const conversations = contextStorage.getMostRecentConversations(userId, count);

        for (const conv of conversations) {
          entityDecay.refreshOnQuery(userId, conv.messages.map((m) => m.content).join(" "));
        }

        return conversations;
      },
    },

    entities: {
      async analyze(userId: string, message: string): Promise<{ shouldRemember: boolean; importance: string; entities: ExtractedEntity[] }> {
        const result = await entityAnalyzer.analyzeMessage(userId, message);

        if (result.shouldRemember && result.extractedEntities.length > 0) {
          await entityAnalyzer.processExtractedEntities(userId, result.extractedEntities, message);
        }

        const entities = entityStorage.getEntitiesByUser(userId);

        return {
          shouldRemember: result.shouldRemember,
          importance: result.importance,
          entities: result.extractedEntities.map((e) => {
            const existing = entities.find((ent) => ent.key === e.key);
            return existing ?? entityStorage.createEntity(userId, e.category, e.key, e.value, message);
          }),
        };
      },

      search(userId: string, query: string): ExtractedEntity[] {
        const results = entityStorage.searchEntities(userId, query);

        for (const _entity of results) {
          entityDecay.refreshOnQuery(userId, query);
        }

        return results;
      },

      refresh(userId: string, query: string): void {
        entityDecay.refreshOnQuery(userId, query);
      },
    },

    scheduler: {
      start(): void {
        taskScheduler.startScheduler(async (task: Task) => {
          console.log(`[SmartMemory] Task triggered: ${task.title || task.content}`);
        });
      },

      stop(): void {
        taskScheduler.stopScheduler();
      },

      status(): { running: boolean; activeTasks: number; dueTasks: number } {
        return taskScheduler.getSchedulerStatus();
      },
    },

    maintenance: {
      decay(userId: string): number {
        return entityDecay.decayAllIfNeeded(userId);
      },

      cleanup(userId: string): number {
        return contextStorage.cleanupOldConversations(userId, defaultConfig.context.maxConversations);
      },
    },
  };
}

export const smartMemory = createSmartMemory();
export default smartMemory;
