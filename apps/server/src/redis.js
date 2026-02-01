import { createClient } from "redis";

let client;

export async function getRedis() {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not set");
  client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  return client;
}

