import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import { initialDb } from '../types/schema.js';

const dbPath = path.resolve(process.cwd(), env.dataFile);

async function ensureDbFile() {
  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });

  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(initialDb, null, 2), 'utf8');
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(raw);
}

export async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function withDb(mutator) {
  const data = await readDb();
  const result = await mutator(data);
  await writeDb(data);
  return result;
}
