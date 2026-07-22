"use client";

import {
  BatteryCharging,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Flame,
  FolderKanban,
  Gauge,
  ListChecks,
  NotebookPen,
  Plus,
  Sparkles,
  Sunrise,
  Target,
  TimerReset,
  Trash2,
  TrendingUp,
  Undo2,
  X,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  formatLocalDate,
  getLocalDateKey,
  getMillisecondsUntilNextLocalDay,
} from "./date-utils.js";

type Priority = "low" | "medium" | "high";
type Mood = "calm" | "clear" | "bold" | "tired";

type Task = {
  id: string;
  title: string;
  area: string;
  done: boolean;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
  projectId?: string;
  isCritical?: boolean;
  completedAt?: string;
};

type Habit = {
  id: string;
  name: string;
  streak: number;
  target: string;
  doneToday: boolean;
};

type Goal = {
  id: string;
  title: string;
  horizon: string;
  progress: number;
};

type Project = {
  id: string;
  name: string;
  stage: string;
  progress: number;
  nextAction: string;
};

type DailyQuote = {
  text: string;
  tag: string;
};

type AppState = {
  focus: string;
  energy: number;
  mood: Mood;
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  journal: string;
  eveningJournal: string;
  note: string;
};

type PlanDraft = {
  criticalTitle: string;
  scheduledTime: string;
  durationMinutes: number;
  extraTask: string;
  intention: string;
};

type TaskDraft = {
  title: string;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
};

type HabitDraft = {
  name: string;
  target: string;
};

type GoalDraft = {
  title: string;
  horizon: string;
};

type ProjectDraft = {
  name: string;
  stage: string;
  nextAction: string;
};

type TodaySnapshot = {
  dateKey: string;
  label: string;
};

type UndoState = {
  message: string;
  previous: AppState;
};

const BASE_STORAGE_KEY = "dayframe-app-v4";
const STALE_STORAGE_PREFIXES = ["dayframe-app-v3:", "dayframe-app-v2"];
const storeListeners = new Set<() => void>();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const dailyQuotes: DailyQuote[] = [
  {
    text: "Small starts create the kind of momentum big plans cannot fake.",
    tag: "Start small",
  },
  {
    text: "The day gets easier when the first step is visible.",
    tag: "Find the step",
  },
  {
    text: "Focus is not doing more. It is deciding what gets your best energy.",
    tag: "Choose focus",
  },
  {
    text: "A clear morning turns scattered effort into directed progress.",
    tag: "Set direction",
  },
  {
    text: "Progress begins when today has a shape.",
    tag: "Frame the day",
  },
  {
    text: "Make the next action simple enough that resistance has nowhere to hide.",
    tag: "Lower friction",
  },
  {
    text: "Consistency is built by returning, not by never missing.",
    tag: "Return again",
  },
  {
    text: "Your calendar does not need more ambition. It needs cleaner decisions.",
    tag: "Decide cleanly",
  },
  {
    text: "The best plan is the one that survives contact with your real energy.",
    tag: "Plan honestly",
  },
  {
    text: "One completed priority changes the tone of the entire day.",
    tag: "Finish one",
  },
  {
    text: "A good routine is a quiet agreement with the person you are becoming.",
    tag: "Keep the promise",
  },
  {
    text: "Clarity compounds when you write down what matters before the noise begins.",
    tag: "Write first",
  },
  {
    text: "Do not wait for a perfect mood. Build a small doorway into action.",
    tag: "Begin anyway",
  },
  {
    text: "The work feels lighter when the next move is already chosen.",
    tag: "Preselect action",
  },
  {
    text: "Energy follows motion more often than motion follows energy.",
    tag: "Move first",
  },
  {
    text: "Today does not need to be full. It needs to be intentional.",
    tag: "Less, better",
  },
  {
    text: "Protect the first hour and the rest of the day has a better chance.",
    tag: "Guard the morning",
  },
  {
    text: "A project moves when the next action is smaller than the excuse.",
    tag: "Make it smaller",
  },
  {
    text: "Reflection turns experience into guidance instead of noise.",
    tag: "Reflect",
  },
  {
    text: "The future is negotiated through what you repeat today.",
    tag: "Repeat well",
  },
  {
    text: "You do not need a dramatic reset. You need one honest next step.",
    tag: "Next step",
  },
  {
    text: "Attention is a budget. Spend it where the return is real.",
    tag: "Spend attention",
  },
  {
    text: "A calmer plan usually beats a louder one.",
    tag: "Calm wins",
  },
  {
    text: "The day becomes manageable when every task has a place to land.",
    tag: "Give it a place",
  },
  {
    text: "Track what you want to trust yourself with.",
    tag: "Build trust",
  },
  {
    text: "A habit is a vote you cast before the day starts negotiating.",
    tag: "Vote early",
  },
  {
    text: "Momentum is earned by closing loops, not collecting intentions.",
    tag: "Close loops",
  },
  {
    text: "Your goals need evidence. Give them one small proof today.",
    tag: "Create proof",
  },
  {
    text: "The right list should make action feel closer, not farther away.",
    tag: "Useful lists",
  },
  {
    text: "Start with the task that will make everything else feel less heavy.",
    tag: "Lighten the day",
  },
];

const defaultState: AppState = {
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

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  clear: "Clear",
  bold: "Bold",
  tired: "Tired",
};

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

function normalizePriority(value: unknown): Priority {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : "medium";
}

function normalizeMood(value: unknown): Mood {
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

function normalizeState(value: Partial<AppState> = {}): AppState {
  return {
    ...defaultState,
    ...value,
    energy:
      typeof value.energy === "number" && Number.isFinite(value.energy)
        ? clamp(value.energy, 1, 5)
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

function storageKeyForToday() {
  return `${BASE_STORAGE_KEY}:${getLocalDateKey()}`;
}

function clearStaleDemoStorage() {
  if (typeof window === "undefined") return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (STALE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}

function readStoredState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const saved = window.localStorage.getItem(storageKeyForToday());
    if (saved) return normalizeState(JSON.parse(saved));

    clearStaleDemoStorage();
    return defaultState;
  } catch {
    return defaultState;
  }
}

function getStoredSnapshot() {
  return JSON.stringify(readStoredState());
}

function getServerSnapshot() {
  return JSON.stringify(defaultState);
}

function subscribeToStore(listener: () => void) {
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

function writeStoredState(next: AppState) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(storageKeyForToday(), JSON.stringify(next));
  }
  storeListeners.forEach((listener) => listener());
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function clampMinutes(value: number) {
  return Math.round(clamp(value, 5, 480));
}

function getTodaySnapshot(): TodaySnapshot {
  const date = new Date();
  return {
    dateKey: getLocalDateKey(date),
    label: formatLocalDate(date),
  };
}

function getDailyQuote(dateKey: string) {
  if (!dateKey) return dailyQuotes[0];
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
  return dailyQuotes[dayNumber % dailyQuotes.length];
}

function getCriticalTask(tasks: Task[]) {
  return (
    tasks.find((task) => task.isCritical) ??
    tasks.find((task) => task.priority === "high") ??
    tasks.find((task) => !task.done) ??
    tasks[0]
  );
}

function compareTasks(a: Task, b: Task) {
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

function formatTimeLabel(time: string) {
  if (!time) return "Unscheduled";
  const [hour, minute] = time.split(":").map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hour, minute));
}

function formatDuration(minutes: number) {
  const safeMinutes = clampMinutes(minutes);
  if (safeMinutes < 60) return `${safeMinutes} min`;

  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return `${hours} hr${hours > 1 ? "s" : ""}${remainder ? ` ${remainder} min` : ""}`;
}

function formatTaskMeta(task: Task) {
  return `${formatTimeLabel(task.scheduledTime)} · ${formatDuration(
    task.durationMinutes,
  )} · ${priorityLabels[task.priority]}`;
}

function formatCompletedAt() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function getEnergyRecommendation(energy: number, mood: Mood) {
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

function createTask(overrides: Partial<Task>): Task {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: "Untitled task",
    area: "Today",
    done: false,
    scheduledTime: "",
    durationMinutes: 30,
    priority: "medium",
    ...overrides,
  };
}

export default function Home() {
  const [today, setToday] = useState<TodaySnapshot>({
    dateKey: "",
    label: "Today",
  });
  const [planOpen, setPlanOpen] = useState(false);
  const [undo, setUndo] = useState<UndoState | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    title: "",
    scheduledTime: "",
    durationMinutes: 30,
    priority: "medium",
  });
  const [habitDraft, setHabitDraft] = useState<HabitDraft>({
    name: "",
    target: "",
  });
  const [goalDraft, setGoalDraft] = useState<GoalDraft>({
    title: "",
    horizon: "This month",
  });
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>({
    name: "",
    stage: "Planning",
    nextAction: "",
  });
  const [planDraft, setPlanDraft] = useState<PlanDraft>({
    criticalTitle: "",
    scheduledTime: "09:00",
    durationMinutes: 90,
    extraTask: "",
    intention: "",
  });

  useEffect(() => {
    let rolloverTimer: number | undefined;

    function refreshLocalDay() {
      setToday(getTodaySnapshot());
      storeListeners.forEach((listener) => listener());
      rolloverTimer = window.setTimeout(
        refreshLocalDay,
        getMillisecondsUntilNextLocalDay() + 1000,
      );
    }

    refreshLocalDay();

    return () => {
      if (rolloverTimer) window.clearTimeout(rolloverTimer);
    };
  }, []);

  const stateSnapshot = useSyncExternalStore(
    subscribeToStore,
    getStoredSnapshot,
    getServerSnapshot,
  );
  const state = useMemo(
    () => normalizeState(JSON.parse(stateSnapshot)),
    [stateSnapshot],
  );

  const stats = useMemo(() => {
    const completedTasks = state.tasks.filter((task) => task.done).length;
    const taskRate =
      state.tasks.length === 0 ? 0 : completedTasks / state.tasks.length;
    const completedHabits = state.habits.filter((habit) => habit.doneToday).length;
    const habitRate =
      state.habits.length === 0 ? 0 : completedHabits / state.habits.length;
    const goalAverage =
      state.goals.reduce((sum, goal) => sum + goal.progress, 0) /
      Math.max(state.goals.length, 1);
    const dailyCheckInComplete =
      Boolean(state.focus.trim()) && state.energy > 0 && Boolean(state.mood);
    const taskMomentum = Math.round(taskRate * 50);
    const habitMomentum = Math.round(habitRate * 30);
    const checkInMomentum = dailyCheckInComplete ? 20 : 0;

    return {
      completedTasks,
      totalTasks: state.tasks.length,
      completedHabits,
      totalHabits: state.habits.length,
      goalAverage,
      taskMomentum,
      habitMomentum,
      checkInMomentum,
      momentum: taskMomentum + habitMomentum + checkInMomentum,
    };
  }, [state.energy, state.focus, state.goals, state.habits, state.mood, state.tasks]);

  const dailyQuote = useMemo(() => getDailyQuote(today.dateKey), [today.dateKey]);
  const criticalTask = useMemo(() => getCriticalTask(state.tasks), [state.tasks]);
  const visibleTasks = useMemo(
    () =>
      [...state.tasks]
        .filter((task) => task.id !== criticalTask?.id)
        .sort(compareTasks),
    [criticalTask?.id, state.tasks],
  );
  const scheduledTasks = useMemo(
    () => [...state.tasks].filter((task) => task.scheduledTime).sort(compareTasks),
    [state.tasks],
  );
  const energyRecommendation = useMemo(
    () => getEnergyRecommendation(state.energy, state.mood),
    [state.energy, state.mood],
  );

  function updateState(
    updater: (current: AppState) => AppState,
    undoMessage?: string,
  ) {
    const previous = readStoredState();
    const next = updater(previous);
    writeStoredState(next);
    if (undoMessage) setUndo({ message: undoMessage, previous });
  }

  function openPlanPanel() {
    setPlanDraft({
      criticalTitle: criticalTask?.title ?? "",
      scheduledTime: criticalTask?.scheduledTime || "09:00",
      durationMinutes: criticalTask?.durationMinutes || 90,
      extraTask: "",
      intention: state.focus,
    });
    setPlanOpen(true);
  }

  function submitPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const criticalTitle = planDraft.criticalTitle.trim();
    const extraTask = planDraft.extraTask.trim();
    const intention = planDraft.intention.trim();

    if (!criticalTitle && !extraTask && !intention) return;

    updateState((current) => {
      const currentCritical = getCriticalTask(current.tasks);
      let tasks: Task[] = current.tasks.map((task) => ({
        ...task,
        isCritical: task.id === currentCritical?.id,
      }));

      if (criticalTitle) {
        if (currentCritical) {
          tasks = tasks.map((task) =>
            task.id === currentCritical.id
              ? {
                  ...task,
                  title: criticalTitle,
                  area: "Focus",
                  scheduledTime: planDraft.scheduledTime,
                  durationMinutes: clampMinutes(planDraft.durationMinutes),
                  priority: "high",
                  isCritical: true,
                }
              : { ...task, isCritical: false },
          );
        } else {
          tasks = [
            createTask({
              title: criticalTitle,
              area: "Focus",
              scheduledTime: planDraft.scheduledTime,
              durationMinutes: clampMinutes(planDraft.durationMinutes),
              priority: "high",
              isCritical: true,
            }),
            ...tasks.map((task) => ({ ...task, isCritical: false })),
          ];
        }
      }

      if (extraTask) {
        tasks = [
          ...tasks,
          createTask({
            title: extraTask,
            area: "Today",
            durationMinutes: 30,
            priority: "medium",
          }),
        ];
      }

      return {
        ...current,
        focus: intention || current.focus,
        tasks,
      };
    }, "Plan updated.");

    setPlanOpen(false);
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title) return;

    updateState(
      (current) => ({
        ...current,
        tasks: [
          createTask({
            title,
            area: taskDraft.priority === "high" ? "Focus" : "Today",
            scheduledTime: taskDraft.scheduledTime,
            durationMinutes: clampMinutes(taskDraft.durationMinutes),
            priority: taskDraft.priority,
          }),
          ...current.tasks,
        ],
      }),
      "Task added.",
    );
    setTaskDraft({
      title: "",
      scheduledTime: "",
      durationMinutes: 30,
      priority: "medium",
    });
  }

  function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = habitDraft.name.trim();
    const target = habitDraft.target.trim();
    if (!name) return;

    updateState(
      (current) => ({
        ...current,
        habits: [
          ...current.habits,
          {
            id: `habit-${Date.now()}`,
            name,
            target: target || "Today",
            streak: 0,
            doneToday: false,
          },
        ],
      }),
      "Habit added.",
    );
    setHabitDraft({ name: "", target: "" });
  }

  function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = goalDraft.title.trim();
    const horizon = goalDraft.horizon.trim();
    if (!title) return;

    updateState(
      (current) => ({
        ...current,
        goals: [
          ...current.goals,
          {
            id: `goal-${Date.now()}`,
            title,
            horizon: horizon || "This month",
            progress: 0,
          },
        ],
      }),
      "Goal added.",
    );
    setGoalDraft({ title: "", horizon: "This month" });
  }

  function addProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectDraft.name.trim();
    const stage = projectDraft.stage.trim();
    const nextAction = projectDraft.nextAction.trim();
    if (!name) return;

    updateState(
      (current) => ({
        ...current,
        projects: [
          ...current.projects,
          {
            id: `project-${Date.now()}`,
            name,
            stage: stage || "Planning",
            nextAction: nextAction || "Choose the next action",
            progress: 0,
          },
        ],
      }),
      "Project added.",
    );
    setProjectDraft({ name: "", stage: "Planning", nextAction: "" });
  }

  function toggleTask(id: string) {
    updateState(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id !== id) return task;
          const done = !task.done;
          return {
            ...task,
            done,
            completedAt: done ? formatCompletedAt() : undefined,
          };
        }),
      }),
      "Task status changed.",
    );
  }

  function deleteTask(id: string) {
    updateState(
      (current) => ({
        ...current,
        tasks: current.tasks.filter((task) => task.id !== id),
      }),
      "Task deleted.",
    );
  }

  function toggleHabit(id: string) {
    updateState(
      (current) => ({
        ...current,
        habits: current.habits.map((habit) => {
          if (habit.id !== id) return habit;
          const doneToday = !habit.doneToday;
          return {
            ...habit,
            doneToday,
            streak: doneToday ? habit.streak + 1 : Math.max(0, habit.streak - 1),
          };
        }),
      }),
      "Habit status changed.",
    );
  }

  function updateGoal(id: string, progress: number) {
    updateState((current) => ({
      ...current,
      goals: current.goals.map((goal) =>
        goal.id === id ? { ...goal, progress: clamp(progress) } : goal,
      ),
    }));
  }

  function updateProject(id: string, progress: number) {
    updateState((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.id === id ? { ...project, progress: clamp(progress) } : project,
      ),
    }));
  }

  function addProjectNextAction(project: Project) {
    updateState(
      (current) => ({
        ...current,
        tasks: [
          createTask({
            title: project.nextAction,
            area: "Project",
            durationMinutes: 45,
            priority: "medium",
            projectId: project.id,
          }),
          ...current.tasks,
        ],
      }),
      "Project next action added to today.",
    );
  }

  function updateJournalField(field: "journal" | "eveningJournal" | "note", value: string) {
    updateState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function restoreUndo() {
    if (!undo) return;
    writeStoredState(undo.previous);
    setUndo(null);
  }

  function getProjectName(projectId?: string) {
    return state.projects.find((project) => project.id === projectId)?.name;
  }

  return (
    <main className="app-shell">
      <aside className="side-rail" aria-label="Primary navigation">
        <div className="brand-mark" aria-hidden="true">
          <Sunrise size={22} strokeWidth={2.2} />
        </div>
        <nav className="rail-nav">
          <a href="#today" aria-label="Today">
            <CalendarDays size={19} />
          </a>
          <a href="#tasks" aria-label="Tasks">
            <ListChecks size={19} />
          </a>
          <a href="#goals" aria-label="Goals">
            <Target size={19} />
          </a>
          <a href="#journal" aria-label="Journal">
            <NotebookPen size={19} />
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar" id="today">
          <div>
            <p className="eyebrow">{today.label}</p>
            <h1>Dayframe</h1>
          </div>
          <div className="topbar-actions">
            <button className="primary-cta" onClick={openPlanPanel} type="button">
              <Plus size={18} />
              Plan today
            </button>
            <div className="sync-pill" role="status" aria-live="polite">
              <Check size={16} />
              Saved on this device
            </div>
          </div>
        </header>

        {undo ? (
          <div className="undo-toast" role="status" aria-live="polite">
            <span>{undo.message}</span>
            <button onClick={restoreUndo} type="button">
              <Undo2 size={16} />
              Undo
            </button>
            <button
              aria-label="Dismiss undo message"
              className="icon-button"
              onClick={() => setUndo(null)}
              type="button"
            >
              <X size={16} />
            </button>
          </div>
        ) : null}

        {planOpen ? (
          <section className="plan-panel" aria-labelledby="plan-heading">
            <div>
              <p className="eyebrow">Morning planning</p>
              <h2 id="plan-heading">Plan today</h2>
            </div>
            <form className="plan-form" onSubmit={submitPlan}>
              <label>
                <span>Today&apos;s most important task</span>
                <input
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      criticalTitle: event.target.value,
                    }))
                  }
                  value={planDraft.criticalTitle}
                />
              </label>
              <label>
                <span>Start time</span>
                <input
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      scheduledTime: event.target.value,
                    }))
                  }
                  type="time"
                  value={planDraft.scheduledTime}
                />
              </label>
              <label>
                <span>Focus duration</span>
                <input
                  min="5"
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      durationMinutes: Number(event.target.value),
                    }))
                  }
                  step="5"
                  type="number"
                  value={planDraft.durationMinutes}
                />
              </label>
              <label>
                <span>Additional task</span>
                <input
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      extraTask: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  value={planDraft.extraTask}
                />
              </label>
              <label className="wide-field">
                <span>Today&apos;s intention</span>
                <textarea
                  onChange={(event) =>
                    setPlanDraft((current) => ({
                      ...current,
                      intention: event.target.value,
                    }))
                  }
                  value={planDraft.intention}
                />
              </label>
              <div className="form-actions">
                <button className="secondary-button" onClick={() => setPlanOpen(false)} type="button">
                  Cancel
                </button>
                <button className="primary-cta" type="submit">
                  <Check size={17} />
                  Save plan
                </button>
              </div>
            </form>
          </section>
        ) : null}

        <section className="morning-board" aria-label="Morning dashboard summary">
          <div className="focus-editor">
            <div className="quote-label">
              <span>Daily quote</span>
              <em>Refreshes at local midnight</em>
            </div>
            <blockquote className="daily-quote">
              <p>{dailyQuote.text}</p>
              <cite>{dailyQuote.tag}</cite>
            </blockquote>
            <div className="intention-strip">
              <span>Today&apos;s intention</span>
              <strong>{state.focus || "Set an intention with Plan today."}</strong>
            </div>
          </div>

          <div className="momentum-card">
            <div
              className="momentum-meter"
              role="progressbar"
              aria-label="Today's momentum"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={stats.momentum}
            >
              <div
                className="meter-fill"
                style={{ width: `${stats.momentum}%` }}
              />
              <div className="meter-copy">
                <span>Today&apos;s momentum</span>
                <strong>{stats.momentum}%</strong>
              </div>
            </div>
            <details className="momentum-breakdown">
              <summary>How momentum is calculated</summary>
              <dl>
                <div>
                  <dt>Tasks</dt>
                  <dd>
                    {stats.completedTasks}/{stats.totalTasks} +{stats.taskMomentum}%
                  </dd>
                </div>
                <div>
                  <dt>Habits</dt>
                  <dd>
                    {stats.completedHabits}/{stats.totalHabits} +{stats.habitMomentum}%
                  </dd>
                </div>
                <div>
                  <dt>Daily check-in</dt>
                  <dd>+{stats.checkInMomentum}%</dd>
                </div>
              </dl>
              <p>Formula: 50% tasks, 30% habits, 20% daily check-in.</p>
            </details>
          </div>

          <div className="energy-control">
            <label htmlFor="energy">Energy</label>
            <input
              id="energy"
              type="range"
              min="1"
              max="5"
              value={state.energy}
              onChange={(event) =>
                updateState((current) => ({
                  ...current,
                  energy: Number(event.target.value),
                }))
              }
            />
            <span>{state.energy}/5</span>
          </div>

          <div className="mood-switcher" aria-label="Daily mindset">
            {(Object.keys(moodLabels) as Mood[]).map((mood) => (
              <button
                aria-pressed={state.mood === mood}
                className={state.mood === mood ? "active" : ""}
                key={mood}
                onClick={() =>
                  updateState((current) => ({
                    ...current,
                    mood,
                  }))
                }
                type="button"
              >
                {moodLabels[mood]}
              </button>
            ))}
          </div>

          <article className="recommendation-card">
            <BatteryCharging size={18} />
            <div>
              <span>Energy recommendation</span>
              <strong>{energyRecommendation.label}</strong>
              <p>{energyRecommendation.advice}</p>
              <p>{energyRecommendation.moodHint}</p>
            </div>
          </article>
        </section>

        <section className="stat-grid" aria-label="Daily status">
          <StatusTile
            icon={<ClipboardList size={20} />}
            label="Tasks"
            value={`${stats.completedTasks}/${stats.totalTasks}`}
          />
          <StatusTile
            icon={<Flame size={20} />}
            label="Habits"
            value={`${stats.completedHabits}/${stats.totalHabits}`}
          />
          <StatusTile
            icon={<TrendingUp size={20} />}
            label="Goal average"
            value={`${Math.round(stats.goalAverage)}%`}
          />
          <StatusTile
            icon={<Gauge size={20} />}
            label="Projects"
            value={`${state.projects.length}`}
          />
        </section>

        <div className="content-grid">
          <section className="panel task-panel" id="tasks" aria-labelledby="tasks-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Daily command</p>
                <h2 id="tasks-heading">Today&apos;s tasks</h2>
              </div>
              <Sparkles size={20} />
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input
                aria-label="New task title"
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Add a task that just came to mind"
                value={taskDraft.title}
              />
              <input
                aria-label="New task scheduled time"
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    scheduledTime: event.target.value,
                  }))
                }
                type="time"
                value={taskDraft.scheduledTime}
              />
              <input
                aria-label="New task estimated minutes"
                min="5"
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    durationMinutes: Number(event.target.value),
                  }))
                }
                step="5"
                type="number"
                value={taskDraft.durationMinutes}
              />
              <select
                aria-label="New task priority"
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    priority: event.target.value as Priority,
                  }))
                }
                value={taskDraft.priority}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <button aria-label="Add task" type="submit">
                <Plus size={18} />
              </button>
            </form>

            {criticalTask ? (
              <article className={`priority-card ${criticalTask.done ? "done" : ""}`}>
                <div>
                  <p className="eyebrow">Today&apos;s priority</p>
                  <h3>{criticalTask.title}</h3>
                  <span>{formatTaskMeta(criticalTask)}</span>
                </div>
                <label>
                  <input
                    checked={criticalTask.done}
                    onChange={() => toggleTask(criticalTask.id)}
                    type="checkbox"
                  />
                  <span>Done</span>
                </label>
              </article>
            ) : (
              <article className="priority-card empty-card">
                <div>
                  <p className="eyebrow">Today&apos;s priority</p>
                  <h3>No priority selected yet</h3>
                  <span>Use Plan today to choose the one task that matters most.</span>
                </div>
                <button className="secondary-button" onClick={openPlanPanel} type="button">
                  Plan today
                </button>
              </article>
            )}

            <section className="schedule-block" aria-labelledby="schedule-heading">
              <div className="compact-heading">
                <Clock3 size={17} />
                <h3 id="schedule-heading">Today&apos;s schedule</h3>
              </div>
              {scheduledTasks.length ? (
                <ol className="schedule-list">
                  {scheduledTasks.map((task) => (
                    <li className={task.done ? "done" : ""} key={`schedule-${task.id}`}>
                      <time>{formatTimeLabel(task.scheduledTime)}</time>
                      <span>{task.title}</span>
                      <em>{formatDuration(task.durationMinutes)}</em>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="empty-state">Add a time to a task to build your day.</p>
              )}
            </section>

            {visibleTasks.length ? (
              <ul className="task-list" aria-label="Task list">
                {visibleTasks.map((task) => {
                  const projectName = getProjectName(task.projectId);
                  return (
                    <li className={`task-row ${task.done ? "done" : ""}`} key={task.id}>
                      <input
                        aria-label={`Mark ${task.title} complete`}
                        checked={task.done}
                        onChange={() => toggleTask(task.id)}
                        type="checkbox"
                      />
                      <div className="task-copy">
                        <strong>{task.title}</strong>
                        <span>{formatTaskMeta(task)}</span>
                        {projectName ? <small>{projectName}</small> : null}
                        {task.completedAt ? <small>Completed at {task.completedAt}</small> : null}
                      </div>
                      <div className="task-row-actions">
                        <em>{task.area}</em>
                        <button
                          aria-label={`Delete ${task.title}`}
                          className="icon-button danger-button"
                          onClick={() => deleteTask(task.id)}
                          type="button"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty-state">No additional tasks yet.</p>
            )}
          </section>

          <section className="panel habit-panel" aria-labelledby="habits-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Streak builder</p>
                <h2 id="habits-heading">Habit tracker</h2>
              </div>
              <TimerReset size={20} />
            </div>

            <form className="simple-form" onSubmit={addHabit}>
              <input
                aria-label="New habit name"
                onChange={(event) =>
                  setHabitDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Habit name"
                value={habitDraft.name}
              />
              <input
                aria-label="New habit timing"
                onChange={(event) =>
                  setHabitDraft((current) => ({
                    ...current,
                    target: event.target.value,
                  }))
                }
                placeholder="When"
                value={habitDraft.target}
              />
              <button aria-label="Add habit" type="submit">
                <Plus size={17} />
              </button>
            </form>

            {state.habits.length ? (
              <ul className="habit-grid">
                {state.habits.map((habit) => (
                  <li key={habit.id}>
                    <button
                      aria-label={`${habit.doneToday ? "Undo" : "Complete"} ${habit.name}`}
                      className={`habit-card ${habit.doneToday ? "done" : ""}`}
                      onClick={() => toggleHabit(habit.id)}
                      type="button"
                    >
                      <span className="habit-status">
                        {habit.doneToday ? <Check size={16} /> : <Circle size={16} />}
                      </span>
                      <strong>{habit.name}</strong>
                      <span>{habit.target}</span>
                      <em>{habit.streak}-day streak</em>
                      <small>{habit.doneToday ? "Done today" : "Not done yet"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-state">No habits yet. Add one routine to track today.</p>
            )}
          </section>

          <section className="panel" id="goals" aria-labelledby="goals-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">North stars</p>
                <h2 id="goals-heading">Goals</h2>
              </div>
              <Target size={20} />
            </div>

            <form className="simple-form" onSubmit={addGoal}>
              <input
                aria-label="New goal title"
                onChange={(event) =>
                  setGoalDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Goal title"
                value={goalDraft.title}
              />
              <input
                aria-label="New goal horizon"
                onChange={(event) =>
                  setGoalDraft((current) => ({
                    ...current,
                    horizon: event.target.value,
                  }))
                }
                value={goalDraft.horizon}
              />
              <button aria-label="Add goal" type="submit">
                <Plus size={17} />
              </button>
            </form>

            {state.goals.length ? (
              <div className="progress-list">
                {state.goals.map((goal) => (
                  <article className="progress-item" key={goal.id}>
                    <div>
                      <span>{goal.horizon}</span>
                      <strong>{goal.title}</strong>
                      <small>{goal.progress}% · Manually updated</small>
                    </div>
                    <label>
                      <span>{goal.progress}%</span>
                      <input
                        aria-label={`${goal.title} progress`}
                        max="100"
                        min="0"
                        onChange={(event) =>
                          updateGoal(goal.id, Number(event.target.value))
                        }
                        type="range"
                        value={goal.progress}
                      />
                    </label>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No goals yet. Add a goal when you are ready.</p>
            )}
          </section>

          <section className="panel" aria-labelledby="projects-heading">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Project flow</p>
                <h2 id="projects-heading">Projects</h2>
              </div>
              <FolderKanban size={20} />
            </div>

            <form className="simple-form project-form" onSubmit={addProject}>
              <input
                aria-label="New project name"
                onChange={(event) =>
                  setProjectDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Project name"
                value={projectDraft.name}
              />
              <input
                aria-label="New project stage"
                onChange={(event) =>
                  setProjectDraft((current) => ({
                    ...current,
                    stage: event.target.value,
                  }))
                }
                value={projectDraft.stage}
              />
              <input
                aria-label="New project next action"
                onChange={(event) =>
                  setProjectDraft((current) => ({
                    ...current,
                    nextAction: event.target.value,
                  }))
                }
                placeholder="Next action"
                value={projectDraft.nextAction}
              />
              <button aria-label="Add project" type="submit">
                <Plus size={17} />
              </button>
            </form>

            {state.projects.length ? (
              <div className="project-list">
                {state.projects.map((project) => (
                  <article className="project-row" key={project.id}>
                    <div>
                      <span>{project.stage}</span>
                      <strong>{project.name}</strong>
                      <p>Next: {project.nextAction}</p>
                    </div>
                    <div className="project-actions">
                      <button
                        aria-label={`Decrease ${project.name} progress`}
                        onClick={() => updateProject(project.id, project.progress - 5)}
                        type="button"
                      >
                        <ChevronRight className="reverse-icon" size={17} />
                      </button>
                      <span>{project.progress}%</span>
                      <button
                        aria-label={`Increase ${project.name} progress`}
                        onClick={() => updateProject(project.id, project.progress + 5)}
                        type="button"
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                    <div
                      className="track"
                      role="progressbar"
                      aria-label={`${project.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={project.progress}
                    >
                      <span style={{ width: `${project.progress}%` }} />
                    </div>
                    <button
                      className="project-add-button"
                      onClick={() => addProjectNextAction(project)}
                      type="button"
                    >
                      <Plus size={16} />
                      Add next action to today
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No projects yet. Add a project to connect future tasks.</p>
            )}
          </section>

          <section
            className="panel journal-panel"
            id="journal"
            aria-labelledby="journal-heading"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Notes and journal</p>
                <h2 id="journal-heading">Notes &amp; journal</h2>
              </div>
              <NotebookPen size={20} />
            </div>

            <article className="journal-block">
              <label className="text-field">
                <span>Morning reflection</span>
                <textarea
                  onChange={(event) => updateJournalField("journal", event.target.value)}
                  value={state.journal}
                />
              </label>
            </article>

            <article className="journal-block">
              <label className="text-field">
                <span>Evening reflection</span>
                <textarea
                  onChange={(event) =>
                    updateJournalField("eveningJournal", event.target.value)
                  }
                  value={state.eveningJournal}
                />
              </label>
            </article>

            <article className="journal-block">
              <label className="text-field">
                <span>Quick notes</span>
                <textarea
                  onChange={(event) => updateJournalField("note", event.target.value)}
                  value={state.note}
                />
              </label>
            </article>
          </section>
        </div>
      </section>
    </main>
  );
}

function StatusTile({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="status-tile">
      <span aria-hidden="true">{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
