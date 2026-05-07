import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333";
const collection = process.env.QDRANT_COLLECTION ?? "policy_context";
const dimension = 16;

const root = new URL("..", import.meta.url);
const policiesDir = new URL("policies/", root);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const signal = options.signal ?? AbortSignal.timeout(5_000);
  let response;
  try {
    response = await fetch(`${qdrantUrl}${path}`, {
      ...options,
      signal,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "TimeoutError") {
      throw new Error(
        `${options.method ?? "GET"} ${qdrantUrl}${path} timed out after 5s`
      );
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${options.method ?? "GET"} ${path} failed: ${response.status} ${body}`);
  }

  return response.json();
}

async function waitForQdrant() {
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      await request("/collections");
      return;
    } catch (error) {
      if (attempt === 30) throw error;
      await sleep(500);
    }
  }
}

function deterministicVector(text) {
  const digest = createHash("sha256").update(text).digest();
  const vector = [];
  for (let index = 0; index < dimension; index += 1) {
    vector.push((digest[index] / 255) * 2 - 1);
  }
  return vector;
}

function pointId(policyId) {
  return Number.parseInt(createHash("sha256").update(policyId).digest("hex").slice(0, 12), 16);
}

await waitForQdrant();

await request(`/collections/${collection}`, {
  method: "PUT",
  body: JSON.stringify({
    vectors: {
      size: dimension,
      distance: "Cosine"
    }
  })
});

const files = (await readdir(policiesDir)).filter((file) => file.endsWith(".json"));
const policies = await Promise.all(
  files.map(async (file) => JSON.parse(await readFile(join(policiesDir.pathname, file), "utf8")))
);

const points = policies.map((policy) => ({
  id: pointId(policy.policy_id),
  vector: deterministicVector(`${policy.title}\n${policy.text}\n${policy.risk_tags.join(",")}`),
  payload: policy
}));

await request(`/collections/${collection}/points?wait=true`, {
  method: "PUT",
  body: JSON.stringify({ points })
});

console.log(`Seeded ${points.length} policies into Qdrant collection ${collection}`);
for (const policy of policies) {
  console.log(`- ${policy.policy_id}: ${policy.title}`);
}
