import type { ScheduleType } from "../types.js";

interface ParsedSchedule {
  scheduleType: ScheduleType;
  scheduleExpression?: string;
  triggerTime: number;
  content: string;
}

interface TimeComponents {
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  month?: number;
}

export function parseTimeExpression(input: string): ParsedSchedule {
  const now = new Date();
  const lowerInput = input.toLowerCase().trim();

  if (lowerInput.includes("每天") || lowerInput.includes("每日")) {
    return parseDaily(lowerInput, now);
  }

  if (lowerInput.includes("每周")) {
    return parseWeekly(lowerInput, now);
  }

  if (lowerInput.includes("每月") || lowerInput.includes("每个月")) {
    return parseMonthly(lowerInput, now);
  }

  if (lowerInput.includes("下下周")) {
    return parseAfterTwoWeeks(lowerInput, now);
  }

  if (lowerInput.includes("下个月")) {
    return parseNextMonth(lowerInput, now);
  }

  if (lowerInput.includes("下周")) {
    return parseNextWeek(lowerInput, now);
  }

  return parseOneTime(lowerInput, now);
}

function parseDaily(input: string, now: Date): ParsedSchedule {
  const time = extractTime(input);
  const trigger = new Date(now);
  trigger.setHours(time.hour ?? 7, time.minute ?? 0, 0, 0);

  if (trigger <= now) {
    trigger.setDate(trigger.getDate() + 1);
  }

  const content = extractContent(input, "每天");

  return {
    scheduleType: "daily",
    scheduleExpression: `0 ${time.minute ?? 0} ${time.hour ?? 7} * * *`,
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseWeekly(input: string, now: Date): ParsedSchedule {
  const dayOfWeek = extractDayOfWeek(input);
  const time = extractTime(input);

  const trigger = getNextDayOfWeek(now, dayOfWeek, time.hour ?? 7, time.minute ?? 0);

  const content = extractContent(input, "每周");

  return {
    scheduleType: "weekly",
    scheduleExpression: `0 ${time.minute ?? 0} ${time.hour ?? 7} * * ${dayOfWeek}`,
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseMonthly(input: string, now: Date): ParsedSchedule {
  const dayOfMonth = extractDayOfMonth(input) ?? 1;
  const time = extractTime(input);

  const trigger = getNextDayOfMonth(now, dayOfMonth, time.hour ?? 7, time.minute ?? 0);

  const content = extractContent(input, "每月");

  return {
    scheduleType: "monthly",
    scheduleExpression: `0 ${time.minute ?? 0} ${time.hour ?? 7} ${dayOfMonth} * *`,
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseNextWeek(input: string, now: Date): ParsedSchedule {
  const dayOfWeek = extractDayOfWeek(input);
  const time = extractTime(input);

  const trigger = getNextDayOfWeek(now, dayOfWeek, time.hour ?? 7, time.minute ?? 0, 1);

  const content = extractContent(input, "下周");

  return {
    scheduleType: "once",
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseAfterTwoWeeks(input: string, now: Date): ParsedSchedule {
  const dayOfWeek = extractDayOfWeek(input);
  const time = extractTime(input);

  const trigger = getNextDayOfWeek(now, dayOfWeek, time.hour ?? 7, time.minute ?? 0, 2);

  const content = extractContent(input, "下下周");

  return {
    scheduleType: "once",
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseNextMonth(input: string, now: Date): ParsedSchedule {
  const time = extractTime(input);
  const dayOfMonth = extractDayOfMonth(input) ?? time.dayOfMonth ?? 1;

  const trigger = getNextMonthDay(now, dayOfMonth, time.hour ?? 7, time.minute ?? 0);

  const content = extractContent(input, "下个月");

  return {
    scheduleType: "once",
    triggerTime: trigger.getTime(),
    content,
  };
}

function parseOneTime(input: string, now: Date): ParsedSchedule {
  const time = extractTime(input);
  const dateMatch = input.match(/(\d{1,2})[月/-](\d{1,2})/);

  let trigger: Date;

  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    const day = parseInt(dateMatch[2], 10);
    trigger = new Date(now.getFullYear(), month - 1, day, time.hour ?? 18, time.minute ?? 0, 0, 0);

    if (trigger <= now) {
      trigger.setFullYear(trigger.getFullYear() + 1);
    }
  } else {
    trigger = new Date(now);
    trigger.setHours(time.hour ?? 18, time.minute ?? 0, 0, 0);

    if (trigger <= now) {
      trigger.setDate(trigger.getDate() + 1);
    }
  }

  const content = extractContent(input, "");

  return {
    scheduleType: "once",
    triggerTime: trigger.getTime(),
    content,
  };
}

function extractTime(input: string): TimeComponents {
  const result: TimeComponents = {};

  const timeMatch = input.match(/(\d{1,2})[点时:：](\d{1,2})?/);
  if (timeMatch) {
    result.hour = parseInt(timeMatch[1], 10);
    result.minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  } else {
    const hourOnlyMatch = input.match(/(\d{1,2})[点时]/);
    if (hourOnlyMatch) {
      result.hour = parseInt(hourOnlyMatch[1], 10);
      result.minute = 0;
    }
  }

  const dayOfMonthMatch = input.match(/(\d{1,2})[号日]/);
  if (dayOfMonthMatch) {
    result.dayOfMonth = parseInt(dayOfMonthMatch[1], 10);
  }

  return result;
}

function extractDayOfWeek(input: string): number {
  const days: Record<string, number> = {
    星期天: 0,
    星期日: 0,
    星期一: 1,
    周一: 1,
    星期二: 2,
    周二: 2,
    星期三: 3,
    周三: 3,
    星期四: 4,
    周四: 4,
    星期五: 5,
    周五: 5,
    星期六: 6,
    周六: 6,
  };

  for (const [key, value] of Object.entries(days)) {
    if (input.includes(key)) {
      return value;
    }
  }

  return 1;
}

function extractDayOfMonth(input: string): number | null {
  const match = input.match(/(\d{1,2})[号日]/);
  return match ? parseInt(match[1], 10) : null;
}

function extractContent(input: string, prefix: string): string {
  let content = input.replace(prefix, "").trim();
  content = content.replace(/提醒[我你]?/g, "").trim();
  content = content.replace(/每天|每日|每周|每月|每个星期|每个月/g, "").trim();
  content = content.replace(/\d{1,2}[点时:：]\d{0,2}/g, "").trim();
  content = content.replace(/下周|下周|下个月|本月|今天|明天|后天/g, "").trim();

  const chineseNumbers = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  chineseNumbers.forEach((num) => {
    content = content.replace(new RegExp(`下下${num}`, "g"), "");
  });

  return content || "提醒";
}

function getNextDayOfWeek(
  now: Date,
  targetDay: number,
  hour: number,
  minute: number,
  weeksAhead: number = 0
): Date {
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);

  const currentDay = result.getDay();
  let daysUntilTarget = targetDay - currentDay;

  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7;
  }

  daysUntilTarget += weeksAhead * 7;

  result.setDate(result.getDate() + daysUntilTarget);

  return result;
}

function getNextDayOfMonth(now: Date, dayOfMonth: number, hour: number, minute: number): Date {
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  result.setDate(dayOfMonth);

  if (result <= now) {
    result.setMonth(result.getMonth() + 1);
  }

  return result;
}

function getNextMonthDay(now: Date, dayOfMonth: number, hour: number, minute: number): Date {
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);
  result.setDate(dayOfMonth);
  result.setMonth(result.getMonth() + 1);

  if (result <= now) {
    result.setMonth(result.getMonth() + 1);
  }

  return result;
}

export function calculateNextTrigger(
  scheduleType: ScheduleType,
  currentTrigger: number,
  _scheduleExpression?: string
): number {
  const current = new Date(currentTrigger);

  switch (scheduleType) {
    case "daily":
      current.setDate(current.getDate() + 1);
      break;
    case "weekly":
      current.setDate(current.getDate() + 7);
      break;
    case "monthly":
      current.setMonth(current.getMonth() + 1);
      break;
    case "once":
      return currentTrigger;
  }

  return current.getTime();
}
