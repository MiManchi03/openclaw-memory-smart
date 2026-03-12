import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";
import type { AgentToolResult } from "@mariozechner/pi-agent-core";
import { smartMemory } from "./index.js";
import * as entityStorage from "./entities/storage.js";
import { MEMORY_TIERS, getTier, INITIAL_DAYS } from "./entities/memory-tier.js";
import type { InfoType } from "./types.js";

function jsonResult(payload: unknown): AgentToolResult<unknown> {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

const CreateReminderSchema = Type.Object({
  user_id: Type.String({ description: "用户ID，用于标识不同的用户" }),
  input: Type.String({
    description:
      "提醒内容，支持中文时间表达，如 '每天七点半提醒我开会'、'下下周三下午18点提醒开会'、'下个月早上7点30提醒我开会'",
  }),
});

const CreateScheduledContentSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  input: Type.String({ description: "任务内容，支持时间表达" }),
  content_to_send: Type.String({ description: "要发送的具体内容" }),
});

const ListTasksSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
});

const DeleteTaskSchema = Type.Object({
  task_id: Type.String({ description: "任务ID" }),
});

const SearchContextSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  query: Type.String({ description: "搜索关键词" }),
  include_weak: Type.Optional(Type.Boolean({ description: "是否包含弱记忆（7天以下）" })),
});

const GetRecentContextSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  count: Type.Optional(Type.Number({ description: "获取最近N条对话" })),
});

const AddMessageSchema = Type.Object({
  conversation_id: Type.String({ description: "对话ID" }),
  role: Type.Enum({ user: "user", assistant: "assistant", system: "system" }, { description: "消息角色" }),
  content: Type.String({ description: "消息内容" }),
});

const AnalyzeMessageSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  message: Type.String({ description: "用户消息内容" }),
});

const SetPermanentSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  key: Type.String({ description: "记忆的key，如'身高'、'体重'等" }),
});

const RemovePermanentSchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  key: Type.String({ description: "记忆的key" }),
  info_type: Type.Enum({ core: "core", preference: "preference", temporary: "temporary" }, { description: "信息类型：core=核心信息、preference=偏好信息、temporary=临时信息" }),
});

const UpdateMemorySchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  key: Type.String({ description: "记忆的key" }),
  new_value: Type.String({ description: "新的值" }),
});

const DeleteMemorySchema = Type.Object({
  user_id: Type.String({ description: "用户ID" }),
  key: Type.String({ description: "要删除的记忆key" }),
});

const StatusSchema = Type.Object({});

function createMemoryTools(): any[] {
  return [
    {
      label: "创建提醒",
      name: "smart_memory_create_reminder",
      description:
        "创建时间提醒任务，例如：'每天七点半提醒我开会'、'下周三下午6点提醒我开会'、'下下周三18点提醒开会'",
      parameters: CreateReminderSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, input } = args as { user_id: string; input: string };
        const task = smartMemory.tasks.create(user_id, input, "reminder");
        return jsonResult({
          content: `已创建提醒任务: ${task.content}\n触发时间: ${new Date(task.triggerTime).toLocaleString("zh-CN")}\n类型: ${task.scheduleType}`,
          task_id: task.id,
          trigger_time: task.triggerTime,
          schedule_type: task.scheduleType,
        });
      },
    },
    {
      label: "创建定时发送任务",
      name: "smart_memory_create_scheduled_content",
      description: "创建定时发送内容任务，例如：'每天早上8点给我发送新闻'",
      parameters: CreateScheduledContentSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, input, content_to_send } = args as {
          user_id: string;
          input: string;
          content_to_send: string;
        };
        const task = smartMemory.tasks.create(user_id, input, "scheduled_content", content_to_send);
        return jsonResult({
          content: `已创建定时发送任务: ${task.content}\n发送内容: ${task.implementation}\n触发时间: ${new Date(task.triggerTime).toLocaleString("zh-CN")}`,
          task_id: task.id,
          content_to_send: task.implementation,
          trigger_time: task.triggerTime,
        });
      },
    },
    {
      label: "列出提醒任务",
      name: "smart_memory_list_tasks",
      description: "列出用户的所有提醒任务",
      parameters: ListTasksSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id } = args as { user_id: string };
        const tasks = smartMemory.tasks.list(user_id);
        return jsonResult({
          tasks: tasks.map((t) => ({
            id: t.id,
            content: t.content,
            trigger_time: new Date(t.triggerTime).toLocaleString("zh-CN"),
            schedule_type: t.scheduleType,
            status: t.status,
          })),
        });
      },
    },
    {
      label: "删除提醒任务",
      name: "smart_memory_delete_task",
      description: "删除指定的提醒任务",
      parameters: DeleteTaskSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { task_id } = args as { task_id: string };
        smartMemory.tasks.delete(task_id);
        return jsonResult({ content: "任务已删除" });
      },
    },
    {
      label: "搜索记忆上下文",
      name: "smart_memory_search_context",
      description: "搜索相关的对话上下文记忆，可选择是否包含弱记忆",
      parameters: SearchContextSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, query, include_weak } = args as { user_id: string; query: string; include_weak?: boolean };
        
        let entities = entityStorage.searchEntities(user_id, query);
        
        if (!include_weak) {
          entities = entities.filter((e) => e.remainingDays >= 7 || e.isPermanent);
        }
        
        entities.sort(entityStorage.compareByPriority);
        
        const conversations = smartMemory.context.search(user_id, query);
        
        return jsonResult({
          conversations: conversations.slice(0, 3).map((c) => ({
            id: c.id,
            message_count: c.messages.length,
            last_message_at: new Date(c.lastMessageAt).toLocaleString("zh-CN"),
            messages: c.messages.slice(-5),
          })),
          entities: entities.map((e) => ({
            key: e.key,
            value: e.value,
            category: e.category,
            info_type: e.infoType,
            remaining_days: e.remainingDays,
            is_permanent: e.isPermanent,
            tier: getTier(e.remainingDays, e.isPermanent),
            tier_name: MEMORY_TIERS[getTier(e.remainingDays, e.isPermanent)]?.name,
            negative_feedback_count: e.negativeFeedbackCount,
          })),
        });
      },
    },
    {
      label: "获取最近对话上下文",
      name: "smart_memory_get_recent_context",
      description: "获取最近的对话上下文（用于重启后恢复对话）",
      parameters: GetRecentContextSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, count } = args as { user_id: string; count?: number };
        const conversations = smartMemory.context.getRecent(user_id, count ?? 5);
        return jsonResult({
          recovered_conversations: conversations.map((c) => ({
            id: c.id,
            message_count: c.messages.length,
            last_message_at: new Date(c.lastMessageAt).toLocaleString("zh-CN"),
            messages: c.messages,
          })),
        });
      },
    },
    {
      label: "添加消息到上下文",
      name: "smart_memory_add_message",
      description: "将用户消息添加到对话上下文",
      parameters: AddMessageSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { conversation_id, role, content } = args as {
          conversation_id: string;
          role: "user" | "assistant" | "system";
          content: string;
        };
        const conversation = smartMemory.context.addMessage(conversation_id, {
          role,
          content,
          timestamp: Date.now(),
        });
        return jsonResult({
          success: conversation !== null,
          conversation_id,
        });
      },
    },
    {
      label: "分析消息提取记忆",
      name: "smart_memory_analyze_message",
      description: "分析用户消息，提取关键信息并自动记忆",
      parameters: AnalyzeMessageSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, message } = args as { user_id: string; message: string };
        const result = await smartMemory.entities.analyze(user_id, message);
        return jsonResult({
          should_remember: result.shouldRemember,
          importance: result.importance,
          extracted_entities: result.entities.map((e) => ({
            key: e.key,
            value: e.value,
            category: e.category,
            info_type: e.infoType,
            remaining_days: e.remainingDays,
            tier: getTier(e.remainingDays, e.isPermanent),
          })),
        });
      },
    },
    {
      label: "设置永久记忆",
      name: "smart_memory_set_permanent",
      description: "将指定记忆设为永久记忆，永久保存不衰减",
      parameters: SetPermanentSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, key } = args as { user_id: string; key: string };
        const entity = entityStorage.getEntityByKey(user_id, key);
        if (!entity) {
          return jsonResult({ success: false, content: `未找到key为"${key}"的记忆` });
        }
        entityStorage.setPermanent(entity.id);
        return jsonResult({ success: true, content: `已将"${key}"设为永久记忆` });
      },
    },
    {
      label: "取消永久记忆",
      name: "smart_memory_remove_permanent",
      description: "取消永久记忆，恢复为正常记忆并重置剩余天数",
      parameters: RemovePermanentSchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, key, info_type } = args as { user_id: string; key: string; info_type: InfoType };
        const entity = entityStorage.getEntityByKey(user_id, key);
        if (!entity) {
          return jsonResult({ success: false, content: `未找到key为"${key}"的记忆` });
        }
        if (!entity.isPermanent) {
          return jsonResult({ success: false, content: `"${key}"不是永久记忆` });
        }
        entityStorage.removePermanent(entity.id, info_type);
        const initialDays = INITIAL_DAYS[info_type] || 60;
        return jsonResult({ success: true, content: `已取消"${key}"的永久状态，重置为${initialDays}天` });
      },
    },
    {
      label: "更新记忆",
      name: "smart_memory_update",
      description: "更新记忆的值，同时重置剩余天数",
      parameters: UpdateMemorySchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, key, new_value } = args as { user_id: string; key: string; new_value: string };
        const entity = entityStorage.getEntityByKey(user_id, key);
        if (!entity) {
          return jsonResult({ success: false, content: `未找到key为"${key}"的记忆` });
        }
        const updated = entityStorage.updateEntityValue(entity.id, new_value, `用户更新: ${new_value}`);
        if (updated) {
          return jsonResult({ 
            success: true, 
            content: `已更新"${key}"的值`,
            key: updated.key,
            value: updated.value,
            remaining_days: updated.remainingDays,
          });
        }
        return jsonResult({ success: false, content: "更新失败" });
      },
    },
    {
      label: "删除记忆",
      name: "smart_memory_delete",
      description: "删除指定记忆",
      parameters: DeleteMemorySchema,
      execute: async (_toolCallId: string, args: unknown) => {
        const { user_id, key } = args as { user_id: string; key: string };
        const entity = entityStorage.getEntityByKey(user_id, key);
        if (!entity) {
          return jsonResult({ success: false, content: `未找到key为"${key}"的记忆` });
        }
        entityStorage.deleteEntity(entity.id);
        return jsonResult({ success: true, content: `已删除"${key}"记忆` });
      },
    },
    {
      label: "记忆系统状态",
      name: "smart_memory_status",
      description: "查看记忆系统状态",
      parameters: StatusSchema,
      execute: async () => {
        const schedulerStatus = smartMemory.scheduler.status();
        
        const allEntities = entityStorage.getEntitiesByUser("");
        const permanentCount = allEntities.filter((e) => e.isPermanent).length;
        const weakCount = allEntities.filter((e) => e.remainingDays < 7 && !e.isPermanent).length;
        
        return jsonResult({
          scheduler: schedulerStatus,
          memory_stats: {
            total: allEntities.length,
            permanent: permanentCount,
            weak: weakCount,
          },
          tiers: MEMORY_TIERS,
        });
      },
    },
  ];
}

let initialized = false;

const memorySmartPlugin = {
  id: "memory-smart",
  name: "Smart Memory",
  description: "智能记忆系统，支持时间任务提醒、上下文记忆和自适应实体提取",
  kind: "memory",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    if (!initialized) {
      console.log("[SmartMemory] Initializing smart memory system...");
      try {
        smartMemory.initialize();
        initialized = true;
        console.log("[SmartMemory] Smart memory system initialized successfully");
      } catch (error) {
        console.error("[SmartMemory] Failed to initialize smart memory system:", error);
      }
    }

    api.registerTool(
      () => {
        return createMemoryTools();
      },
      {
        names: [
          "smart_memory_create_reminder",
          "smart_memory_create_scheduled_content",
          "smart_memory_list_tasks",
          "smart_memory_delete_task",
          "smart_memory_search_context",
          "smart_memory_get_recent_context",
          "smart_memory_add_message",
          "smart_memory_analyze_message",
          "smart_memory_set_permanent",
          "smart_memory_remove_permanent",
          "smart_memory_update",
          "smart_memory_delete",
          "smart_memory_status",
        ],
      },
    );
  },
};

export default memorySmartPlugin;
