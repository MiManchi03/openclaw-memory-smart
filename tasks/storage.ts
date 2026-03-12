import { getDb } from "../shared/db.js";
import type { Task, TaskStatus, TaskType, ScheduleType } from "../types.js";
import { calculateNextTrigger, parseTimeExpression } from "./parser.js";

function generateId(): string {
  return crypto.randomUUID();
}

export function createTask(
  userId: string,
  input: string,
  taskType: TaskType = "reminder",
  implementation?: string
): Task {
  const parsed = parseTimeExpression(input);
  const now = Date.now();

  const task: Task = {
    id: generateId(),
    userId,
    taskType,
    content: parsed.content,
    scheduleType: parsed.scheduleType,
    scheduleExpression: parsed.scheduleExpression,
    implementation,
    triggerTime: parsed.triggerTime,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const db = getDb();
  db.prepare(`
    INSERT INTO tasks (id, user_id, task_type, title, content, schedule_expression, schedule_type, implementation, trigger_time, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id,
    task.userId,
    task.taskType,
    task.title ?? null,
    task.content,
    task.scheduleExpression ?? null,
    task.scheduleType,
    task.implementation ?? null,
    task.triggerTime,
    task.status,
    task.createdAt,
    task.updatedAt
  );

  return task;
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;

  if (!row) {
    return null;
  }

  return mapRowToTask(row);
}

export function getTasksByUser(userId: string, status?: TaskStatus): Task[] {
  const db = getDb();

  let query = "SELECT * FROM tasks WHERE user_id = ?";
  const params: (string | TaskStatus)[] = [userId];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC";

  const rows = db.prepare(query).all(...params) as unknown as TaskRow[];
  return rows.map(mapRowToTask);
}

export function getActiveTasks(): Task[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM tasks WHERE status = 'active' ORDER BY trigger_time ASC").all() as unknown as TaskRow[];
  return rows.map(mapRowToTask);
}

export function getDueTasks(currentTime: number): Task[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM tasks WHERE status = 'active' AND trigger_time <= ? ORDER BY trigger_time ASC")
    .all(currentTime) as unknown as TaskRow[];
  return rows.map(mapRowToTask);
}

export function updateTaskStatus(id: string, status: TaskStatus): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), id);
}

export function updateTaskTrigger(id: string, triggerTime: number, lastTriggered: number): void {
  const db = getDb();
  db.prepare("UPDATE tasks SET trigger_time = ?, last_triggered = ?, updated_at = ? WHERE id = ?").run(
    triggerTime,
    lastTriggered,
    Date.now(),
    id
  );
}

export function completeTask(id: string): void {
  updateTaskStatus(id, "completed");
}

export function pauseTask(id: string): void {
  updateTaskStatus(id, "paused");
}

export function resumeTask(id: string): void {
  updateTaskStatus(id, "active");
}

export function deleteTask(id: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

export function processTaskTrigger(task: Task): Task | null {
  if (task.scheduleType === "once") {
    completeTask(task.id);
    return null;
  }

  const nextTrigger = calculateNextTrigger(task.scheduleType, task.triggerTime, task.scheduleExpression);
  updateTaskTrigger(task.id, nextTrigger, task.triggerTime);

  return {
    ...task,
    triggerTime: nextTrigger,
    lastTriggered: task.triggerTime,
  };
}

interface TaskRow {
  id: string;
  user_id: string;
  task_type: string;
  title: string | null;
  content: string;
  schedule_expression: string | null;
  schedule_type: string;
  implementation: string | null;
  trigger_time: number;
  last_triggered: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    taskType: row.task_type as TaskType,
    title: row.title ?? undefined,
    content: row.content,
    scheduleExpression: row.schedule_expression ?? undefined,
    scheduleType: row.schedule_type as ScheduleType,
    implementation: row.implementation ?? undefined,
    triggerTime: row.trigger_time,
    lastTriggered: row.last_triggered ?? undefined,
    status: row.status as TaskStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
