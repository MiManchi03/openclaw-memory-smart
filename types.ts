export type EntityCategory =
  | "personal"
  | "preference"
  | "relationship"
  | "event"
  | "habit"
  | "custom";

export type InfoType = "core" | "preference" | "temporary";

export interface ExtractedEntity {
  id: string;
  userId: string;
  category: EntityCategory;
  infoType: InfoType;
  key: string;
  value: string;
  sourceMessage: string;
  remainingDays: number;
  isPermanent: boolean;
  negativeFeedbackCount: number;
  accessCount: number;
  createdAt: number;
  lastAccessed: number;
  lastDecayAt: number;
}

export interface ExtractionPreference {
  category: string;
  score: number;
  totalExtracted: number;
  totalQueried: number;
  lastQueried?: number;
  lastExtracted?: number;
}

export type TaskType = "reminder" | "scheduled_content";

export type ScheduleType = "once" | "daily" | "weekly" | "monthly" | "cron";

export type TaskStatus = "active" | "paused" | "completed";

export interface Task {
  id: string;
  userId: string;
  taskType: TaskType;
  title?: string;
  content: string;
  scheduleExpression?: string;
  scheduleType: ScheduleType;
  implementation?: string;
  triggerTime: number;
  lastTriggered?: number;
  status: TaskStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  userId: string;
  agentId: string;
  messages: ConversationMessage[];
  summary?: string;
  metadata?: string;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}
