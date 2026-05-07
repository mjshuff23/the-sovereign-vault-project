const POLICY_FETCH_TIMEOUT_MS = Number.parseInt(
  process.env.POLICY_FETCH_TIMEOUT_MS ?? "1500",
  10
);

export async function fetchPolicyIds(
  qdrantUrl = process.env.QDRANT_URL ?? "http://localhost:6333",
  collection = process.env.QDRANT_COLLECTION ?? "policy_context",
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  const response = await fetcher(`${qdrantUrl}/collections/${collection}/points/scroll`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ limit: 8, with_payload: true, with_vector: false }),
    signal: AbortSignal.timeout(POLICY_FETCH_TIMEOUT_MS)
  });

  if (!response.ok) {
    throw new Error(`Qdrant policy lookup failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    result?: { points?: Array<{ payload?: { policy_id?: string } }> };
  };

  return (
    body.result?.points
      ?.map((point) => point.payload?.policy_id)
      .filter((policyId): policyId is string => Boolean(policyId)) ?? []
  );
}
