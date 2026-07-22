const PRIORITIES = ["low", "medium", "high"];
const AREAS = ["Focus", "Project", "Study", "Health", "Admin", "Review", "Today"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const aiPlanSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intention", "summary", "tasks"],
  properties: {
    intention: {
      type: "string",
      minLength: 1,
      maxLength: 160,
    },
    summary: {
      type: "string",
      minLength: 1,
      maxLength: 240,
    },
    tasks: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "scheduledTime",
          "durationMinutes",
          "priority",
          "area",
          "isCritical",
          "rationale",
        ],
        properties: {
          title: {
            type: "string",
            minLength: 1,
            maxLength: 90,
          },
          scheduledTime: {
            type: "string",
            pattern: "^([01]\\d|2[0-3]):[0-5]\\d$",
          },
          durationMinutes: {
            type: "integer",
            minimum: 10,
            maximum: 180,
          },
          priority: {
            type: "string",
            enum: PRIORITIES,
          },
          area: {
            type: "string",
            enum: AREAS,
          },
          isCritical: {
            type: "boolean",
          },
          rationale: {
            type: "string",
            minLength: 1,
            maxLength: 160,
          },
        },
      },
    },
  },
};

export function normalizePlan(value) {
  const plan = typeof value === "object" && value !== null ? value : {};
  const rawTasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const tasks = rawTasks
    .map((task, index) => normalizeTask(task, index))
    .filter((task) => task.title)
    .slice(0, 8);

  if (tasks.length === 0) {
    tasks.push(
      normalizeTask(
        {
          title: "Clarify today's plan",
          scheduledTime: "09:00",
          durationMinutes: 25,
          priority: "high",
          area: "Focus",
          isCritical: true,
          rationale: "Start by turning the day into a clear plan.",
        },
        0,
      ),
    );
  }

  return {
    intention: cleanText(plan.intention, "Create one realistic plan for today.", 160),
    summary: cleanText(plan.summary, "A focused daily plan is ready to review.", 240),
    tasks: tasks.map((task, index) => ({
      ...task,
      isCritical: index === 0 ? true : Boolean(task.isCritical),
    })),
  };
}

export function createFallbackPlan(context = {}) {
  const prompt = cleanText(context.prompt, "", 1600);
  const memory =
    context.memory && typeof context.memory === "object" ? context.memory : {};
  const carryOverTasks = Array.isArray(memory.carryOverTasks)
    ? memory.carryOverTasks.map((task) => cleanText(task, "", 90)).filter(Boolean)
    : [];
  const recentUnfinishedTasks = Array.isArray(memory.recentDays)
    ? memory.recentDays.flatMap((day) =>
        Array.isArray(day?.unfinishedTasks)
          ? day.unfinishedTasks
              .map((task) => cleanText(task, "", 90))
              .filter(Boolean)
          : [],
      )
    : [];
  const memoryTasks = dedupeTaskTitles([
    ...carryOverTasks,
    ...recentUnfinishedTasks,
  ]).slice(0, 4);
  const existingTasks = Array.isArray(context.existingTasks)
    ? context.existingTasks
        .map((task) => cleanText(task?.title, "", 90))
        .filter(Boolean)
    : [];
  const promptTasks = extractTaskTitles(prompt);
  const titles = dedupeTaskTitles([
    ...memoryTasks,
    ...existingTasks,
    ...promptTasks,
  ]).slice(0, 6);
  const safeTitles = titles.length ? titles : ["Clarify today's plan"];
  const energy = clampNumber(context.energy, 3, 1, 5);
  const startTime = energy <= 2 ? "10:30" : energy === 3 ? "10:00" : "09:00";
  const firstDuration = energy <= 2 ? 25 : energy === 3 ? 45 : 75;
  let cursor = timeToMinutes(startTime);

  const tasks = safeTitles.map((title, index) => {
    const durationMinutes = index === 0 ? firstDuration : energy <= 2 ? 20 : 30;
    const scheduledTime = minutesToTime(cursor);
    cursor += durationMinutes + (index === 0 ? 15 : 10);

    return normalizeTask(
      {
        title,
        scheduledTime,
        durationMinutes,
        priority: index === 0 ? "high" : "medium",
        area: inferArea(title, index),
        isCritical: index === 0,
        rationale:
          index === 0
            ? "Start with the highest-leverage item while attention is freshest."
            : "Keep this block short so the plan stays flexible.",
      },
      index,
    );
  });

  return normalizePlan({
    intention: inferIntention(prompt, tasks[0]?.title),
    summary: memoryTasks.length
      ? "Local draft generated from your notes and saved planning memory. Add an OpenAI API key for a smarter plan."
      : "Local draft generated from your notes. Add an OpenAI API key for a smarter plan.",
    tasks,
  });
}

function normalizeTask(value, index) {
  const task = typeof value === "object" && value !== null ? value : {};
  const fallbackTime = minutesToTime(9 * 60 + index * 45);
  const title = cleanText(task.title, "", 90);
  const priority = PRIORITIES.includes(task.priority) ? task.priority : index === 0 ? "high" : "medium";
  const area = AREAS.includes(task.area) ? task.area : inferArea(title, index);

  return {
    title,
    scheduledTime: TIME_PATTERN.test(task.scheduledTime ?? "")
      ? task.scheduledTime
      : fallbackTime,
    durationMinutes: clampNumber(task.durationMinutes, index === 0 ? 45 : 30, 10, 180),
    priority,
    area,
    isCritical: Boolean(task.isCritical ?? index === 0),
    rationale: cleanText(task.rationale, "Planned from your day notes.", 160),
  };
}

function extractTaskTitles(prompt) {
  const withoutTimes = prompt.replace(
    /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)?\b/gi,
    "",
  );

  return withoutTimes
    .split(/\n|,|;|\.| 그리고 | 하고 | 해야 하고 | 해야 해 | 해야돼 | 해야 함 | also | and /i)
    .map((part) =>
      part
        .replace(
          /^\s*(today|i need to|i have to|i should|i have|i want to|want to|need to|오늘|나는|내가)\s*/i,
          "",
        )
        .trim()
        .replace(/\s+(at|around|by)$/i, "")
        .replace(/\s*(해야 한다|해야함|해야|할 거다|할꺼다|할거다)\s*$/i, "")
        .trim(),
    )
    .filter((part) => part.length >= 2)
    .slice(0, 6);
}

function dedupeTaskTitles(titles) {
  const seen = new Set();
  const result = [];

  for (const title of titles) {
    const text = cleanText(title, "", 90);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function inferIntention(prompt, firstTask) {
  if (prompt.toLowerCase().includes("tired") || prompt.includes("피곤")) {
    return "Keep today realistic and protect one meaningful win.";
  }

  if (prompt.toLowerCase().includes("deadline") || prompt.includes("마감")) {
    return "Protect time for the deadline before lower-priority work.";
  }

  return firstTask
    ? `Make progress on ${firstTask} without overloading the day.`
    : "Create one realistic plan for today.";
}

function inferArea(title, index) {
  const text = title.toLowerCase();
  if (index === 0) return "Focus";
  if (/class|study|lecture|homework|수업|공부|과제/.test(text)) return "Study";
  if (/workout|walk|gym|exercise|운동|헬스/.test(text)) return "Health";
  if (/project|portfolio|github|resume|프로젝트|포트폴리오|이력서/.test(text)) return "Project";
  if (/review|journal|reflect|회고|정리/.test(text)) return "Review";
  return "Today";
}

function cleanText(value, fallback, maxLength) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return (text || fallback).slice(0, maxLength);
}

function clampNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const minutesInDay = 24 * 60;
  const normalized = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}
