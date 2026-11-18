// npm run demo:files
// Generates the two copy-paste versions of the live demo from demo/requests.mjs:
//   demo/kibana-console.txt   paste into Kibana, Dev Tools, Console
//   demo/demo.http            run from VS Code with the "REST Client" extension
import { writeFileSync } from 'node:fs';
import { steps } from '../demo/requests.mjs';

const all = steps('courses');
// Pretty JSON, but short arrays of plain values stay on one line: ["code", "title"]
const pretty = (value) =>
  JSON.stringify(value, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner) => `[${inner.replace(/\s*\n\s*/g, ' ')}]`);
const consolePath = (path) => (path === '/' ? '/' : path.replace(/^\//, ''));

let lastPart = '';
let kibana = '# Live demo: Kibana Dev Tools console\n# Generated from demo/requests.mjs. Run "npm run demo:files" after changing it.\n# Select one request and press Ctrl+Enter (Cmd+Enter on macOS).\n';
let http = '# Live demo: VS Code REST Client\n# Generated from demo/requests.mjs. Run "npm run demo:files" after changing it.\n# Install the "REST Client" extension, then click "Send Request" above a request.\n\n@host = http://localhost:9200\n';

for (const step of all) {
  if (step.part !== lastPart) {
    kibana += `\n\n#### ${step.part.toUpperCase()} ####\n`;
    http += `\n\n### ===== ${step.part.toUpperCase()} =====\n`;
    lastPart = step.part;
  }
  kibana += `\n# ${step.title}\n# ${step.note}\n${step.method} ${consolePath(step.path)}\n`;
  if (step.body) kibana += `${pretty(step.body)}\n`;

  http += `\n### ${step.title}\n# ${step.note}\n${step.method} {{host}}${step.path}\n`;
  if (step.body) http += `Content-Type: application/json\n\n${pretty(step.body)}\n`;
}

writeFileSync(new URL('../demo/kibana-console.txt', import.meta.url), kibana);
writeFileSync(new URL('../demo/demo.http', import.meta.url), http);
console.log(`Wrote demo/kibana-console.txt and demo/demo.http (${all.length} requests).`);
