import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { listSavedExperiments, listSavedTopologies, saveExperiment, saveTopology } from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  workspace: router({
    listTopologies: protectedProcedure.query(({ ctx }) => listSavedTopologies(ctx.user.id)),
    listExperiments: protectedProcedure.query(({ ctx }) => listSavedExperiments(ctx.user.id)),
    saveTopology: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(120), nodes: z.array(z.unknown()), links: z.array(z.unknown()), events: z.array(z.unknown()) }))
      .mutation(({ ctx, input }) => saveTopology({ userId: ctx.user.id, ...input })),
    saveExperiment: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(120), algorithm: z.string().min(1).max(48), results: z.unknown(), topologyId: z.number().int().optional() }))
      .mutation(({ ctx, input }) => saveExperiment({ userId: ctx.user.id, ...input })),
  }),
});

export type AppRouter = typeof appRouter;
