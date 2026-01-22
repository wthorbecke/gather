const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, outputPath) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  ctx.fillStyle = '#3D3A37';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#FAF9F7';
  ctx.font = 'bold ' + (size * 0.5) + 'px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', size/2, size/2 + size*0.02);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  console.log('Created ' + outputPath);
}

createIcon(192, './public/icons/icon-192.png');
createIcon(512, './public/icons/icon-512.png');
