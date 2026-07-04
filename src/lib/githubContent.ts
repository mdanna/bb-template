import { DEMO_MODE } from "@/lib/demo";

const REPO_OWNER = process.env.GITHUB_REPO_OWNER ?? "your-github-username";
const REPO_NAME = process.env.GITHUB_REPO_NAME ?? "your-repo-name";
const DATA_BRANCH = process.env.GITHUB_DATA_BRANCH ?? "main";

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function getFile(path: string, token: string) {
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${DATA_BRANCH}`,
    { headers: headers(token), cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Impossibile leggere ${path} da GitHub: ${await res.text()}`);
  }
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf-8");
  return { content, sha: data.sha as string };
}

export async function putFile(
  path: string,
  content: string,
  sha: string,
  message: string,
  token: string
) {
  // In demo non si scrive nulla su GitHub: successo simulato, nessun commit/redeploy.
  if (DEMO_MODE) return { commitSha: undefined as string | undefined };
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: "PUT",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(content, "utf-8").toString("base64"),
        sha,
        branch: DATA_BRANCH,
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Impossibile salvare ${path} su GitHub: ${await res.text()}`);
  }
  const data = await res.json();
  return { commitSha: data.commit?.sha as string | undefined };
}

export async function deleteFile(
  path: string,
  sha: string,
  message: string,
  token: string
) {
  if (DEMO_MODE) return;
  const res = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    {
      method: "DELETE",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ message, sha, branch: DATA_BRANCH }),
    }
  );
  if (!res.ok) {
    throw new Error(`Impossibile eliminare ${path} da GitHub: ${await res.text()}`);
  }
}

export function requireBotToken(): string {
  if (DEMO_MODE) return "demo";
  const token = process.env.GITHUB_BOT_TOKEN;
  if (!token) {
    throw new Error("GITHUB_BOT_TOKEN non configurato");
  }
  return token;
}
