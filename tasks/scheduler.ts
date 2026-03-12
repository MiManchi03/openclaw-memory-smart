import * as taskStorage from "./storage.js";
import type { Task } from "../types.js";
import { defaultConfig } from "../config.js";

export type TaskTriggerHandler = (task: Task) => Promise<void>;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let triggerHandler: TaskTriggerHandler | null = null;

export function startScheduler(handler: TaskTriggerHandler): void {
  if (schedulerInterval) {
    return;
  }

  triggerHandler = handler;
  const intervalMs = defaultConfig.tasks.checkIntervalMs;

  schedulerInterval = setInterval(async () => {
    await checkAndTriggerTasks();
  }, intervalMs);

  checkAndTriggerTasks();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function checkAndTriggerTasks(): Promise<void> {
  if (!triggerHandler) {
    return;
  }

  const now = Date.now();
  const dueTasks = taskStorage.getDueTasks(now);

  for (const task of dueTasks) {
    try {
      await triggerHandler(task);

      taskStorage.processTaskTrigger(task);
    } catch (error) {
      console.error(`Failed to trigger task ${task.id}:`, error);
    }
  }
}

export function recoverTasks(): void {
  const activeTasks = taskStorage.getActiveTasks();
  const now = Date.now();

  for (const task of activeTasks) {
    if (task.triggerTime < now) {
      const nextTrigger = calculateNextValidTrigger(task);

      if (nextTrigger) {
        taskStorage.updateTaskTrigger(task.id, nextTrigger, task.triggerTime);
      }
    }
  }
}

function calculateNextValidTrigger(task: Task): number | null {
  const now = Date.now();
  let triggerTime = task.triggerTime;

  const maxIterations = 365;
  let iterations = 0;

  while (triggerTime < now && iterations < maxIterations) {
    switch (task.scheduleType) {
      case "daily":
        triggerTime += 24 * 60 * 60 * 1000;
        break;
      case "weekly":
        triggerTime += 7 * 24 * 60 * 60 * 1000;
        break;
      case "monthly":
        const date = new Date(triggerTime);
        date.setMonth(date.getMonth() + 1);
        triggerTime = date.getTime();
        break;
      case "once":
        return null;
      default:
        return null;
    }

    iterations++;
  }

  return triggerTime;
}

export function getSchedulerStatus(): { running: boolean; activeTasks: number; dueTasks: number } {
  const activeTasks = taskStorage.getActiveTasks();
  const now = Date.now();
  const dueTasks = activeTasks.filter((t: Task) => t.triggerTime <= now);

  return {
    running: schedulerInterval !== null,
    activeTasks: activeTasks.length,
    dueTasks: dueTasks.length,
  };
}
