import chalk from 'chalk';

export const log = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✔'), msg),
  warn: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.error(chalk.red('✖'), msg),
  title: (msg: string) => console.log('\n' + chalk.bold.cyan(msg) + '\n'),
  // dim writes to stdout for normal hints, but errors/hints that form part of
  // an error report go to stderr via `log.error`/`log.hint`.
  dim: (msg: string) => console.log(chalk.dim(msg)),
  hint: (msg: string) => console.error(chalk.dim(msg)),
};
