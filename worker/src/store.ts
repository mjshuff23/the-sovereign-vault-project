import Redis from "ioredis";
import type { PipelineEvent } from "./contracts.js";

export type RequestRecord = {
  requestId: string;
  status: "green" | "red";
  reasons: string[];
  traceId: string;
  updatedAt: string;
};

export interface CircuitStore {
  setCircuit(requestId: string, status: "green" | "red"): Promise<void>;
  saveRequest(record: RequestRecord): Promise<void>;
  appendEvent(event: PipelineEvent): Promise<void>;
  close(): Promise<void>;
}

export class RedisCircuitStore implements CircuitStore {
  private readonly redis: Redis;

  constructor(redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379") {
    this.redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 2 });
  }

  private async client(): Promise<Redis> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
    return this.redis;
  }

  async setCircuit(requestId: string, status: "green" | "red"): Promise<void> {
    const client = await this.client();
    await client.set(`sv:circuit:${requestId}`, status, "EX", 60 * 30);
  }

  async saveRequest(record: RequestRecord): Promise<void> {
    const client = await this.client();
    await client.set(`sv:req:${record.requestId}`, JSON.stringify(record), "EX", 60 * 30);
  }

  async appendEvent(event: PipelineEvent): Promise<void> {
    const client = await this.client();
    await client.xadd("sv:events", "*", "event", JSON.stringify(event));
  }

  async close(): Promise<void> {
    this.redis.disconnect();
  }
}

export class MemoryCircuitStore implements CircuitStore {
  readonly circuits = new Map<string, "green" | "red">();
  readonly requests = new Map<string, RequestRecord>();
  readonly events: PipelineEvent[] = [];

  async setCircuit(requestId: string, status: "green" | "red"): Promise<void> {
    this.circuits.set(requestId, status);
  }

  async saveRequest(record: RequestRecord): Promise<void> {
    this.requests.set(record.requestId, record);
  }

  async appendEvent(event: PipelineEvent): Promise<void> {
    this.events.push(event);
  }

  async close(): Promise<void> {
    return;
  }
}
