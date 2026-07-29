import { getLocalDateKey } from "../../app/date-utils.js";
import type {
  AppState,
  DailyMemoryEntry,
  DailyStoredState,
  Mood,
  PersistentState,
  PlanGuideDraft,
  PlannerMemory,
  PlannerMemoryContext,
  Priority,
  Task,
} from "../../types/dayframe";

export const BASE_STORAGE_KEY = "dayframe-app-v4";
export const PERSISTENT_STORAGE_KEY = "dayframe:persistent-v1";
export const MEMORY_STORAGE_KEY = "dayframe-memory-v1";
export const DEVICE_STORAGE_KEY = "dayframe-device-id-v1";

const STALE_STORAGE_PREFIXES = ["dayframe-app-v3:", "dayframe-app-v2"];
const MEMORY_MAX_DAYS = 14;
const storeListeners = new Set<() => void>();
const memoryListeners = new Set<() => void>();

export const defaultState: AppState = {
  focus: "",
  energy: 3,
  mood: "clear",
  tasks: [],
  habits: [],
  goals: [],
  projects: [],
  journal: "",
  eveningJournal: "",
  note: "",
};

function clampNumber(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function normalizePriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

export function normalizeMood(value: unknown): Mood {
  return value === "calm" ||
    value === "clear" ||
    value === "bold" ||
    value === "tired"
    ? value
    : "clear";
}

function normalizeTask(task: Partial<Task>, index: number): Task {
  const fallbackSchedule = ["09:00", "11:00", "20:30"][index] ?? "";
  const fallbackPriority: Priority = task.area === "Focus" ? "high" : "medium";

  return {
    id: typeof task.id === "string" ? task.id : `task-${index + 1}`,
    title:
      typeof task.title === "string" && task.title.trim()
        ? task.title
        : defaultState.tasks[index]?.title ?? "Untitled task",
    area: typeof task.area === "string" ? task.area : "Today",
    done: Boolean(task.done),
    scheduledTime:
      typeof task.scheduledTime === "string"
        ? task.scheduledTime
        : fallbackSchedule,
    durationMinutes:
      typeof task.durationMinutes === "number" &&
      Number.isFinite(task.durationMinutes)
        ? task.durationMinutes
        : defaultState.tasks[index]?.durationMinutes ?? 30,
    priority: normalizePriority(task.priority ?? fallbackPriority),
    projectId: typeof task.projectId === "string" ? task.projectId : undefined,
    isCritical: Boolean(task.isCritical ?? (index === 0 && task.area === "Focus")),
    completedAt:
      typeof task.completedAt === "string" ? task.completedAt : undefined,
  };
}

export function normalizeState(value: Partial<AppState> = {}): AppState {
  return {
    ...defaultState,
    ...value,
    energy:
      typeof value.energy === "number" && Number.isFinite(value.energy)
        ? clampNumber(value.energy, 1, 5)
        : defaultState.energy,
    mood: normalizeMood(value.mood),
    tasks: Array.isArray(value.tasks)
      ? value.tasks.map((task, index) => normalizeTask(task, index))
      : defaultState.tasks,
    habits: Array.isArray(value.habits) ? value.habits : defaultState.habits,
    goals: Array.isArray(value.goals) ? value.goals : defaultState.goals,
    projects: Array.isArray(value.projects)
      ? value.projects
      : defaultState.projects,
    journal:
      typeof value.journal === "string" ? value.journal : defaultState.journal,
    eveningJournal:
      typeof value.eveningJournal === "string"
        ? value.eveningJournal
        : defaultState.eveningJournal,
    note: typeof value.note === "string" ? value.note : defaultState.note,
  };
}

export function normalizePersistentState(value: unknown = {}): PersistentState {
  const state = normalizeState((isRecord(value) ? value : {}) as Partial<AppState>);

  return {
    habits: state.habits.map((habit) => ({ ...habit, doneToday: false })),
    goals: state.goals,
    projects: state.projects,
  };
}

export function normalizeDailyStoredState(value: unknown = {}): DailyStoredState {
  const source = isRecord(value) ? value : {};
  const state = normalizeState((isRecord(value) ? value : {}) as Partial<AppState>);
  const habitCompletions = normalizeHabitCompletions(source.habitCompletions);

  if (!Object.keys(habitCompletions).length && Array.isArray(source.habits)) {
    for (const habit of source.habits) {
      if (!isRecord(habit) || typeof habit.id !== "string") continue;
      habitCompletions[habit.id] = Boolean(habit.doneToday);
    }
  }

  return {
    focus: state.focus,
    energy: state.energy,
    mood: state.mood,
    tasks: state.tasks,
    journal: state.journal,
    eveningJournal: state.eveningJournal,
    note: state.note,
    habitCompletions,
  };
}

export function extractPersistentState(state: AppState): PersistentState {
  return {
    habits: state.habits.map((habit) => ({ ...habit, doneToday: false })),
    goals: state.goals,
    projects: state.projects,
  };
}

export function extractDailyStoredState(state: AppState): DailyStoredState {
  return {
    focus: state.focus,
    energy: state.energy,
    mood: state.mood,
    tasks: state.tasks,
    journal: state.journal,
    eveningJournal: state.eveningJournal,
    note: state.note,
    habitCompletions: Object.fromEntries(
      state.habits.map((habit) => [habit.id, habit.doneToday]),
    ),
  };
}

function normalizeHabitCompletions(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value)
      .filter(([id]) => Boolean(id))
      .map(([id, done]) => [id, Boolean(done)]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cleanMemoryText(value: unknown, maxLength: number) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  return text.slice(0, maxLength);
}

function normalizeTextList(value: unknown, maxItems: number, maxLength = 90) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];

  for (const item of value) {
    const text = cleanMemoryText(item, maxLength);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    items.push(text);
    if (items.length >= maxItems) break;
  }

  return items;
}

function normalizeMemoryEntry(value: unknown): DailyMemoryEntry | null {
  if (!isRecord(value)) return null;

  const dateKey = cleanMemoryText(value.dateKey, 24);
  if (!dateKey) return null;

  return {
    dateKey,
    completedTasks: normalizeTextList(value.completedTasks, 12),
    unfinishedTasks: normalizeTextList(value.unfinishedTasks, 12),
    energy: Math.round(clampNumber(Number(value.energy) || 3, 1, 5)),
    mood: normalizeMood(value.mood),
    intention: cleanMemoryText(value.intention, 160),
    review: cleanMemoryText(value.review, 900),
    savedAt: cleanMemoryText(value.savedAt, 40) || `${dateKey}T00:00:00.000Z`,
  };
}

export function normalizePlannerMemory(value: unknown = {}): PlannerMemory {
  const memory = isRecord(value) ? value : {};
  const entries = Array.isArray(memory.entries)
    ? memory.entries
        .map(normalizeMemoryEntry)
        .filter((entry): entry is DailyMemoryEntry => Boolean(entry))
        .sort(compareMemoryEntries)
        .slice(0, MEMORY_MAX_DAYS)
    : [];

  return {
    entries,
    carryOverTasks: normalizeTextList(memory.carryOverTasks, 10),
    patterns: normalizeTextList(memory.patterns, 6, 140),
  };
}

function compareMemoryEntries(a: DailyMemoryEntry, b: DailyMemoryEntry) {
  return b.dateKey.localeCompare(a.dateKey) || b.savedAt.localeCompare(a.savedAt);
}

export function readPlannerMemory(): PlannerMemory {
  if (typeof window === "undefined") return normalizePlannerMemory();

  try {
    const saved = window.localStorage.getItem(MEMORY_STORAGE_KEY);
    return normalizePlannerMemory(saved ? JSON.parse(saved) : {});
  } catch {
    return normalizePlannerMemory();
  }
}

export function writePlannerMemory(memory: PlannerMemory) {
  const normalized = normalizePlannerMemory(memory);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(normalized));
  }
  notifyMemoryListeners();
  return normalized;
}

export function buildTodayMemoryEntry(
  state: AppState,
  dateKey: string,
  review: string,
): DailyMemoryEntry {
  return {
    dateKey,
    completedTasks: normalizeTextList(
      state.tasks.filter((task) => task.done).map((task) => task.title),
      12,
    ),
    unfinishedTasks: normalizeTextList(
      state.tasks.filter((task) => !task.done).map((task) => task.title),
      12,
    ),
    energy: Math.round(clampNumber(state.energy, 1, 5)),
    mood: state.mood,
    intention: cleanMemoryText(state.focus, 160),
    review: cleanMemoryText(review, 900),
    savedAt: new Date().toISOString(),
  };
}

export function updatePlannerMemory(memory: PlannerMemory, entry: DailyMemoryEntry) {
  const entries = [
    entry,
    ...memory.entries.filter((item) => item.dateKey !== entry.dateKey),
  ]
    .sort(compareMemoryEntries)
    .slice(0, MEMORY_MAX_DAYS);

  return normalizePlannerMemory({
    entries,
    carryOverTasks: entry.unfinishedTasks,
    patterns: inferMemoryPatterns(entries),
  });
}

function inferMemoryPatterns(entries: DailyMemoryEntry[]) {
  const recentEntries = entries.slice(0, 5);
  if (!recentEntries.length) return [];

  const patterns: string[] = [];
  const lowEnergyDays = recentEntries.filter((entry) => entry.energy <= 2).length;
  const heavyCarryDays = recentEntries.filter(
    (entry) =>
      entry.unfinishedTasks.length >=
      Math.max(2, entry.completedTasks.length + 1),
  ).length;
  const repeatedTasks = new Map<string, { title: string; count: number }>();

  for (const entry of recentEntries) {
    for (const task of entry.unfinishedTasks) {
      const key = task.toLowerCase();
      const current = repeatedTasks.get(key) ?? { title: task, count: 0 };
      repeatedTasks.set(key, { ...current, count: current.count + 1 });
    }
  }

  const recurringCarryOver = [...repeatedTasks.values()]
    .filter((item) => item.count > 1)
    .map((item) => item.title)
    .slice(0, 2);

  if (recurringCarryOver.length) {
    patterns.push(`Recurring carry-over: ${recurringCarryOver.join(", ")}`);
  }
  if (lowEnergyDays >= 2) {
    patterns.push("Recent low-energy days need a lighter first block.");
  }
  if (heavyCarryDays >= 2) {
    patterns.push(
      "Recent plans left several tasks unfinished, so keep the next draft narrower.",
    );
  }

  return patterns.slice(0, 4);
}

export function summarizePlannerMemory(memory: PlannerMemory): PlannerMemoryContext {
  const normalized = normalizePlannerMemory(memory);

  return {
    recentDays: normalized.entries.slice(0, 5).map((entry) => ({
      dateKey: entry.dateKey,
      completedTasks: entry.completedTasks,
      unfinishedTasks: entry.unfinishedTasks,
      energy: entry.energy,
      mood: entry.mood,
      intention: entry.intention,
      review: entry.review,
    })),
    carryOverTasks: normalized.carryOverTasks,
    patterns: normalized.patterns,
  };
}

export function buildPlanningPrompt(notes: string, guide: PlanGuideDraft) {
  const sections = [
    ["General notes", notes],
    ["Fixed events", guide.fixedEvents],
    ["Must do", guide.mustDo],
    ["Would like", guide.wantToDo],
    ["Constraints", guide.constraints],
  ]
    .map(([label, value]) => [label, value.trim()] as const)
    .filter(([, value]) => value);

  return sections.map(([label, value]) => `${label}: ${value}`).join("\n");
}

export function storageKeyForToday() {
  return `${BASE_STORAGE_KEY}:${getLocalDateKey()}`;
}

export function readDailyStoredState(): DailyStoredState {
  if (typeof window === "undefined") return extractDailyStoredState(defaultState);

  const saved = window.localStorage.getItem(storageKeyForToday());
  return saved
    ? normalizeDailyStoredState(JSON.parse(saved))
    : extractDailyStoredState(defaultState);
}

export function readPersistentState(): PersistentState {
  if (typeof window === "undefined") return extractPersistentState(defaultState);

  const saved = window.localStorage.getItem(PERSISTENT_STORAGE_KEY);
  if (saved) return normalizePersistentState(JSON.parse(saved));

  const legacy = readLegacyPersistentState();
  if (legacy.habits.length || legacy.goals.length || legacy.projects.length) {
    window.localStorage.setItem(PERSISTENT_STORAGE_KEY, JSON.stringify(legacy));
  }

  return legacy;
}

export function readLegacyPersistentState(): PersistentState {
  if (typeof window === "undefined") return extractPersistentState(defaultState);

  try {
    const saved = window.localStorage.getItem(storageKeyForToday());
    if (!saved) return extractPersistentState(defaultState);

    return extractPersistentState(normalizeState(JSON.parse(saved)));
  } catch {
    return extractPersistentState(defaultState);
  }
}

export function getSyncDeviceId() {
  if (typeof window === "undefined") return "server-device";

  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;

    const generated =
      typeof window.crypto?.randomUUID === "function"
        ? `browser-${window.crypto.randomUUID()}`
        : `browser-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    window.localStorage.setItem(DEVICE_STORAGE_KEY, generated);
    return generated;
  } catch {
    return "local-device";
  }
}

export function clearStaleDemoStorage() {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (STALE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}

export function readStoredState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const dailyState = readDailyStoredState();
    const persistentState = readPersistentState();
    const habits = persistentState.habits.map((habit) => ({
      ...habit,
      doneToday: Boolean(dailyState.habitCompletions[habit.id]),
    }));
    clearStaleDemoStorage();

    return normalizeState({
      ...dailyState,
      ...persistentState,
      habits,
    });
  } catch {
    return defaultState;
  }
}

export function getStoredSnapshot() {
  return JSON.stringify(readStoredState());
}

export function getServerSnapshot() {
  return JSON.stringify(defaultState);
}

export function subscribeToStore(listener: () => void) {
  storeListeners.add(listener);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    storeListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

export function notifyStoreListeners() {
  storeListeners.forEach((listener) => listener());
}

export function writeStoredState(next: AppState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      storageKeyForToday(),
      JSON.stringify(extractDailyStoredState(next)),
    );
    window.localStorage.setItem(
      PERSISTENT_STORAGE_KEY,
      JSON.stringify(extractPersistentState(next)),
    );
  }
  notifyStoreListeners();
}

export function getStoredMemorySnapshot() {
  return JSON.stringify(readPlannerMemory());
}

export function getServerMemorySnapshot() {
  return JSON.stringify(normalizePlannerMemory());
}

export function subscribeToMemoryStore(listener: () => void) {
  memoryListeners.add(listener);

  if (typeof window !== "undefined") {
    window.addEventListener("storage", listener);
  }

  return () => {
    memoryListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", listener);
    }
  };
}

function notifyMemoryListeners() {
  memoryListeners.forEach((listener) => listener());
}
