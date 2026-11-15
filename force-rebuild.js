const fs = require('fs');
const { execSync } = require('child_process');

const run = (cmd) => {
  console.log('> ' + cmd);
  return execSync(cmd, { stdio: 'inherit' });
};

console.log('🚀 Forcing clean Vercel cache invalidation and production rebuild...');

// 1. Force a timestamp modification on app/page.tsx to guarantee Vercel detects a source change
const target = fs.existsSync('app/page.tsx') ? 'app/page.tsx' : 'src/app/page.tsx';
if (fs.existsSync(target)) {
  let content = fs.readFileSync(target, 'utf8');
  // Append or touch a harmless comment with current time
  content += `\n// Cache-bust timestamp: ${Date.now()}\n`;
  fs.writeFileSync(target, content);
  console.log('Cache-bust applied to:', target);
}

// 2. Run TypeScript and production build check locally
run('npx tsc --noEmit');
run('npm run build');

// 3. Commit with a cache-busting message and push to main
run('git add -A');
run('git commit -m "Chore: Force Vercel cache invalidation and production rebuild for Quant Store" || true');
run('git push origin main');

console.log('✨ SUCCESS! Cache-busting commit pushed to main. Vercel will now perform a fresh un-cached build.');
