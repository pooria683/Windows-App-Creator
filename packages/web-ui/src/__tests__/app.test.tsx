/**
 * Renders the real App component in jsdom and asserts the user-facing
 * behaviour: validation, the generated command, and the target matrix.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../App.js';

describe('<App />', () => {
  beforeEach(() => cleanup());

  it('renders the heading and the honest signing warning', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'WinForge' })).toBeTruthy();
    const disclaimer = screen.getByText(/Builds on your machine are/i);
    expect(disclaimer.textContent).toMatch(/unsigned/i);
    expect(disclaimer.textContent).toMatch(/not production-ready/i);
  });

  it('shows the exact create command for the default configuration', () => {
    render(<App />);
    expect(
      screen.getByText(
        'winforge create my-app --template electron --ui react --pm npm --package-id com.example.myapp',
      ),
    ).toBeTruthy();
  });

  it('updates the command when the framework, UI and package manager change', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Tauri/i }));
    fireEvent.change(screen.getByLabelText(/UI framework/i), { target: { value: 'svelte' } });
    fireEvent.change(screen.getByLabelText(/Package manager/i), { target: { value: 'bun' } });
    expect(
      screen.getByText(
        'winforge create my-app --template tauri --ui svelte --pm bun --package-id com.example.myapp',
      ),
    ).toBeTruthy();
  });

  it('blocks copying and shows an error for an invalid package id', () => {
    render(<App />);
    const idInput = screen.getByLabelText(/Package identifier/i);
    fireEvent.change(idInput, { target: { value: 'not-reverse-dns' } });
    expect(screen.getByText(/reverse-DNS identifier/i)).toBeTruthy();
    const button = screen.getByRole('button', { name: /Copy command/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('shows an error for an invalid project name', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Project name/i), { target: { value: '1bad name' } });
    expect(screen.getByText(/must start with a letter/i)).toBeTruthy();
  });

  it('explains which targets need CI', () => {
    render(<App />);
    const table = screen.getByRole('table');
    expect(table.textContent).toContain('windows-latest');
    expect(table.textContent).toContain('macos-latest');
    expect(table.textContent).toContain('ubuntu-latest');
    expect(table.textContent).toContain('Rust cannot cross-compile');
  });

  it('quotes unsafe project names in the generated command', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Project name/i), { target: { value: 'my app' } });
    // "my app" fails validation (spaces), so the command quotes it defensively.
    expect(screen.getByText(/winforge create 'my app'/)).toBeTruthy();
  });
});
