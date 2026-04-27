const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const FILE = path.join(__dirname, 'masterpiece.html');

const server = http.createServer((req, res) => {
  fs.readFile(FILE, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading file');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✨ Masterpiece served at http://0.0.0.0:${PORT}`);
});
