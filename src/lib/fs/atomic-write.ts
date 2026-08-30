import "server-only";

import { open, rename, writeFile } from "fs/promises";

/** Atomic replace: write *.tmp → fsync → rename. Survives crash mid-write. */
export async function atomicWriteFile(
  filePath: string,
  data: Buffer | string,
): Promise<void> {
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await writeFile(tmp, data);
  const handle = await open(tmp, "r");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, filePath);
}

export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await atomicWriteFile(filePath, JSON.stringify(value));
}
