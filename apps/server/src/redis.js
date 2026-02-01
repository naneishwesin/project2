import { createClient } from "redis";

let client;

export async function getRedis() {
  const url = process.env.REDIS_URL;

  // ✅ Redis disabled mode
  if (!url || url === "disabled") {
    return null;
  }

  if (client) return client;

  client = createClient({ url });
  client.on("error", () => {});
  await client.connect();
  return client;
}
