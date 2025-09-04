import { base_url } from "./api";
import { getAuthToken } from "./geminiService";

export async function getMatchdays(date: string, idToken?: string) {
  // Calls the backend /get_matchdays endpoint with a date string (YYYY-MM-DD)
  const token = getAuthToken(idToken);
  const resp = await fetch(`${base_url}/api/lineup/get_matchdays`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ date }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.message || data.error || "Errore dal backend lineup.");
  }
  return data.data;
}
