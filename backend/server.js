const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/import', require('./routes/import'));

app.use(express.static(path.join(__dirname, '../frontend-astro/dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend-astro/dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sales Dashboard API running at http://localhost:${PORT}`);
});
