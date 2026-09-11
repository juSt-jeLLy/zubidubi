export const env = {
  privyAppId: import.meta.env.VITE_PRIVY_APP_ID ?? "",
};

export function requireClientEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required frontend env: ${name}`);
  }

  return value;
}
