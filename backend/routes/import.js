const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { importUploadedFile } = require('../services/importService');

const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

router.post('/upload', upload.single('report'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        const { month, year, password } = req.body;
        if (!password || password !== process.env.ERASE_PASSWORD) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(401).json({ error: 'Incorrect password' });
        }
        const result = await importUploadedFile(req.file.path, month || null, year || null);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json(result);
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: err.message });
    }
});

router.get('/logs', async (req, res) => {
    try {
        const pool = require('../db');
        const [rows] = await pool.query('SELECT * FROM import_log ORDER BY year DESC, imported_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/erase', async (req, res) => {
    try {
        const { month, year, password } = req.body;
        if (!password || password !== process.env.ERASE_PASSWORD) {
            return res.status(401).json({ error: 'Incorrect password' });
        }
        if (!month || !year) return res.status(400).json({ error: 'Month and year required' });

        const pool = require('../db');
        const [snap] = await pool.query(
            'DELETE FROM monthly_snapshots WHERE month = ? AND year = ?', [month, year]
        );
        await pool.query(
            'DELETE FROM import_log WHERE month = ? AND year = ?', [month, year]
        );
        res.json({ success: true, deleted: snap.affectedRows, month, year });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
