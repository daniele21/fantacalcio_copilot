import { base_url } from "./api";
import { getAuthToken } from "./geminiService";

export async function getProbableLineups(matchday: number, season?: string, idToken?: string) {
  const token = getAuthToken(idToken);
  const resp = await fetch(`${base_url}/api/gemini/probable-lineups`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
    body: JSON.stringify({ matchday, season }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    throw new Error(data.message || "Errore dal backend Gemini.");
  }
  return data.data;
}
