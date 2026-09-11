import { env } from "@/config/env";

type GraphResponse<T> = {
  data?: T;
  errors?: { message: string }[];
};

export async function graphRequest<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(env.subgraphUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Subgraph request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as GraphResponse<T>;

  if (json.errors?.length) {
    throw new Error(json.errors.map((error) => error.message).join("; "));
  }

  if (!json.data) {
    throw new Error("Subgraph response did not include data.");
  }

  return json.data;
}
