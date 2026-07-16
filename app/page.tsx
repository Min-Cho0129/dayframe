"use client";

import {
  CalendarDays,
  Check,
  ChevronRight,
  Circle,
  ClipboardList,
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
  TrendingUp,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState, useSyncExternalStore } from "react";

type Task = {
  id: string;
  title: string;
  area: string;
  done: boolean;
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

type Mood = "calm" | "clear" | "bold";

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
  note: string;
};

const STORAGE_KEY = "dayframe-app-v2";
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
  focus: "Win the day by finishing the one thing that matters most",
  energy: 4,
  mood: "clear",
  tasks: [
    {
      id: "task-1",
      title: "Choose the one critical task for today",
      area: "Focus",
      done: false,
    },
    {
      id: "task-2",
      title: "Move one active project forward",
      area: "Project",
      done: false,
    },
    {
      id: "task-3",
      title: "Write a 10-minute evening reflection",
      area: "Review",
      done: false,
    },
  ],
  habits: [
    {
      id: "habit-1",
      name: "Drink water",
      streak: 12,
      target: "After waking",
      doneToday: true,
    },
    {
      id: "habit-2",
      name: "Walk 20 min",
      streak: 5,
      target: "Before lunch",
      doneToday: false,
    },
    {
      id: "habit-3",
      name: "Read 10 pages",
      streak: 8,
      target: "Before bed",
      doneToday: false,
    },
  ],
  goals: [
    {
      id: "goal-1",
      title: "Build a routine that restores energy and focus",
      horizon: "This month",
      progress: 64,
    },
    {
      id: "goal-2",
      title: "Launch the MVP for the main project",
      horizon: "This quarter",
      progress: 38,
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "Personal productivity system",
      stage: "Design",
      progress: 46,
      nextAction: "Refine the morning routine template",
    },
    {
      id: "project-2",
      name: "Portfolio refresh",
      stage: "Execution",
      progress: 72,
      nextAction: "Rewrite the featured case study copy",
    },
  ],
  journal:
    "Today is not about being perfect. It is about starting clean and creating momentum in the first 30 minutes.",
  note: "Remember: fewer commitments make execution easier.",
};

const moodLabels: Record<Mood, string> = {
  calm: "Calm",
  clear: "Clear",
  bold: "Bold",
};

const encouragement: Record<Mood, string> = {
  calm: "Slow the pace and start with the smallest next action.",
  clear: "A clear standard keeps your energy from leaking.",
  bold: "Adjusting after action is faster than waiting before it.",
};

function normalizeState(value: Partial<AppState>): AppState {
  return {
    ...defaultState,
    ...value,
    tasks: Array.isArray(value.tasks) ? value.tasks : defaultState.tasks,
    habits: Array.isArray(value.habits) ? value.habits : defaultState.habits,
    goals: Array.isArray(value.goals) ? value.goals : defaultState.goals,
    projects: Array.isArray(value.projects)
      ? value.projects
      : defaultState.projects,
  };
}

function readStoredState(): AppState {
  if (typeof window === "undefined") return defaultState;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeState(JSON.parse(saved)) : defaultState;
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  storeListeners.forEach((listener) => listener());
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function getDailyQuote(date: Date) {
  const dayNumber = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  );

  return dailyQuotes[dayNumber % dailyQuotes.length];
}

export default function Home() {
  const [taskDraft, setTaskDraft] = useState("");
  const stateSnapshot = useSyncExternalStore(
    subscribeToStore,
    getStoredSnapshot,
    getServerSnapshot,
  );
  const state = useMemo(
    () => normalizeState(JSON.parse(stateSnapshot)),
    [stateSnapshot],
  );

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    [],
  );
  const dailyQuote = useMemo(() => getDailyQuote(new Date()), []);

  const stats = useMemo(() => {
    const completedTasks = state.tasks.filter((task) => task.done).length;
    const taskRate =
      state.tasks.length === 0 ? 0 : completedTasks / state.tasks.length;
    const completedHabits = state.habits.filter((habit) => habit.doneToday).length;
    const habitRate =
      state.habits.length === 0 ? 0 : completedHabits / state.habits.length;
    const goalRate =
      state.goals.reduce((sum, goal) => sum + goal.progress, 0) /
      Math.max(state.goals.length, 1) /
      100;
    const momentum = Math.round(taskRate * 36 + habitRate * 34 + goalRate * 30);

    return {
      completedTasks,
      totalTasks: state.tasks.length,
      completedHabits,
      totalHabits: state.habits.length,
      momentum,
    };
  }, [state.goals, state.habits, state.tasks]);

  function updateState(updater: (current: AppState) => AppState) {
    writeStoredState(updater(readStoredState()));
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;

    updateState((current) => ({
      ...current,
      tasks: [
        {
          id: `task-${Date.now()}`,
          title,
          area: "Today",
          done: false,
        },
        ...current.tasks,
      ],
    }));
    setTaskDraft("");
  }

  function toggleTask(id: string) {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    }));
  }

  function toggleHabit(id: string) {
    updateState((current) => ({
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
    }));
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
            <p className="eyebrow">{todayLabel}</p>
            <h1>Dayframe</h1>
          </div>
          <div className="sync-pill">
            <Check size={16} />
            Saved
          </div>
        </header>

        <section className="morning-board" aria-label="Morning dashboard summary">
          <div className="focus-editor">
            <div className="quote-label">
              <span>Daily quote</span>
              <em>Refreshes every day</em>
            </div>
            <blockquote className="daily-quote">
              <p>{dailyQuote.text}</p>
              <cite>{dailyQuote.tag}</cite>
            </blockquote>
            <p>{encouragement[state.mood]}</p>
          </div>

          <div className="momentum-meter" aria-label={`Momentum ${stats.momentum}%`}>
            <div
              className="meter-fill"
              style={{ width: `${stats.momentum}%` }}
            />
            <div className="meter-copy">
              <span>Today&apos;s momentum</span>
              <strong>{stats.momentum}%</strong>
            </div>
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
            value={`${Math.round(
              state.goals.reduce((sum, goal) => sum + goal.progress, 0) /
                Math.max(state.goals.length, 1),
            )}%`}
          />
          <StatusTile
            icon={<Gauge size={20} />}
            label="Projects"
            value={`${state.projects.length}`}
          />
        </section>

        <div className="content-grid">
          <section className="panel task-panel" id="tasks">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Daily command</p>
                <h2>Today&apos;s tasks</h2>
              </div>
              <Sparkles size={20} />
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input
                aria-label="New task"
                onChange={(event) => setTaskDraft(event.target.value)}
                placeholder="Add a task that just came to mind"
                value={taskDraft}
              />
              <button aria-label="Add task" type="submit">
                <Plus size={18} />
              </button>
            </form>

            <div className="task-list">
              {state.tasks.map((task) => (
                <button
                  className={`task-row ${task.done ? "done" : ""}`}
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  type="button"
                >
                  {task.done ? <Check size={18} /> : <Circle size={18} />}
                  <span>{task.title}</span>
                  <em>{task.area}</em>
                </button>
              ))}
            </div>
          </section>

          <section className="panel habit-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Streak builder</p>
                <h2>Habit tracker</h2>
              </div>
              <TimerReset size={20} />
            </div>

            <div className="habit-grid">
              {state.habits.map((habit) => (
                <button
                  className={`habit-card ${habit.doneToday ? "done" : ""}`}
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  type="button"
                >
                  <span className="habit-status">
                    {habit.doneToday ? <Check size={16} /> : <Circle size={16} />}
                  </span>
                  <strong>{habit.name}</strong>
                  <span>{habit.target}</span>
                  <em>{habit.streak} days</em>
                </button>
              ))}
            </div>
          </section>

          <section className="panel" id="goals">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">North stars</p>
                <h2>Goals</h2>
              </div>
              <Target size={20} />
            </div>

            <div className="progress-list">
              {state.goals.map((goal) => (
                <article className="progress-item" key={goal.id}>
                  <div>
                    <span>{goal.horizon}</span>
                    <strong>{goal.title}</strong>
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
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Project flow</p>
                <h2>Projects</h2>
              </div>
              <FolderKanban size={20} />
            </div>

            <div className="project-list">
              {state.projects.map((project) => (
                <article className="project-row" key={project.id}>
                  <div>
                    <span>{project.stage}</span>
                    <strong>{project.name}</strong>
                    <p>{project.nextAction}</p>
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
                  <div className="track">
                    <span style={{ width: `${project.progress}%` }} />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="panel journal-panel" id="journal">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Notes and journal</p>
                <h2>Notes &amp; journal</h2>
              </div>
              <NotebookPen size={20} />
            </div>

            <label className="text-field">
              <span>Morning journal</span>
              <textarea
                onChange={(event) =>
                  updateState((current) => ({
                    ...current,
                    journal: event.target.value,
                  }))
                }
                value={state.journal}
              />
            </label>

            <label className="text-field">
              <span>Quick note</span>
              <textarea
                onChange={(event) =>
                  updateState((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                value={state.note}
              />
            </label>
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
      <span>{icon}</span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
