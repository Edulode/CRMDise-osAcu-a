const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const forbidden = /http:\/\/localhost:4000\/api/g;
const filesToScan = [
  'landing',
  'panelAdmin',
  'src/js',
  'test-checkout.html',
];

function walk(currentPath) {
  const stats = fs.statSync(currentPath);
  if (stats.isDirectory()) {
    return fs.readdirSync(currentPath).flatMap((entry) => walk(path.join(currentPath, entry)));
  }

  return [currentPath];
}

const targets = filesToScan.flatMap((entry) => walk(path.join(root, entry))).filter((filePath) => {
  return /\.(html|js)$/i.test(filePath);
});

const failures = [];

for (const filePath of targets) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (forbidden.test(content)) {
    failures.push(path.relative(root, filePath));
  }
}

if (failures.length > 0) {
  console.error('Hardcoded API URL found in:');
  for (const file of failures) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('Frontend API base validation passed');