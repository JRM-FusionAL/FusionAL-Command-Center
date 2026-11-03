export async function sendManagementCommand(api, token, key, action, fetchImpl = fetch) {
  if (!token || token.trim().length < 32) throw new Error("A management token is required");
  if (!["start", "stop"].includes(action) || !/^[a-z0-9-]+$/.test(key)) {
    throw new Error("Invalid management action");
  }
  const base = new URL(api);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error("Invalid management API URL");
  }
  const response = await fetchImpl(`${api.replace(/\/+$/, "")}/${action}/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Management HTTP ${response.status}`);
  return response.json();
}
