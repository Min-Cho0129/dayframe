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

const STORAGE_KEY = "haru-start-app-v1";
const storeListeners = new Set<() => void>();

const defaultState: AppState = {
  focus: "가장 중요한 일 하나를 끝내는 하루",
  energy: 4,
  mood: "clear",
  tasks: [
    {
      id: "task-1",
      title: "오늘 반드시 끝낼 핵심 업무 정하기",
      area: "집중",
      done: false,
    },
    {
      id: "task-2",
      title: "프로젝트 다음 행동 1개 실행",
      area: "프로젝트",
      done: false,
    },
    {
      id: "task-3",
      title: "저녁 10분 회고 남기기",
      area: "회고",
      done: false,
    },
  ],
  habits: [
    {
      id: "habit-1",
      name: "물 한 잔",
      streak: 12,
      target: "기상 후",
      doneToday: true,
    },
    {
      id: "habit-2",
      name: "20분 걷기",
      streak: 5,
      target: "점심 전",
      doneToday: false,
    },
    {
      id: "habit-3",
      name: "독서 10쪽",
      streak: 8,
      target: "잠들기 전",
      doneToday: false,
    },
  ],
  goals: [
    {
      id: "goal-1",
      title: "몸과 집중력을 회복하는 루틴 만들기",
      horizon: "이번 달",
      progress: 64,
    },
    {
      id: "goal-2",
      title: "주요 프로젝트 MVP 출시",
      horizon: "이번 분기",
      progress: 38,
    },
  ],
  projects: [
    {
      id: "project-1",
      name: "개인 생산성 시스템",
      stage: "설계",
      progress: 46,
      nextAction: "아침 루틴 템플릿 정리",
    },
    {
      id: "project-2",
      name: "포트폴리오 개선",
      stage: "실행",
      progress: 72,
      nextAction: "대표 사례 문장 다듬기",
    },
  ],
  journal:
    "오늘의 기준은 완벽함이 아니라 시작이다. 첫 30분에 속도를 만들자.",
  note: "기억할 것: 해야 할 일을 줄이면 실행력이 올라간다.",
};

const moodLabels: Record<Mood, string> = {
  calm: "차분",
  clear: "명료",
  bold: "도전",
};

const encouragement: Record<Mood, string> = {
  calm: "속도를 낮추고, 가장 작은 다음 행동부터.",
  clear: "오늘의 기준이 분명하면 에너지가 덜 새어 나갑니다.",
  bold: "시작 전 망설임보다 실행 후 조정이 빠릅니다.",
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
      new Intl.DateTimeFormat("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date()),
    [],
  );

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
          area: "오늘",
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
      <aside className="side-rail" aria-label="주요 메뉴">
        <div className="brand-mark" aria-hidden="true">
          <Sunrise size={22} strokeWidth={2.2} />
        </div>
        <nav className="rail-nav">
          <a href="#today" aria-label="오늘">
            <CalendarDays size={19} />
          </a>
          <a href="#tasks" aria-label="할 일">
            <ListChecks size={19} />
          </a>
          <a href="#goals" aria-label="목표">
            <Target size={19} />
          </a>
          <a href="#journal" aria-label="저널">
            <NotebookPen size={19} />
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar" id="today">
          <div>
            <p className="eyebrow">{todayLabel}</p>
            <h1>하루 시작</h1>
          </div>
          <div className="sync-pill">
            <Check size={16} />
            저장됨
          </div>
        </header>

        <section className="morning-board" aria-label="오늘의 시작 요약">
          <div className="focus-editor">
            <label htmlFor="daily-focus">오늘의 한 문장</label>
            <input
              id="daily-focus"
              value={state.focus}
              onChange={(event) =>
                updateState((current) => ({
                  ...current,
                  focus: event.target.value,
                }))
              }
            />
            <p>{encouragement[state.mood]}</p>
          </div>

          <div className="momentum-meter" aria-label={`추진력 ${stats.momentum}%`}>
            <div
              className="meter-fill"
              style={{ width: `${stats.momentum}%` }}
            />
            <div className="meter-copy">
              <span>오늘의 추진력</span>
              <strong>{stats.momentum}%</strong>
            </div>
          </div>

          <div className="energy-control">
            <label htmlFor="energy">에너지</label>
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

          <div className="mood-switcher" aria-label="오늘의 태도">
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

        <section className="stat-grid" aria-label="오늘의 상태">
          <StatusTile
            icon={<ClipboardList size={20} />}
            label="할 일"
            value={`${stats.completedTasks}/${stats.totalTasks}`}
          />
          <StatusTile
            icon={<Flame size={20} />}
            label="습관"
            value={`${stats.completedHabits}/${stats.totalHabits}`}
          />
          <StatusTile
            icon={<TrendingUp size={20} />}
            label="목표 평균"
            value={`${Math.round(
              state.goals.reduce((sum, goal) => sum + goal.progress, 0) /
                Math.max(state.goals.length, 1),
            )}%`}
          />
          <StatusTile
            icon={<Gauge size={20} />}
            label="프로젝트"
            value={`${state.projects.length}개`}
          />
        </section>

        <div className="content-grid">
          <section className="panel task-panel" id="tasks">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Daily command</p>
                <h2>오늘 할 일</h2>
              </div>
              <Sparkles size={20} />
            </div>

            <form className="task-form" onSubmit={addTask}>
              <input
                aria-label="새 할 일"
                onChange={(event) => setTaskDraft(event.target.value)}
                placeholder="지금 떠오른 일"
                value={taskDraft}
              />
              <button aria-label="할 일 추가" type="submit">
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
                <h2>습관 추적</h2>
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
                  <em>{habit.streak}일</em>
                </button>
              ))}
            </div>
          </section>

          <section className="panel" id="goals">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">North stars</p>
                <h2>목표 설정</h2>
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
                      aria-label={`${goal.title} 진행률`}
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
                <h2>프로젝트 관리</h2>
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
                      aria-label={`${project.name} 진행률 줄이기`}
                      onClick={() => updateProject(project.id, project.progress - 5)}
                      type="button"
                    >
                      <ChevronRight className="reverse-icon" size={17} />
                    </button>
                    <span>{project.progress}%</span>
                    <button
                      aria-label={`${project.name} 진행률 올리기`}
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
                <h2>노트 & 저널</h2>
              </div>
              <NotebookPen size={20} />
            </div>

            <label className="text-field">
              <span>아침 저널</span>
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
              <span>빠른 노트</span>
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
