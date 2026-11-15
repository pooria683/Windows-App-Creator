/**
 * `winforge dev`
 * Starts local development with hot reload.
 */
import { Command } from 'commander';
import { log } from '../lib/logger.js';
import { loadConfig } from '../lib/config.js';
import { runScript } from '../lib/runner.js';

export function registerDev(program: Command): void {
  program
    .command('dev')
    .description('Start local development with hot reload')
    .option('--host <host>', 'Dev server host', '127.0.0.1')
    .option('--port <port>', 'Dev server port')
    .action(async (opts: { host?: string; port?: string }) => {
      const { config, projectRoot } = await loadConfig(process.cwd());
      log.title(`Starting ${config.appName} in development mode`);
      log.info(`Template: ${config.template}  UI: ${config.ui}  PM: ${config.packageManager}`);
      const env: Record<string, string> = {};
      if (opts.host) env['HOST'] = opts.host;
      if (opts.port) env['PORT'] = opts.port;
      try {
        await runScript(config.packageManager, 'dev', { cwd: projectRoot, env });
      } catch (err) {
        log.error(`Dev server exited with error: ${(err as Error).message}`);
        process.exit(1);
      }
    });
}
