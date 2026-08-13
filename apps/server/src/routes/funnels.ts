import type { FastifyInstance } from "fastify";
import type { FunnelStep } from "@lumly/shared";
import type { AppContext } from "../context.js";
import { computeFunnel, createFunnel, deleteFunnel, listFunnels } from "../analytics/modules/funnels.js";
import { requireAuth } from "./auth.js";

function validSteps(input: unknown): FunnelStep[] | null {
  if (!Array.isArray(input) || input.length < 2 || input.length > 8) return null;
  const steps: FunnelStep[] = [];
  for (const s of input) {
    if (typeof s !== "object" || s === null) return null;
    const step = s as { type?: unknown; value?: unknown };
    if (step.type !== "page" && step.type !== "event") return null;
    if (typeof step.value !== "string" || step.value.length === 0 || step.value.length > 1024) return null;
    steps.push({ type: step.type, value: step.value });
  }
  return steps;
}

export function registerFunnelRoutes(app: FastifyInstance, ctx: AppContext): void {
  const auth = requireAuth(ctx);

  app.get("/api/v1/funnels", { preHandler: auth }, async (request) => {
    const { site } = request.query as { site?: string };
    if (!site) return { funnels: [] };
    return { funnels: await listFunnels(ctx, site) };
  });

  app.post("/api/v1/funnels", { preHandler: auth }, async (request, reply) => {
    const body = request.body as { site?: unknown; name?: unknown; steps?: unknown };
    const site = typeof body?.site === "string" ? await ctx.sites.get(body.site) : null;
    if (!site) return reply.code(404).send({ error: "unknown_site" });
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 200) return reply.code(400).send({ error: "invalid_name" });
    const steps = validSteps(body?.steps);
    if (!steps) return reply.code(400).send({ error: "invalid_steps" });
    const id = await createFunnel(ctx, site.id, name, steps);
    return reply.code(201).send({ id });
  });

  app.delete("/api/v1/funnels/:id", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { site } = request.query as { site?: string };
    if (!site) return reply.code(400).send({ error: "site required" });
    await deleteFunnel(ctx, site, Number(id));
    return reply.code(204).send();
  });

  app.get("/api/v1/funnels/:id/result", { preHandler: auth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const q = request.query as { site?: string; from?: string; to?: string };
    if (!q.site || !q.from || !q.to) return reply.code(400).send({ error: "site, from, to required" });
    const funnels = await listFunnels(ctx, q.site);
    const funnel = funnels.find((f) => f.id === Number(id));
    if (!funnel) return reply.code(404).send({ error: "unknown_funnel" });
    const steps = await computeFunnel(ctx, { site: q.site, from: q.from, to: q.to }, funnel.steps);
    return { id: funnel.id, name: funnel.name, steps };
  });
}
