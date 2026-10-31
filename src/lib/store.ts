import { promises as fs } from "fs";
import path from "path";
import seed from "@/data/seed.json";
import type { Recount } from "./types";

const FILE = path.join(process.cwd(), "data", "recounts.json");

async function readLocal(): Promise<Recount[]> {
  if (process.env.VERCEL) return [];
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function listRecounts(): Promise<Recount[]> {
  const local = await readLocal();
  const ids = new Set(local.map((recount) => recount.id));
  return [...local, ...(seed as Recount[]).filter((recount) => !ids.has(recount.id))];
}

export async function saveRecount(recount: Recount) {
  const local = await readLocal();
  try {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify([recount, ...local], null, 2));
  } catch {
    // Read-only filesystem on serverless hosts: the run still reaches the client.
  }
}
