import { aiPlanSchema, createFallbackPlan, normalizePlan } from "../../ai-planner.js";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

type PlannerContext = {
  prompt: string;
  dateKey?: string;
  energy?: number;
  mood?: string;
  existingTasks?: Array<{
    title: string;
    scheduledTime?: string;
    durationMinutes?: number;
    priority?: string;
  }>;
  projects?: Array<{
    name: string;
    nextAction?: string;
    progress?: number;
  }>;
  goals?: Array<{
    title: string;
    progress?: number;
  }>;
};

export async function POST(request: Request) {
  let context: PlannerContext;

  try {
    context = (await request.json()) as PlannerContext;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!context.prompt?.trim()) {
    return Response.json(
      { error: "Tell Dayframe what your day looks like first." },
      { status: 400 },
    );
  }

  const fallbackPlan = createFallbackPlan(context);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return Response.json({
      plan: {
        ...fallbackPlan,
        source: "fallback",
      },
      warning: "OPENAI_API_KEY is not configured, so Dayframe used a local draft planner.",
    });
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        input: [
          {
            role: "system",
            content:
              "You are Dayframe, an adaptive daily planning assistant. Turn messy user notes into a realistic English time-blocked plan. Respect fixed appointments, avoid overloading the day, and make the first task the most important one. Return only the requested JSON.",
          },
          {
            role: "user",
            content: JSON.stringify({
              date: context.dateKey,
              energy: context.energy,
              mood: context.mood,
              userNotes: context.prompt,
              existingTasks: context.existingTasks ?? [],
              projects: context.projects ?? [],
              goals: context.goals ?? [],
            }),
          },
        ],
        max_output_tokens: 1200,
        text: {
          format: {
            type: "json_schema",
            name: "dayframe_daily_plan",
            strict: true,
            schema: aiPlanSchema,
          },
        },
      }),
    });

    if (!response.ok) {
      return Response.json({
        plan: {
          ...fallbackPlan,
          source: "fallback",
        },
        warning: `OpenAI planning failed with status ${response.status}, so Dayframe used a local draft planner.`,
      });
    }

    const body = await response.json();
    const responseText = extractResponseText(body);
    const plan = normalizePlan(JSON.parse(responseText));

    return Response.json({
      plan: {
        ...plan,
        source: "openai",
      },
    });
  } catch {
    return Response.json({
      plan: {
        ...fallbackPlan,
        source: "fallback",
      },
      warning: "OpenAI planning was unavailable, so Dayframe used a local draft planner.",
    });
  }
}

function extractResponseText(body: unknown) {
  if (isObject(body) && typeof body.output_text === "string") {
    return body.output_text;
  }

  if (isObject(body) && Array.isArray(body.output)) {
    for (const item of body.output) {
      if (!isObject(item) || !Array.isArray(item.content)) continue;
      for (const content of item.content) {
        if (isObject(content) && typeof content.text === "string") {
          return content.text;
        }
      }
    }
  }

  throw new Error("OpenAI response did not include text output.");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
