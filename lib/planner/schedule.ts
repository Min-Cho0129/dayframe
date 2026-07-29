import type { Mood, Priority, ScheduleInsight, Task, TimelineSegment } from "../../types/dayframe";

export const MINUTES_PER_DAY = 24 * 60;
export const SCHEDULE_ROUNDING_MINUTES = 15;
export const DEFAULT_DAY_END_MINUTES = 22 * 60;

const moodRecommendations: Record<Mood, string> = {
  calm: "Use calm for planning, writing, and thoughtful cleanup.",
  clear: "Use clear for focused work that needs sustained attention.",
  bold: "Use bold for hard decisions, outreach, and high-friction tasks.",
  tired: "Use tired for light admin, reset tasks, and small repeatable steps.",
};

const priorityLabels: Record<Priority, string> = {
  low: "Low priority",
  medium: "Medium priority",
  high: "High priority",
};

export function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function clampMinutes(value: number) {
  return Math.round(clamp(value, 5, 480));
}

export function compareTasks(a: Task, b: Task) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  if (Boolean(a.isCritical) !== Boolean(b.isCritical)) {
    return a.isCritical ? -1 : 1;
  }
  if (a.scheduledTime && b.scheduledTime) {
    return a.scheduledTime.localeCompare(b.scheduledTime);
  }
  if (a.scheduledTime) return -1;
  if (b.scheduledTime) return 1;
  return a.title.localeCompare(b.title);
}

export function compareScheduledTasks(a: Task, b: Task) {
  if (a.scheduledTime && b.scheduledTime) {
    const timeOrder = a.scheduledTime.localeCompare(b.scheduledTime);
    if (timeOrder !== 0) return timeOrder;
  }
  if (a.done !== b.done) return a.done ? 1 : -1;
  return a.title.localeCompare(b.title);
}

export function formatTimeLabel(time: string) {
  if (!time) return "Unscheduled";
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;

  return formatMinutesAsTimeLabel(hour * 60 + minute);
}

export function formatMinutesAsTimeLabel(totalMinutes: number) {
  const normalized =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

export function formatMinutesAsInputTime(totalMinutes: number) {
  const normalized =
    ((totalMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minute = String(normalized % 60).padStart(2, "0");

  return `${hour}:${minute}`;
}

export function getRoundedCurrentScheduleStart() {
  const date = new Date();
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const rounded =
    Math.ceil(currentMinutes / SCHEDULE_ROUNDING_MINUTES) *
    SCHEDULE_ROUNDING_MINUTES;

  return Math.min(rounded, DEFAULT_DAY_END_MINUTES);
}

export function formatDuration(minutes: number) {
  const safeMinutes = clampMinutes(minutes);
  if (safeMinutes < 60) return `${safeMinutes} min`;

  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${hours} hr${hours > 1 ? "s" : ""}${remainder ? ` ${remainder} min` : ""}`;
}

export function formatTaskMeta(task: Task) {
  return `${formatTimeLabel(task.scheduledTime)} · ${formatDuration(
    task.durationMinutes,
  )} · ${priorityLabels[task.priority]}`;
}

export function parseScheduleMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return hour * 60 + minute;
}

export function getDefaultScheduleStart(energy: number) {
  const safeEnergy = Math.round(clamp(energy, 1, 5));
  if (safeEnergy <= 2) return 10 * 60 + 30;
  if (safeEnergy === 3) return 10 * 60;
  return 9 * 60;
}

export function findAvailableScheduleStart(
  blocks: Array<{ start: number; end: number }>,
  earliestStart: number,
  durationMinutes: number,
) {
  let cursor = earliestStart;

  for (const block of [...blocks].sort((a, b) => a.start - b.start)) {
    if (cursor + durationMinutes <= block.start) return cursor;
    if (cursor < block.end + 10) cursor = block.end + 10;
  }

  return cursor;
}

export function getScheduleInsights(tasks: Task[], energy: number): ScheduleInsight[] {
  const activeTasks = tasks.filter((task) => !task.done);
  const unscheduledCount = activeTasks.filter((task) => !task.scheduledTime).length;
  const scheduled = activeTasks
    .map((task) => {
      const start = parseScheduleMinutes(task.scheduledTime);
      return start === null
        ? null
        : { task, start, end: start + clampMinutes(task.durationMinutes) };
    })
    .filter(
      (item): item is { task: Task; start: number; end: number } => Boolean(item),
    )
    .sort((a, b) => a.start - b.start);
  const insights: ScheduleInsight[] = [];

  if (!scheduled.length) {
    return [
      {
        level: "info",
        label: "Schedule check",
        detail: "Add times to tasks to check conflicts and workload.",
      },
    ];
  }

  const overlap = scheduled.find((block, index) => {
    const previous = scheduled[index - 1];
    return previous ? block.start < previous.end : false;
  });
  const totalMinutes = scheduled.reduce(
    (sum, block) => sum + clampMinutes(block.task.durationMinutes),
    0,
  );
  const energyCapacity = [0, 120, 180, 270, 360, 450][
    Math.round(clamp(energy, 1, 5))
  ];
  const largestGap = scheduled.slice(1).reduce(
    (largest, block, index) => {
      const previous = scheduled[index];
      const gap = block.start - previous.end;
      return gap > largest.minutes
        ? { minutes: gap, start: previous.end, end: block.start }
        : largest;
    },
    { minutes: 0, start: 0, end: 0 },
  );

  if (overlap) {
    insights.push({
      level: "warning",
      label: "Time overlap",
      detail: `${overlap.task.title} starts before the previous block ends.`,
    });
  } else {
    insights.push({
      level: "ok",
      label: "No overlaps",
      detail: `${scheduled.length} scheduled block${scheduled.length === 1 ? "" : "s"} are ordered cleanly.`,
    });
  }

  if (totalMinutes > energyCapacity) {
    insights.push({
      level: "warning",
      label: "Heavy plan",
      detail: `${formatDuration(totalMinutes)} scheduled, above today's ${formatDuration(
        energyCapacity,
      )} energy budget.`,
    });
  } else {
    insights.push({
      level: "ok",
      label: "Workload fit",
      detail: `${formatDuration(totalMinutes)} scheduled within today's energy budget.`,
    });
  }

  if (unscheduledCount) {
    insights.push({
      level: "info",
      label: "Unscheduled tasks",
      detail: `${unscheduledCount} open task${unscheduledCount === 1 ? "" : "s"} still need a time.`,
    });
  } else if (largestGap.minutes >= 45) {
    insights.push({
      level: "info",
      label: "Open space",
      detail: `${formatDuration(largestGap.minutes)} free between ${formatMinutesAsTimeLabel(
        largestGap.start,
      )} and ${formatMinutesAsTimeLabel(largestGap.end)}.`,
    });
  }

  return insights.slice(0, 3);
}

export function getDailyTimeline(tasks: Task[]): TimelineSegment[] {
  const scheduled = tasks
    .map((task) => {
      const start = parseScheduleMinutes(task.scheduledTime);
      return start === null
        ? null
        : { task, start, end: start + clampMinutes(task.durationMinutes) };
    })
    .filter(
      (item): item is { task: Task; start: number; end: number } => Boolean(item),
    )
    .sort((a, b) => a.start - b.start || a.task.title.localeCompare(b.task.title));
  const segments: TimelineSegment[] = [];
  let previousEnd = scheduled[0]?.start ?? 0;

  for (const block of scheduled) {
    const gap = block.start - previousEnd;
    if (gap >= 20) {
      segments.push({
        id: `gap-${previousEnd}-${block.start}`,
        kind: "gap",
        start: previousEnd,
        end: block.start,
        title: "Open space",
        detail: formatDuration(gap),
      });
    }

    segments.push({
      id: block.task.id,
      kind: "task",
      start: block.start,
      end: block.end,
      title: block.task.title,
      detail: `${formatDuration(block.task.durationMinutes)} · ${priorityLabels[block.task.priority]} · ${block.task.area}`,
      done: block.task.done,
      overlap: block.start < previousEnd,
      priority: block.task.priority,
    });

    previousEnd = Math.max(previousEnd, block.end);
  }

  return segments;
}

export function getTimelineSegmentHeight(segment: TimelineSegment) {
  const minutes = Math.max(0, segment.end - segment.start);
  const minimum = segment.kind === "gap" ? 34 : 58;
  return `${Math.round(clamp(minutes, minimum, 150))}px`;
}

export function getEnergyRecommendation(energy: number, mood: Mood) {
  const recommendations: Record<
    number,
    {
      label: string;
      advice: string;
      moodHint: string;
    }
  > = {
    1: {
      label: "Low energy",
      advice: "Pick one tiny task, keep the plan light, and postpone optional work.",
      moodHint: moodRecommendations[mood],
    },
    2: {
      label: "Light energy",
      advice: "Start with a 15-minute task before committing to deeper work.",
      moodHint: moodRecommendations[mood],
    },
    3: {
      label: "Steady energy",
      advice: "Use one 25-minute focus block and keep the rest of the plan realistic.",
      moodHint: moodRecommendations[mood],
    },
    4: {
      label: "Strong energy",
      advice: "Do your most important task first, then schedule a smaller follow-up.",
      moodHint: moodRecommendations[mood],
    },
    5: {
      label: "Peak energy",
      advice: "Protect a longer deep-work block for the hardest task on your list.",
      moodHint: moodRecommendations[mood],
    },
  };

  return recommendations[Math.round(clamp(energy, 1, 5))];
}
