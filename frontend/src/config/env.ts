export const env = {
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID ?? "",
  subgraphUrl:
    import.meta.env.VITE_SUBGRAPH_URL ??
    "https://api.studio.thegraph.com/query/1760034/zubidubi/v0.9.4",
  solverApiUrl: import.meta.env.VITE_SOLVER_API_URL ?? "http://localhost:8787",
};

export function requireClientEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required frontend env: ${name}`);
  }

  return value;
}
