import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface Entry {
  id: string;
  status: string;
  duration: number;
  testErrors: string[];
  consoleErrors: string[];
  screenshotPath?: string;
}

const RAW_DIR = 'screen-tour-report/raw';
const REPORT_DIR = 'screen-tour-report';

export default class MarkdownReporter implements Reporter {
  private entries: Entry[] = [];
  private startTime = Date.now();

  onTestEnd(test: TestCase, result: TestResult) {
    const id = test.title;

    const consoleErrors = result.annotations
      .filter((a) => a.type === 'console-errors')
      .flatMap((a) => (a.description ?? '').split('\n').filter(Boolean));

    const screenshotPath = path.join(RAW_DIR, `${id}.png`);

    this.entries.push({
      id,
      status: result.status,
      duration: result.duration,
      testErrors: result.errors.map((e) => (e.message ?? '').split('\n')[0] ?? '').filter(Boolean),
      consoleErrors,
      screenshotPath: fs.existsSync(screenshotPath) ? screenshotPath : undefined,
    });
  }

  async onEnd() {
    fs.mkdirSync(REPORT_DIR, { recursive: true });

    let gitSha = 'unknown';
    try {
      gitSha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim();
    } catch {
      /* no git */
    }

    const pass = this.entries.filter((e) => e.status === 'passed').length;
    const fail = this.entries.filter((e) => e.status === 'failed').length;
    const skip = this.entries.filter((e) => e.status === 'skipped').length;
    const total = this.entries.length;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const issues = this.entries.filter(
      (e) => e.status !== 'passed' || e.consoleErrors.length > 0,
    );

    const lines: string[] = [
      `# Screen Tour Report`,
      ``,
      `| | |`,
      `|---|---|`,
      `| **Date** | ${now} |`,
      `| **Commit** | \`${gitSha}\` |`,
      `| **Result** | ✅ ${pass} passed · ❌ ${fail} failed · ⏭ ${skip} skipped · ${total} total · ${elapsed}s |`,
      ``,
    ];

    const spEntries = this.entries.filter(
      (e) => e.id.startsWith('sp-') || e.id.startsWith('overlay-'),
    );
    const mpEntries = this.entries.filter((e) => e.id.startsWith('mp-'));
    const otherEntries = this.entries.filter(
      (e) => !e.id.startsWith('sp-') && !e.id.startsWith('mp-') && !e.id.startsWith('overlay-'),
    );

    if (spEntries.length > 0) {
      lines.push(`## Single-Player Screens (${spEntries.length})`, ``);
      lines.push(...this.renderTable(spEntries));
    }
    if (mpEntries.length > 0) {
      lines.push(`## Multiplayer Screens (${mpEntries.length})`, ``);
      lines.push(...this.renderTable(mpEntries));
    }
    if (otherEntries.length > 0) {
      lines.push(`## Other (${otherEntries.length})`, ``);
      lines.push(...this.renderTable(otherEntries));
    }

    if (issues.length > 0) {
      lines.push(`## Issues (${issues.length})`, ``);
      lines.push(
        `> Fix these before next milestone. Console errors = yellow ⚠️; test failures = red ❌.`,
        ``,
      );

      for (const e of issues) {
        const icon = e.status !== 'passed' ? '❌' : '⚠️';
        lines.push(`### ${icon} \`${e.id}\``, ``);

        if (e.testErrors.length > 0) {
          lines.push(`**Failure:**`, '```', ...e.testErrors.slice(0, 5), '```', ``);
        }
        if (e.consoleErrors.length > 0) {
          lines.push(
            `**Console errors (${e.consoleErrors.length}):**`,
            '```',
            ...e.consoleErrors.slice(0, 8),
            '```',
            ``,
          );
        }
        if (e.screenshotPath) {
          const rel = path.relative(REPORT_DIR, e.screenshotPath).replace(/\\/g, '/');
          lines.push(`<img src="${rel}" width="480">`, ``);
        }
      }
    } else {
      lines.push(`## Issues`, ``, `_No issues found — all screens pass with no console errors._ ✅`, ``);
    }

    lines.push(
      `## Reproduction`,
      ``,
      '```bash',
      '# Run all screens (starts dev server automatically):',
      'npm run test:screens',
      '',
      '# Headed mode for debugging:',
      'npm run test:screens:headed',
      '',
      '# SP screens only (faster):',
      'npx playwright test tests/screen-tour/sp.spec.ts',
      '',
      '# Deep-link any screen directly:',
      '# http://localhost:5173/?screen=results&outcome=win&p1=adventurer&p2=knight',
      '```',
      ``,
    );

    const reportPath = path.join(REPORT_DIR, 'REPORT.md');
    fs.writeFileSync(reportPath, lines.join('\n'));
    console.log(`\n  📸 Report: ${path.resolve(reportPath)}`);
    if (issues.length > 0) {
      console.log(`  ⚠️  ${issues.length} issue(s) found — see Issues section in report.`);
    }
  }

  private renderTable(entries: Entry[]): string[] {
    if (entries.length === 0) return ['_(none)_', ``];
    const rows: string[] = [
      `| ID | Status | Screenshot | Notes |`,
      `|----|--------|-----------|-------|`,
    ];
    for (const e of entries) {
      const statusIcon =
        e.status === 'passed' ? '✅' : e.status === 'skipped' ? '⏭' : '❌';
      const warnIcon = e.consoleErrors.length > 0 ? ' ⚠️' : '';
      const thumb = e.screenshotPath
        ? `<img src="raw/${e.id}.png" width="220">`
        : '—';
      const firstError = [...e.testErrors, ...e.consoleErrors][0] ?? '';
      const note = firstError.slice(0, 100).replace(/\|/g, '\\|');
      rows.push(
        `| \`${e.id}\` | ${statusIcon}${warnIcon} | ${thumb} | ${note} |`,
      );
    }
    return [...rows, ``];
  }
}
