export type Priority = "low" | "medium" | "high";
export type Mood = "calm" | "clear" | "bold" | "tired";

export type Task = {
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

export type Habit = {
  id: string;
  name: string;
  streak: number;
  target: string;
  doneToday: boolean;
};

export type Goal = {
  id: string;
  title: string;
  horizon: string;
  progress: number;
};

export type Project = {
  id: string;
  name: string;
  stage: string;
  progress: number;
  nextAction: string;
};

export type DailyQuote = {
  text: string;
  tag: string;
};

export type AppState = {
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

export type PersistentState = Pick<AppState, "habits" | "goals" | "projects">;

export type DailyStoredState = Pick<
  AppState,
  "focus" | "energy" | "mood" | "tasks" | "journal" | "eveningJournal" | "note"
> & {
  habitCompletions: Record<string, boolean>;
};

export type GeneratedPlanTask = {
  title: string;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
  area: string;
  isCritical: boolean;
  rationale: string;
};

export type GeneratedPlan = {
  intention: string;
  summary: string;
  source: "openai" | "fallback";
  tasks: GeneratedPlanTask[];
};

export type ScheduleInsight = {
  level: "ok" | "warning" | "info";
  label: string;
  detail: string;
};

export type TimelineSegment = {
  id: string;
  kind: "task" | "gap";
  start: number;
  end: number;
  title: string;
  detail: string;
  done?: boolean;
  overlap?: boolean;
  priority?: Priority;
};

export type DailyMemoryEntry = {
  dateKey: string;
  completedTasks: string[];
  unfinishedTasks: string[];
  energy: number;
  mood: Mood;
  intention: string;
  review: string;
  savedAt: string;
};

export type PlannerMemory = {
  entries: DailyMemoryEntry[];
  carryOverTasks: string[];
  patterns: string[];
};

export type PlannerMemoryContext = {
  recentDays: Array<{
    dateKey: string;
    completedTasks: string[];
    unfinishedTasks: string[];
    energy: number;
    mood: Mood;
    intention: string;
    review: string;
  }>;
  carryOverTasks: string[];
  patterns: string[];
};

export type TaskDraft = {
  title: string;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
};

export type HabitDraft = {
  name: string;
  target: string;
};

export type GoalDraft = {
  title: string;
  horizon: string;
};

export type ProjectDraft = {
  name: string;
  stage: string;
  nextAction: string;
};

export type TaskEditDraft = {
  title: string;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
  area: string;
  isCritical: boolean;
};

export type PlanGuideDraft = {
  fixedEvents: string;
  mustDo: string;
  wantToDo: string;
  constraints: string;
};

export type TodaySnapshot = {
  dateKey: string;
  label: string;
};

export type SyncPhase = "idle" | "syncing" | "validated" | "error";

export type SyncStatus = {
  phase: SyncPhase;
  label: string;
  detail: string;
  sizeBytes?: number;
};

export type UndoState = {
  message: string;
  previous: AppState;
};
