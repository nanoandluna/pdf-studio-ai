import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { writeFileAtomic } from '../electron/fileIO';

let directory: string;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'pdf-studio-test-')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

it('replaces a complete PDF and leaves no temporary file', async () => {
  const destination = join(directory, 'document.pdf');
  await writeFile(destination, 'old');
  await writeFileAtomic(destination, new TextEncoder().encode('%PDF-new'));
  expect(await readFile(destination, 'utf8')).toBe('%PDF-new');
  expect(await readdir(directory)).toEqual(['document.pdf']);
});

it('a failed replacement cleans up temporary bytes', async () => {
  await expect(writeFileAtomic(directory, new Uint8Array([1, 2]))).rejects.toThrow();
  expect(await readdir(directory)).toEqual([]);
});
