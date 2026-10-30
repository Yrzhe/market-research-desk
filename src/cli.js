import { collect, readConfig, retryNotifications } from './core.js';

if (!['run', 'retry'].includes(process.argv[2])) {
  process.stderr.write('Usage: node src/cli.js run|retry\n');
  process.exit(2);
}

try {
  if (process.argv[2] === 'retry') {
    const outcomes = await retryNotifications();
    process.stdout.write(JSON.stringify({ attemptedRuns: outcomes.length, outcomes }) + '\n');
  } else {
    const config = await readConfig();
    const result = await collect(undefined, config);
    process.stdout.write(JSON.stringify({ runId: result.runId, observationCount: result.observations.length,
      alertCount: result.alerts.length, sources: result.sources.map(s => ({ id: s.id, status: s.status })) }) + '\n');
  }
} catch (error) {
  process.stderr.write(`Monitor failed: ${error.message}\n`);
  process.exit(1);
}
