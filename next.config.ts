import type { NextConfig } from "next";
import { productionEnvProblem, productionEnvWarnings } from "./lib/env/production";

/*
 * A production build refuses to finish without the account settings.
 *
 * Checked here because this is where they matter: NEXT_PUBLIC_* values are
 * frozen into the bundle from the environment `next build` runs in, so this
 * sees exactly what the browser will get. Without them the build would still
 * succeed — and ship a site with accounts silently switched off
 * (lib/env/production.ts has the story).
 *
 * Only production builds on Vercel are held to it. Local builds, CI and preview
 * deploys run without the real settings on purpose.
 */
const problem = productionEnvProblem(process.env);
if (problem) throw new Error(problem);
for (const warning of productionEnvWarnings(process.env)) console.warn(warning);

const nextConfig: NextConfig = {
  // Pin the workspace root. Without this, Turbopack walks up and finds a stray
  // package-lock.json in the home directory, then warns on every build.
  turbopack: { root: __dirname },
};

export default nextConfig;
