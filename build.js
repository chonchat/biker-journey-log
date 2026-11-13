const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'www');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const filesToCopy = ['index.html', 'style.css', 'app.js'];

filesToCopy.forEach((file) => {
  const src = path.join(__dirname, file);
  const dest = path.join(outDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} -> www/${file}`);
  }
});

console.log('Build completed successfully for Capacitor (webDir: www)!');
