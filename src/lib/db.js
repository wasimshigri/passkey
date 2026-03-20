import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';
import { env } from '../config/env.js';
import { initialDb } from '../types/schema.js';

const DB_KEY = 'passkey:db';
const dbPath = path.resolve(process.cwd(), env.dataFile);

// Check if we're in Vercel environment
const isVercel = !!process.env.VERCEL;

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
  if (isVercel) {
    try {
      const data = await kv.get(DB_KEY);
      return data || initialDb;
    } catch (error) {
      console.error('KV read error:', error);
      return initialDb;
    }
  } else {
    // Local development: use file system
    await ensureDbFile();
    const raw = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(raw);
  }
}

export async function writeDb(data) {
  if (isVercel) {
    try {
      await kv.set(DB_KEY, data);
    } catch (error) {
      console.error('KV write error:', error);
      throw error;
    }
  } else {
    // Local development: use file system
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
  }
}

export async function withDb(mutator) {
  const data = await readDb();
  const result = await mutator(data);
  await writeDb(data);
  return result;
}
