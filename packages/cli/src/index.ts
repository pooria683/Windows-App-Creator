#!/usr/bin/env node
/**
 * WinForge CLI entry point.
 */
import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`✖ ${(err as Error).message}`);
  process.exit(1);
});
