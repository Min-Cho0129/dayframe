import assert from "node:assert/strict";
import test from "node:test";
import { createFallbackPlan, normalizePlan } from "../app/ai-planner.js";

test("creates a fallback AI plan from messy day notes", () => {
  const plan = createFallbackPlan({
    prompt: "오늘 2시에 수업 있고 portfolio 수정해야 하고 운동도 해야 해. 좀 피곤함.",
    energy: 2,
    mood: "tired",
  });

  assert.match(plan.intention, /realistic|deadline|progress|win/i);
  assert.ok(plan.tasks.length >= 2);
  assert.equal(plan.tasks[0].isCritical, true);
  assert.match(plan.tasks[0].scheduledTime, /^\d{2}:\d{2}$/);
  assert.ok(plan.tasks.every((task) => task.durationMinutes >= 10));
});

test("normalizes model plans into safe task data", () => {
  const plan = normalizePlan({
    intention: "Ship the important work.",
    summary: "A short plan.",
    tasks: [
      {
        title: "Deep work",
        scheduledTime: "99:99",
        durationMinutes: 999,
        priority: "urgent",
        area: "Unknown",
        isCritical: false,
        rationale: "",
      },
    ],
  });

  assert.equal(plan.tasks[0].isCritical, true);
  assert.equal(plan.tasks[0].scheduledTime, "09:00");
  assert.equal(plan.tasks[0].durationMinutes, 180);
  assert.equal(plan.tasks[0].priority, "high");
  assert.equal(plan.tasks[0].area, "Focus");
});

test("cleans simple English day notes for fallback tasks", () => {
  const plan = createFallbackPlan({
    prompt: "I have class at 2 PM, need to revise my portfolio, and want to work out.",
    energy: 3,
    mood: "clear",
  });

  assert.deepEqual(
    plan.tasks.map((task) => task.title),
    ["class", "revise my portfolio", "work out"],
  );
});

test("prioritizes saved carry-over memory in fallback plans", () => {
  const plan = createFallbackPlan({
    prompt: "Need to email my advisor.",
    energy: 4,
    mood: "clear",
    memory: {
      carryOverTasks: ["Finish portfolio draft", "Submit scholarship form"],
      recentDays: [
        {
          dateKey: "2026-07-20",
          unfinishedTasks: ["Finish portfolio draft"],
        },
      ],
    },
  });

  assert.equal(plan.tasks[0].title, "Finish portfolio draft");
  assert.equal(plan.tasks[0].isCritical, true);
  assert.ok(plan.tasks.some((task) => task.title === "email my advisor"));
  assert.match(plan.summary, /saved planning memory/i);
});
