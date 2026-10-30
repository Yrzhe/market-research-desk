// A local monitor may emit the same shape as an HTTP JSON response.
// Set kind="command", command="example.mjs" in a private config to try it.
process.stdout.write(JSON.stringify({
  observed_at: new Date().toISOString(),
  example_index: 100
}));
