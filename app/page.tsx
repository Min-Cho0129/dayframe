"use client";

import {
  BatteryCharging,
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
  Cloud,
  CloudOff,
  Clock3,
  Eraser,
  Flame,
  FolderKanban,
  Gauge,
  ListChecks,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  formatLocalDate,
  getLocalDateKey,
  getMillisecondsUntilNextLocalDay,
} from "./date-utils.js";
import type {
  AppState,
  DailyQuote,
  GeneratedPlan,
  GeneratedPlanTask,
  GoalDraft,
  HabitDraft,
  Mood,
  PlanGuideDraft,
  Priority,
  Project,
  ProjectDraft,
  Task,
  TaskDraft,
  TaskEditDraft,
  TodaySnapshot,
  SyncStatus,
  UndoState,
} from "../types/dayframe";
import {
  buildPlanningPrompt,
  buildTodayMemoryEntry,
  defaultState,
  getServerMemorySnapshot,
  getServerSnapshot,
  getStoredMemorySnapshot,
  getStoredSnapshot,
  getSyncDeviceId,
  notifyStoreListeners,
  normalizePlannerMemory,
  normalizeState,
  readPlannerMemory,
  readStoredState,
  subscribeToMemoryStore,
  subscribeToStore,
  summarizePlannerMemory,
  updatePlannerMemory,
  writePlannerMemory,
  writeStoredState,
} from "../lib/storage/dayframe-storage";
import {
  DEFAULT_DAY_END_MINUTES,
  clamp,
  clampMinutes,
  compareScheduledTasks,
  compareTasks,
  findAvailableScheduleStart,
  formatDuration,
  formatMinutesAsTimeLabel,
  formatMinutesAsInputTime,
  formatTaskMeta,
  formatTimeLabel,
  getDailyTimeline,
  getDefaultScheduleStart,
  getEnergyRecommendation,
  getRoundedCurrentScheduleStart,
  getScheduleInsights,
  getTimelineSegmentHeight,
  parseScheduleMinutes,
} from "../lib/planner/schedule";

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

const emptyPlanGuide: PlanGuideDraft = {
  fixedEvents: "",
  mustDo: "",
  wantToDo: "",
  constraints: "",
};

const defaultSyncStatus: SyncStatus = {
  phase: "idle",
  label: "Saved locally",
  detail: "Local save active. Backup validation has not run yet.",
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  clear: "Clear",
  bold: "Bold",
  tired: "Tired",
};

const planEnergyOptions = [
  { value: 1, label: "Low", detail: "Light tasks" },
  { value: 2, label: "Easy", detail: "Short blocks" },
  { value: 3, label: "Steady", detail: "Normal pace" },
  { value: 4, label: "Strong", detail: "Deep work" },
  { value: 5, label: "Peak", detail: "Hard tasks" },
];

const planAreaOptions = [
  "Focus",
  "Project",
  "Study",
  "Health",
  "Admin",
  "Review",
  "Today",
];

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

function formatCompletedAt() {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date());
}

function formatSyncTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
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
  const [planEnergy, setPlanEnergy] = useState(defaultState.energy);
  const [planGuide, setPlanGuide] = useState<PlanGuideDraft>(emptyPlanGuide);
  const [planInput, setPlanInput] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditDraft, setTaskEditDraft] = useState<TaskEditDraft | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [planStatus, setPlanStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [planError, setPlanError] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const [memoryStatus, setMemoryStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(defaultSyncStatus);

  useEffect(() => {
    let rolloverTimer: number | undefined;

    function refreshLocalDay() {
      setToday(getTodaySnapshot());
      notifyStoreListeners();
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
  const memorySnapshot = useSyncExternalStore(
    subscribeToMemoryStore,
    getStoredMemorySnapshot,
    getServerMemorySnapshot,
  );
  const plannerMemory = useMemo(
    () => normalizePlannerMemory(JSON.parse(memorySnapshot)),
    [memorySnapshot],
  );

  const syncCurrentSnapshot = useCallback(
    async (
      trigger: "auto" | "manual" = "manual",
      signal?: AbortSignal,
    ) => {
      setSyncStatus({
        phase: "syncing",
        label: "Checking backup",
        detail: "Validating local day state and planning memory for backup.",
      });

      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal,
          body: JSON.stringify({
            dateKey: today.dateKey || getLocalDateKey(),
            deviceId: getSyncDeviceId(),
            savedAt: new Date().toISOString(),
            state: readStoredState(),
            memory: readPlannerMemory(),
          }),
        });
        const result = (await response.json().catch(() => null)) as {
          error?: string;
          sync?: {
            accepted?: boolean;
            persisted?: boolean;
            sizeBytes?: number;
          };
        } | null;

        if (!response.ok || !result?.sync?.accepted) {
          throw new Error(result?.error || "Sync validation failed.");
        }

        const backupState = result.sync.persisted
          ? "Server backup stored."
          : "Server backup not enabled.";

        setSyncStatus({
          phase: "validated",
          label: result.sync.persisted
            ? "Backup stored"
            : trigger === "manual"
              ? "Backup check passed"
              : "Saved locally",
          detail: `Checked ${formatSyncTime(new Date())}. ${backupState}`,
          sizeBytes:
            typeof result.sync.sizeBytes === "number"
              ? result.sync.sizeBytes
              : undefined,
        });
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setSyncStatus({
          phase: "error",
          label: "Backup unavailable",
          detail:
            error instanceof Error
              ? error.message
              : "Local save is still available.",
        });
      }
    },
    [today.dateKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const controller = new AbortController();
    const syncTimer = window.setTimeout(() => {
      void syncCurrentSnapshot("auto", controller.signal);
    }, 900);

    return () => {
      window.clearTimeout(syncTimer);
      controller.abort();
    };
  }, [memorySnapshot, stateSnapshot, syncCurrentSnapshot]);

  const stats = useMemo(() => {
    const completedTasks = state.tasks.filter((task) => task.done).length;
    const openTasks = state.tasks.length - completedTasks;
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
      openTasks,
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
    () =>
      [...state.tasks]
        .filter((task) => task.scheduledTime)
        .sort(compareScheduledTasks),
    [state.tasks],
  );
  const timelineSegments = useMemo(
    () => getDailyTimeline(state.tasks),
    [state.tasks],
  );
  const autoSpaceableTasks = useMemo(
    () =>
      state.tasks.filter(
        (task) => !task.done && parseScheduleMinutes(task.scheduledTime) !== null,
      ),
    [state.tasks],
  );
  const unscheduledOpenTasks = useMemo(
    () => state.tasks.filter((task) => !task.done && !task.scheduledTime),
    [state.tasks],
  );
  const scheduleInsights = useMemo(
    () => getScheduleInsights(state.tasks, state.energy),
    [state.energy, state.tasks],
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
    const latestState = readStoredState();

    setPlanEnergy(Math.round(clamp(latestState.energy, 1, 5)));
    setGeneratedPlan(null);
    setPlanStatus("idle");
    setPlanError("");
    setPlanOpen(true);
  }

  async function generatePlan(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const latestMemory = readPlannerMemory();
    const typedPrompt = buildPlanningPrompt(planInput, planGuide).trim();
    const prompt =
      typedPrompt ||
      (latestMemory.carryOverTasks.length
        ? "Plan today from my saved carry-over tasks and recent daily reviews."
        : "");

    if (!prompt) {
      setPlanStatus("error");
      setPlanError("Tell Dayframe what your day looks like first.");
      return;
    }

    setPlanStatus("loading");
    setPlanError("");

    try {
      const response = await fetch("/api/ai-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          dateKey: today.dateKey,
          energy: planEnergy,
          mood: state.mood,
          existingTasks: state.tasks
            .filter((task) => !task.done)
            .map((task) => ({
              title: task.title,
              scheduledTime: task.scheduledTime,
              durationMinutes: task.durationMinutes,
              priority: task.priority,
            })),
          memory: summarizePlannerMemory(latestMemory),
          projects: state.projects.map((project) => ({
            name: project.name,
            nextAction: project.nextAction,
            progress: project.progress,
          })),
          goals: state.goals.map((goal) => ({
            title: goal.title,
            progress: goal.progress,
          })),
        }),
      });
      const result = await response.json();

      if (!response.ok || !result.plan) {
        throw new Error(result.error || "Dayframe could not generate a plan.");
      }

      setGeneratedPlan(result.plan as GeneratedPlan);
      setPlanStatus("ready");
    } catch (error) {
      setPlanStatus("error");
      setPlanError(
        error instanceof Error
          ? error.message
          : "Dayframe could not generate a plan.",
      );
    }
  }

  function acceptGeneratedPlan() {
    if (!generatedPlan) return;
    const acceptedTasks = generatedPlan.tasks.filter((task) => task.title.trim());

    if (!acceptedTasks.length) {
      setPlanStatus("error");
      setPlanError("Keep at least one task before accepting the plan.");
      return;
    }

    updateState(
      (current) => {
        const acceptedTitleKeys = new Set(
          acceptedTasks.map((task) => task.title.trim().toLowerCase()),
        );
        const plannedTasks = acceptedTasks.map((task, index) =>
          createTask({
            title: task.title.trim(),
            area: task.area || "Today",
            scheduledTime: task.scheduledTime,
            durationMinutes: clampMinutes(task.durationMinutes),
            priority: task.priority,
            isCritical: task.isCritical || index === 0,
          }),
        );
        const preservedOpenTasks = current.tasks.filter(
          (task) => !task.done && !acceptedTitleKeys.has(task.title.trim().toLowerCase()),
        );
        const completedTasks = current.tasks.filter((task) => task.done);

        return {
          ...current,
          energy: planEnergy,
          focus: generatedPlan.intention,
          tasks: [...plannedTasks, ...preservedOpenTasks, ...completedTasks],
        };
      },
      "AI plan merged.",
    );

    setPlanOpen(false);
  }

  function updateGeneratedPlanTask(
    index: number,
    changes: Partial<GeneratedPlanTask>,
  ) {
    setGeneratedPlan((current) => {
      if (!current) return current;

      return {
        ...current,
        tasks: current.tasks.map((task, taskIndex) =>
          taskIndex === index ? { ...task, ...changes } : task,
        ),
      };
    });
  }

  function removeGeneratedPlanTask(index: number) {
    setGeneratedPlan((current) => {
      if (!current) return current;

      return {
        ...current,
        tasks: current.tasks.filter((_, taskIndex) => taskIndex !== index),
      };
    });
  }

  function updatePlanGuideField(field: keyof PlanGuideDraft, value: string) {
    setPlanGuide((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function clearPlanDraft() {
    setPlanGuide(emptyPlanGuide);
    setPlanInput("");
    setPlanEnergy(Math.round(clamp(readStoredState().energy, 1, 5)));
    setGeneratedPlan(null);
    setPlanStatus("idle");
    setPlanError("");
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

  function startEditingTask(task: Task) {
    setEditingTaskId(task.id);
    setTaskEditDraft({
      title: task.title,
      scheduledTime: task.scheduledTime,
      durationMinutes: task.durationMinutes,
      priority: task.priority,
      area: task.area,
      isCritical: Boolean(task.isCritical),
    });
  }

  function updateTaskEditDraft(changes: Partial<TaskEditDraft>) {
    setTaskEditDraft((current) => (current ? { ...current, ...changes } : current));
  }

  function cancelTaskEdit() {
    setEditingTaskId(null);
    setTaskEditDraft(null);
  }

  function saveTaskEdit(id: string) {
    if (!taskEditDraft) return;

    const title = taskEditDraft.title.trim();
    if (!title) return;

    updateState(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                title,
                area: taskEditDraft.area.trim() || "Today",
                scheduledTime: taskEditDraft.scheduledTime,
                durationMinutes: clampMinutes(taskEditDraft.durationMinutes),
                priority: taskEditDraft.priority,
                isCritical: taskEditDraft.isCritical,
              }
            : task,
        ),
      }),
      "Task updated.",
    );
    cancelTaskEdit();
  }

  function autoSpaceSchedule() {
    const scheduledBlocks = readStoredState()
      .tasks.filter(
        (task) => !task.done && parseScheduleMinutes(task.scheduledTime) !== null,
      )
      .map((task) => ({
        task,
        start: parseScheduleMinutes(task.scheduledTime) ?? 0,
      }))
      .sort((a, b) => a.start - b.start);

    if (scheduledBlocks.length < 2) return;

    const nextTimes = new Map<string, string>();
    let cursor = scheduledBlocks[0].start;

    for (const block of scheduledBlocks) {
      nextTimes.set(block.task.id, formatMinutesAsInputTime(cursor));
      cursor += clampMinutes(block.task.durationMinutes) + 10;
    }

    updateState(
      (current) => ({
        ...current,
        tasks: current.tasks.map((task) =>
          nextTimes.has(task.id)
            ? { ...task, scheduledTime: nextTimes.get(task.id) ?? task.scheduledTime }
            : task,
        ),
      }),
      "Schedule auto-spaced.",
    );
    cancelTaskEdit();
  }

  function scheduleOpenTasks() {
    updateState(
      (current) => {
        const openTasks = [...current.tasks]
          .filter((task) => !task.done && !task.scheduledTime)
          .sort(compareTasks);
        if (!openTasks.length) return current;

        const occupiedBlocks = current.tasks
          .map((task) => {
            const start = parseScheduleMinutes(task.scheduledTime);
            return start === null
              ? null
              : { start, end: start + clampMinutes(task.durationMinutes) };
          })
          .filter(
            (block): block is { start: number; end: number } => Boolean(block),
          )
          .sort((a, b) => a.start - b.start);
        const nextTimes = new Map<string, string>();
        let cursor = Math.max(
          getDefaultScheduleStart(current.energy),
          getRoundedCurrentScheduleStart(),
        );

        for (const task of openTasks) {
          const duration = clampMinutes(task.durationMinutes);
          const start = findAvailableScheduleStart(occupiedBlocks, cursor, duration);
          const end = start + duration;
          if (end > DEFAULT_DAY_END_MINUTES) continue;

          nextTimes.set(task.id, formatMinutesAsInputTime(start));
          occupiedBlocks.push({ start, end });
          occupiedBlocks.sort((a, b) => a.start - b.start);
          cursor = end + 10;
        }

        return {
          ...current,
          tasks: current.tasks.map((task) =>
            nextTimes.has(task.id)
              ? { ...task, scheduledTime: nextTimes.get(task.id) ?? task.scheduledTime }
              : task,
          ),
        };
      },
      "Open tasks scheduled after the current time.",
    );
    cancelTaskEdit();
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

  function updateJournalField(
    field: "journal" | "eveningJournal" | "note",
    value: string,
  ) {
    updateState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function saveDailyReview() {
    const review =
      reviewDraft.trim() || state.eveningJournal.trim() || state.note.trim();
    const entry = buildTodayMemoryEntry(
      state,
      today.dateKey || getLocalDateKey(),
      review,
    );
    const nextMemory = updatePlannerMemory(readPlannerMemory(), entry);
    writePlannerMemory(nextMemory);

    setReviewDraft(entry.review);
    setMemoryStatus("Planning memory saved.");
  }

  function restoreUndo() {
    if (!undo) return;
    writeStoredState(undo.previous);
    setUndo(null);
  }

  function getProjectName(projectId?: string) {
    return state.projects.find((project) => project.id === projectId)?.name;
  }

  function renderTaskEditForm(task: Task) {
    if (editingTaskId !== task.id || !taskEditDraft) return null;

    return (
      <form
        className="task-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          saveTaskEdit(task.id);
        }}
      >
        <label className="task-edit-title">
          <span>Task</span>
          <input
            aria-label={`Edit ${task.title} title`}
            onChange={(event) => updateTaskEditDraft({ title: event.target.value })}
            value={taskEditDraft.title}
          />
        </label>
        <label>
          <span>Time</span>
          <input
            aria-label={`Edit ${task.title} time`}
            onChange={(event) =>
              updateTaskEditDraft({ scheduledTime: event.target.value })
            }
            type="time"
            value={taskEditDraft.scheduledTime}
          />
        </label>
        <label>
          <span>Minutes</span>
          <input
            aria-label={`Edit ${task.title} minutes`}
            min="5"
            onChange={(event) =>
              updateTaskEditDraft({ durationMinutes: Number(event.target.value) })
            }
            step="5"
            type="number"
            value={taskEditDraft.durationMinutes}
          />
        </label>
        <label>
          <span>Priority</span>
          <select
            aria-label={`Edit ${task.title} priority`}
            onChange={(event) =>
              updateTaskEditDraft({ priority: event.target.value as Priority })
            }
            value={taskEditDraft.priority}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <label>
          <span>Area</span>
          <select
            aria-label={`Edit ${task.title} area`}
            onChange={(event) => updateTaskEditDraft({ area: event.target.value })}
            value={taskEditDraft.area}
          >
            {planAreaOptions.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
        </label>
        <div className="task-edit-actions">
          <label className="critical-toggle">
            <input
              checked={taskEditDraft.isCritical}
              onChange={(event) =>
                updateTaskEditDraft({ isCritical: event.target.checked })
              }
              type="checkbox"
            />
            <span>Critical task</span>
          </label>
          <div>
            <button className="secondary-button" onClick={cancelTaskEdit} type="button">
              <X size={16} />
              Cancel
            </button>
            <button className="primary-cta" type="submit">
              <Check size={16} />
              Save
            </button>
          </div>
        </div>
      </form>
    );
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
              Plan with AI
            </button>
            <button
              className={`sync-pill ${syncStatus.phase}`}
              disabled={syncStatus.phase === "syncing"}
              onClick={() => void syncCurrentSnapshot("manual")}
              title={syncStatus.detail}
              type="button"
            >
              {syncStatus.phase === "error" ? (
                <CloudOff size={16} />
              ) : syncStatus.phase === "syncing" ? (
                <RefreshCw size={16} />
              ) : (
                <Cloud size={16} />
              )}
              <span>{syncStatus.label}</span>
            </button>
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
              <p className="eyebrow">AI planning</p>
              <h2 id="plan-heading">Plan with AI</h2>
            </div>
            <form className="ai-plan-form" onSubmit={generatePlan}>
              <div className="guide-grid" aria-label="Guided planning inputs">
                <label>
                  <span>Fixed events</span>
                  <textarea
                    className="compact-textarea"
                    onChange={(event) =>
                      updatePlanGuideField("fixedEvents", event.target.value)
                    }
                    placeholder="Class at 2 PM, shift 5-9 PM"
                    value={planGuide.fixedEvents}
                  />
                </label>
                <label>
                  <span>Must do</span>
                  <textarea
                    className="compact-textarea"
                    onChange={(event) =>
                      updatePlanGuideField("mustDo", event.target.value)
                    }
                    placeholder="Submit assignment, call advisor"
                    value={planGuide.mustDo}
                  />
                </label>
                <label>
                  <span>Would like</span>
                  <textarea
                    className="compact-textarea"
                    onChange={(event) =>
                      updatePlanGuideField("wantToDo", event.target.value)
                    }
                    placeholder="Workout, portfolio polish"
                    value={planGuide.wantToDo}
                  />
                </label>
                <label>
                  <span>Constraints</span>
                  <textarea
                    className="compact-textarea"
                    onChange={(event) =>
                      updatePlanGuideField("constraints", event.target.value)
                    }
                    placeholder="Low energy, travel time, hard deadline"
                    value={planGuide.constraints}
                  />
                </label>
              </div>
              <label className="wide-field">
                <span>Extra notes</span>
                <textarea
                  onChange={(event) => setPlanInput(event.target.value)}
                  placeholder="Anything else Dayframe should consider"
                  value={planInput}
                />
              </label>
              <section
                className="plan-energy-card"
                aria-labelledby="plan-energy-heading"
              >
                <div>
                  <span id="plan-energy-heading">Energy for this plan</span>
                  <strong>{planEnergy}/5</strong>
                </div>
                <div className="energy-segments" role="group">
                  {planEnergyOptions.map((option) => (
                    <button
                      aria-label={`Set AI plan energy to ${option.label}`}
                      aria-pressed={planEnergy === option.value}
                      className={planEnergy === option.value ? "active" : ""}
                      key={option.value}
                      onClick={() => setPlanEnergy(option.value)}
                      type="button"
                    >
                      <strong>{option.label}</strong>
                      <span>{option.detail}</span>
                    </button>
                  ))}
                </div>
              </section>
              <div className="ai-context-grid">
                <span>Plan energy {planEnergy}/5</span>
                <span>Mood {moodLabels[state.mood]}</span>
                <span>{stats.openTasks} open tasks</span>
                <span>{state.projects.length} projects</span>
                <span>{plannerMemory.entries.length} saved days</span>
              </div>
              {plannerMemory.carryOverTasks.length ? (
                <div className="memory-context-note">
                  <strong>Carry-over</strong>
                  <span>{plannerMemory.carryOverTasks.slice(0, 3).join(", ")}</span>
                </div>
              ) : null}
              {planStatus === "error" ? (
                <p className="form-error" role="alert">
                  {planError}
                </p>
              ) : null}
              <div className="form-actions">
                <button className="secondary-button" onClick={clearPlanDraft} type="button">
                  <Eraser size={17} />
                  Clear fields
                </button>
                <button className="secondary-button" onClick={() => setPlanOpen(false)} type="button">
                  Cancel
                </button>
                <button
                  className="primary-cta"
                  disabled={planStatus === "loading"}
                  type="submit"
                >
                  <Sparkles size={17} />
                  {planStatus === "loading" ? "Generating..." : "Generate plan"}
                </button>
              </div>
            </form>
            {generatedPlan ? (
              <article className="ai-plan-preview">
                <div className="preview-heading">
                  <div>
                    <p className="eyebrow">Suggested plan</p>
                    <h3>{generatedPlan.summary}</h3>
                  </div>
                  <span>{generatedPlan.source === "openai" ? "AI draft" : "Local draft"}</span>
                </div>
                <p>{generatedPlan.intention}</p>
                <ol className="ai-plan-list">
                  {generatedPlan.tasks.map((task, index) => (
                    <li key={`generated-task-${index}`}>
                      <div className="plan-task-time">
                        <label>
                          <span>Time</span>
                          <input
                            aria-label={`Suggested task ${index + 1} time`}
                            onChange={(event) =>
                              updateGeneratedPlanTask(index, {
                                scheduledTime: event.target.value,
                              })
                            }
                            type="time"
                            value={task.scheduledTime}
                          />
                        </label>
                      </div>
                      <div className="plan-task-editor">
                        <label className="plan-task-title">
                          <span>Task</span>
                          <input
                            aria-label={`Suggested task ${index + 1} title`}
                            onChange={(event) =>
                              updateGeneratedPlanTask(index, {
                                title: event.target.value,
                              })
                            }
                            value={task.title}
                          />
                        </label>
                        <div className="plan-task-controls">
                          <label>
                            <span>Minutes</span>
                            <input
                              aria-label={`Suggested task ${index + 1} minutes`}
                              max="180"
                              min="10"
                              onChange={(event) =>
                                updateGeneratedPlanTask(index, {
                                  durationMinutes: Number(event.target.value),
                                })
                              }
                              step="5"
                              type="number"
                              value={task.durationMinutes}
                            />
                          </label>
                          <label>
                            <span>Priority</span>
                            <select
                              aria-label={`Suggested task ${index + 1} priority`}
                              onChange={(event) =>
                                updateGeneratedPlanTask(index, {
                                  priority: event.target.value as Priority,
                                })
                              }
                              value={task.priority}
                            >
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                            </select>
                          </label>
                          <label>
                            <span>Area</span>
                            <select
                              aria-label={`Suggested task ${index + 1} area`}
                              onChange={(event) =>
                                updateGeneratedPlanTask(index, {
                                  area: event.target.value,
                                })
                              }
                              value={task.area}
                            >
                              {planAreaOptions.map((area) => (
                                <option key={area} value={area}>
                                  {area}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="plan-task-footer">
                          <label className="critical-toggle">
                            <input
                              checked={task.isCritical}
                              onChange={(event) =>
                                updateGeneratedPlanTask(index, {
                                  isCritical: event.target.checked,
                                })
                              }
                              type="checkbox"
                            />
                            <span>Critical task</span>
                          </label>
                          <button
                            aria-label={`Remove suggested task ${index + 1}`}
                            className="icon-button danger-button"
                            onClick={() => removeGeneratedPlanTask(index)}
                            type="button"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <small>{task.rationale}</small>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="form-actions">
                  <button
                    className="secondary-button"
                    disabled={planStatus === "loading"}
                    onClick={() => void generatePlan()}
                    type="button"
                  >
                    Regenerate
                  </button>
                  <button className="primary-cta" onClick={acceptGeneratedPlan} type="button">
                    <Check size={17} />
                    Accept plan
                  </button>
                </div>
              </article>
            ) : null}
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
              <strong>{state.focus || "Use Plan with AI to shape your day."}</strong>
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
                {editingTaskId === criticalTask.id ? (
                  renderTaskEditForm(criticalTask)
                ) : (
                  <>
                    <div>
                      <p className="eyebrow">Today&apos;s priority</p>
                      <h3>{criticalTask.title}</h3>
                      <span>{formatTaskMeta(criticalTask)}</span>
                    </div>
                    <div className="priority-actions">
                      <button
                        className="secondary-button"
                        onClick={() => startEditingTask(criticalTask)}
                        type="button"
                      >
                        <Pencil size={16} />
                        Edit
                      </button>
                      <button
                        aria-label={`Delete ${criticalTask.title}`}
                        className="secondary-button danger-button"
                        onClick={() => deleteTask(criticalTask.id)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                      <label>
                        <input
                          checked={criticalTask.done}
                          onChange={() => toggleTask(criticalTask.id)}
                          type="checkbox"
                        />
                        <span>Done</span>
                      </label>
                    </div>
                  </>
                )}
              </article>
            ) : (
              <article className="priority-card empty-card">
                <div>
                  <p className="eyebrow">Today&apos;s priority</p>
                  <h3>No priority selected yet</h3>
                  <span>Use Plan with AI to choose the one task that matters most.</span>
                </div>
                <button className="secondary-button" onClick={openPlanPanel} type="button">
                  Plan with AI
                </button>
              </article>
            )}

            <section className="schedule-block" aria-labelledby="schedule-heading">
              <div className="schedule-header">
                <div className="compact-heading">
                  <Clock3 size={17} />
                  <h3 id="schedule-heading">Today&apos;s schedule</h3>
                </div>
                <div className="schedule-actions">
                  <button
                    className="secondary-button"
                    disabled={!unscheduledOpenTasks.length}
                    onClick={scheduleOpenTasks}
                    type="button"
                  >
                    <Plus size={16} />
                    Schedule open tasks
                  </button>
                  <button
                    className="secondary-button"
                    disabled={autoSpaceableTasks.length < 2}
                    onClick={autoSpaceSchedule}
                    type="button"
                  >
                    <Clock3 size={16} />
                    Auto-space schedule
                  </button>
                </div>
              </div>
              <section className="timeline-block" aria-label="Daily timeline">
                <div className="timeline-heading">
                  <strong>Daily timeline</strong>
                  <span>
                    {timelineSegments.length
                      ? `${timelineSegments.length} block${timelineSegments.length === 1 ? "" : "s"}`
                      : "No scheduled blocks"}
                  </span>
                </div>
                {timelineSegments.length ? (
                  <div className="daily-timeline">
                    {timelineSegments.map((segment) => (
                      <div
                        className={`timeline-segment ${segment.kind} ${
                          segment.done ? "done" : ""
                        } ${segment.overlap ? "overlap" : ""}`}
                        key={segment.id}
                        style={{ minHeight: getTimelineSegmentHeight(segment) }}
                      >
                        <time>{formatMinutesAsTimeLabel(segment.start)}</time>
                        <div>
                          <strong>{segment.title}</strong>
                          <span>
                            {segment.kind === "task" && segment.overlap
                              ? `${segment.detail} · overlaps previous block`
                              : segment.detail}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">
                    Add times to tasks to see the shape of your day.
                  </p>
                )}
              </section>
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
              <div className="schedule-insights" aria-label="Schedule check">
                {scheduleInsights.map((insight) => (
                  <article
                    className={`schedule-insight ${insight.level}`}
                    key={`${insight.label}-${insight.detail}`}
                  >
                    <strong>{insight.label}</strong>
                    <span>{insight.detail}</span>
                  </article>
                ))}
              </div>
            </section>

            {visibleTasks.length ? (
              <ul className="task-list" aria-label="Task list">
                {visibleTasks.map((task) => {
                  const projectName = getProjectName(task.projectId);
                  if (editingTaskId === task.id) {
                    return (
                      <li className="task-row editing" key={task.id}>
                        {renderTaskEditForm(task)}
                      </li>
                    );
                  }

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
                          aria-label={`Edit ${task.title}`}
                          className="icon-button"
                          onClick={() => startEditingTask(task)}
                          type="button"
                        >
                          <Pencil size={16} />
                        </button>
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

            <article className="memory-block">
              <div className="compact-heading">
                <Sparkles size={17} />
                <h3>Planning memory</h3>
              </div>
              <div className="memory-stats" aria-label="Planning memory status">
                <span>{plannerMemory.entries.length} saved days</span>
                <span>{plannerMemory.carryOverTasks.length} carry-over items</span>
              </div>
              <div
                className={`sync-summary ${syncStatus.phase}`}
                aria-label="Backup validation status"
              >
                {syncStatus.phase === "error" ? (
                  <CloudOff size={18} />
                ) : syncStatus.phase === "syncing" ? (
                  <RefreshCw size={18} />
                ) : (
                  <Cloud size={18} />
                )}
                <div>
                  <strong>{syncStatus.label}</strong>
                  <span>
                    {syncStatus.detail}
                    {syncStatus.sizeBytes
                      ? ` ${Math.round(syncStatus.sizeBytes / 1024)} KB checked.`
                      : ""}
                  </span>
                </div>
              </div>
              <label className="text-field">
                <span>Daily review for AI planning</span>
                <textarea
                  onChange={(event) => setReviewDraft(event.target.value)}
                  placeholder="Finished, unfinished, blockers, energy notes"
                  value={reviewDraft}
                />
              </label>
              {plannerMemory.carryOverTasks.length ? (
                <div className="memory-section">
                  <span>Current carry-over</span>
                  <ul className="memory-list">
                    {plannerMemory.carryOverTasks.slice(0, 5).map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="empty-state">No carry-over items yet.</p>
              )}
              {plannerMemory.patterns.length ? (
                <div className="memory-section">
                  <span>Detected patterns</span>
                  <ul className="memory-list">
                    {plannerMemory.patterns.map((pattern) => (
                      <li key={pattern}>{pattern}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="form-actions">
                <button
                  className="secondary-button"
                  disabled={syncStatus.phase === "syncing"}
                  onClick={() => void syncCurrentSnapshot("manual")}
                  type="button"
                >
                  <Cloud size={17} />
                  Validate backup now
                </button>
                <button className="secondary-button" onClick={saveDailyReview} type="button">
                  <Sparkles size={17} />
                  Save review to memory
                </button>
              </div>
              {memoryStatus ? (
                <p className="memory-status" role="status">
                  {memoryStatus}
                </p>
              ) : null}
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
