const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// API endpoint to get file list
app.get('/api/files', (req, res) => {
  const directoryPath = __dirname;

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to scan directory' });
    }

    const fileItems = [];

    files.forEach(file => {
      const filePath = path.join(directoryPath, file);
      const stats = fs.statSync(filePath);

      fileItems.push({
        name: file,
        path: file,
        isDirectory: stats.isDirectory(),
        size: stats.size,
        modified: stats.mtime
      });
    });

    res.json(fileItems);
  });
});

// API endpoint to get file content
app.get('/api/file', (req, res) => {
  const filePath = path.join(__dirname, req.query.path);

  // Security check: ensure the file is within the current directory
  if (!filePath.startsWith(__dirname)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to read file' });
    }

    res.send(data);
  });
});

// API endpoint to save file content
app.put('/api/file', (req, res) => {
  const filePath = path.join(__dirname, req.query.path);

  // Security check: ensure the file is within the current directory
  if (!filePath.startsWith(__dirname)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  fs.writeFile(filePath, req.body, 'utf8', (err) => {
    if (err) {
      return res.status(500).json({ error: 'Unable to write file' });
    }

    res.send({ success: true });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});