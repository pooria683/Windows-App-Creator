/**
 * Interactive prompts for `winforge create`.
 * Uses the `prompts` library (lightweight, no native deps).
 *
 * Notes on `prompts@2` semantics (easy to get wrong):
 * - A function-valued `initial` is invoked as `(prevAnswer, answersSoFar, lastQuestion)`.
 *   `prevAnswer` is the value of the *previous* prompt only, so deriving a
 *   value from an earlier answer (e.g. package id from the app name) must read
 *   `answersSoFar` instead.
 * - `validate` must return `true` or a string error message.
 */
import prompts from 'prompts';
import type { ProjectConfig, TemplateKind, UiFramework, PackageManager } from './validate.js';
import {
  toSlug,
  validateAppName,
  validateAuthor,
  validateDescription,
  validateDisplayName,
  validatePackageId,
  validateVersion,
} from './validate.js';

/** Answers accumulated while the user works through the prompts. */
export interface PromptAnswers {
  name: string;
  appName: string;
  template: TemplateKind;
  ui: UiFramework;
  packageManager: PackageManager;
  packageId: string;
  version: string;
  author: string;
  description: string;
}

type Answers = Partial<PromptAnswers>;

/** Default reverse-DNS id derived from the project slug. */
export function defaultPackageId(name: unknown): string {
  // Defensive: `prompts` can call dynamic defaults before the previous answer
  // exists, and injected test values may not be strings.
  const raw = typeof name === 'string' ? name : '';
  const slug = toSlug(raw) || 'app';
  return `com.example.${slug.replace(/[^a-z0-9]/g, '') || 'app'}`;
}

/** Convert validator results (`true` | string) into prompts-compatible output. */
function asValidator(fn: (value: string) => string | true) {
  return (value: string): true | string => {
    const result = fn(value);
    return result === true ? true : result;
  };
}

export interface PromptOverrides {
  name?: string;
  appName?: string;
  template?: TemplateKind;
  ui?: UiFramework;
  packageManager?: PackageManager;
  packageId?: string;
  version?: string;
  author?: string;
  description?: string;
}

/**
 * Build the prompt definitions. Exported for tests: the array can be fed to
 * `prompts.inject()` or inspected without touching a terminal.
 */
export function buildQuestions(defaults: PromptOverrides = {}): prompts.PromptObject[] {
  return [
    {
      type: 'text',
      name: 'name',
      message: 'Project name (slug, used for the folder and npm package)',
      initial: defaults.name ?? 'my-app',
      validate: asValidator(validateAppName),
    },
    {
      type: 'text',
      name: 'appName',
      message: 'App display name (shown to users)',
      // `answersSoFar.name` is the already-answered project name.
      initial: (_prev: unknown, answers: Answers) =>
        defaults.appName ?? (typeof answers.name === 'string' ? answers.name : 'My App'),
      validate: asValidator(validateDisplayName),
    },
    {
      type: 'select',
      name: 'template',
      message: 'Desktop framework',
      choices: [
        { title: 'Electron + React + TypeScript', value: 'electron' },
        { title: 'Tauri + React + TypeScript (Rust, smaller binaries)', value: 'tauri' },
      ],
      initial: defaults.template === 'tauri' ? 1 : 0,
    },
    {
      type: 'select',
      name: 'ui',
      message: 'UI framework',
      choices: [
        { title: 'React', value: 'react' },
        { title: 'Vue', value: 'vue' },
        { title: 'Svelte', value: 'svelte' },
        { title: 'Plain HTML/CSS/JS (vanilla)', value: 'vanilla' },
      ],
      initial: Math.max(0, UIS.indexOf(defaults.ui ?? 'react')),
    },
    {
      type: 'select',
      name: 'packageManager',
      message: 'Package manager',
      choices: [
        { title: 'npm', value: 'npm' },
        { title: 'pnpm', value: 'pnpm' },
        { title: 'yarn', value: 'yarn' },
        { title: 'bun', value: 'bun' },
      ],
      initial: Math.max(0, PACKAGE_MANAGERS.indexOf(defaults.packageManager ?? 'npm')),
    },
    {
      type: 'text',
      name: 'packageId',
      message: 'Package identifier (reverse-DNS)',
      initial: (_prev: unknown, answers: Answers) =>
        defaults.packageId ?? defaultPackageId(answers.name),
      validate: asValidator(validatePackageId),
    },
    {
      type: 'text',
      name: 'version',
      message: 'Version (semver, no leading "v")',
      initial: defaults.version ?? '0.1.0',
      validate: asValidator(validateVersion),
    },
    {
      type: 'text',
      name: 'author',
      message: 'Author / publisher',
      initial: defaults.author ?? '',
      validate: asValidator(validateAuthor),
    },
    {
      type: 'text',
      name: 'description',
      message: 'Description',
      initial: defaults.description ?? 'A desktop app built with WinForge.',
      validate: asValidator(validateDescription),
    },
  ];
}

/** Assemble a ProjectConfig from raw answers, applying fallbacks. */
const TEMPLATES: TemplateKind[] = ['electron', 'tauri'];
const UIS: UiFramework[] = ['react', 'vue', 'svelte', 'vanilla'];
const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

/**
 * Resolve a select answer. `prompts` normally returns the choice `value`, but
 * when answers are injected it returns the choice *index* instead. Accept both
 * and fall back to the first option for anything unrecognised.
 */
export function resolveChoice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (typeof value === 'string' && (choices as readonly string[]).includes(value)) {
    return value as T;
  }
  if (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < choices.length
  ) {
    return choices[value]!;
  }
  return choices[0]!;
}

/** Coerce an answer to a trimmed string (prompts can hand back odd values). */
function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function answersToConfig(answers: Answers): ProjectConfig {
  const name = asText(answers.name, 'my-app');
  return {
    name,
    appName: asText(answers.appName, name),
    packageId: asText(answers.packageId, defaultPackageId(name)),
    version: asText(answers.version, '0.1.0'),
    author: asText(answers.author, 'Your Name'),
    description: asText(answers.description, 'A desktop app built with WinForge.'),
    template: resolveChoice(answers.template, TEMPLATES),
    ui: resolveChoice(answers.ui, UIS),
    packageManager: resolveChoice(answers.packageManager, PACKAGE_MANAGERS),
  };
}

/**
 * Run the interactive setup. Cancelling (Ctrl-C) exits with code 1 and
 * writes nothing.
 */
export async function promptProjectConfig(defaults: PromptOverrides = {}): Promise<ProjectConfig> {
  const answers = (await prompts(buildQuestions(defaults), {
    onCancel: () => {
      console.error('Cancelled — no files were written.');
      process.exit(1);
    },
  })) as Answers;

  return answersToConfig(answers);
}
