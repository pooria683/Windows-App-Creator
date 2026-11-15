import { useMemo, useState } from 'react';
import type { PackageManager, TemplateKind, UiFramework } from './lib/types.js';
import {
  buildCreateCommand,
  validatePackageId,
  validateProjectName,
  TEMPLATE_LABELS,
  TARGET_MATRIX,
} from './lib/command.js';

const UIS: UiFramework[] = ['react', 'vue', 'svelte', 'vanilla'];
const PMS: PackageManager[] = ['npm', 'pnpm', 'yarn', 'bun'];

/**
 * WinForge web UI — a configuration helper, not a build service.
 * It assembles the exact CLI command so developers can copy/paste it,
 * and explains which targets build locally vs. on GitHub Actions.
 */
export default function App() {
  const [projectName, setProjectName] = useState('my-app');
  const [packageId, setPackageId] = useState('com.example.myapp');
  const [template, setTemplate] = useState<TemplateKind>('electron');
  const [ui, setUi] = useState<UiFramework>('react');
  const [pm, setPm] = useState<PackageManager>('npm');
  const [copied, setCopied] = useState(false);

  const nameError = validateProjectName(projectName);
  const idError = validatePackageId(packageId);
  const valid = !nameError && !idError;

  const command = useMemo(
    () => buildCreateCommand({ projectName, template, ui, pm, packageId }),
    [projectName, template, ui, pm, packageId],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="page">
      <header className="hero">
        <div className="brand">
          <span className="logo">W</span>
          <div>
            <h1>WinForge</h1>
            <p className="sub">
              Scaffold, build and package Windows desktop apps — from macOS or Linux.
            </p>
          </div>
        </div>
        <p className="disclaimer">
          Builds on your machine are <strong>unsigned</strong> unless you configure code signing.
          Unsigned installers are not production-ready — Windows SmartScreen and macOS Gatekeeper
          will warn users.
        </p>
      </header>

      <main className="grid">
        <section className="card">
          <h2>1. Configure your app</h2>

          <label>
            Project name
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              spellCheck={false}
            />
          </label>
          {nameError && <p className="error">{nameError}</p>}

          <label>
            Package identifier (reverse-DNS)
            <input
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              spellCheck={false}
            />
          </label>
          {idError && <p className="error">{idError}</p>}

          <fieldset>
            <legend>Desktop framework</legend>
            {(Object.keys(TEMPLATE_LABELS) as TemplateKind[]).map((t) => (
              <label key={t} className="inline">
                <input type="radio" checked={template === t} onChange={() => setTemplate(t)} />
                {TEMPLATE_LABELS[t]}
              </label>
            ))}
          </fieldset>

          <label>
            UI framework
            <select value={ui} onChange={(e) => setUi(e.target.value as UiFramework)}>
              {UIS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>

          <label>
            Package manager
            <select value={pm} onChange={(e) => setPm(e.target.value as PackageManager)}>
              {PMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="card">
          <h2>2. Run this command</h2>
          <pre className="command">
            <code>{command}</code>
          </pre>
          <button onClick={copy} disabled={!valid} className="primary">
            {copied ? 'Copied ✔' : 'Copy command'}
          </button>
          <p className="hint">
            Install the CLI first: <code>npm i -g @winforge/cli</code> — or run from a clone with{' '}
            <code>node packages/cli/dist/index.js create …</code>.
          </p>

          <h3>Then</h3>
          <pre className="command">
            <code>{`cd ${projectName}\n${pm} run dev\nwinforge build --target windows`}</code>
          </pre>
        </section>
      </main>

      <section className="card wide">
        <h2>Where each installer comes from</h2>
        <table>
          <thead>
            <tr>
              <th>Target</th>
              <th>Artifacts</th>
              <th>Electron, locally</th>
              <th>Tauri, locally</th>
              <th>CI runner</th>
            </tr>
          </thead>
          <tbody>
            {TARGET_MATRIX.map((row) => (
              <tr key={row.target}>
                <td>{row.target}</td>
                <td>{row.artifacts}</td>
                <td>{row.localElectron}</td>
                <td>{row.localTauri}</td>
                <td>
                  <code>{row.ci}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">
          Generate the workflow with <code>winforge ci --release</code>. It builds on{' '}
          <code>windows-latest</code>, <code>macos-latest</code> and <code>ubuntu-latest</code>, and
          uploads artifacts to the run.
        </p>
      </section>

      <footer className="footer">
        <span>WinForge · MIT</span>
        <span>Signing disabled by default · semantic versioning · no hardcoded secrets</span>
      </footer>
    </div>
  );
}
