const express = require('express');
const path = require('path');
const app = express();
const port = 3000;

// Serve static files (CSS, Images) from the current folder
app.use(express.static(__dirname));

// Send the HTML file when the user goes to the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Website is running at http://localhost:${port}`);
});