const express = require('express');
const router = express.Router();
const { getFiscalYears, getMonthsForFY, getKPIs, getLifecycleChanges, getCompanies, getAttentionRequired, getFYSummary } = require('../services/lifecycleEngine');

router.get('/fiscal-years', async (req, res) => {
    try {
        const fys = await getFiscalYears();
        res.json(fys);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/months-for-fy', async (req, res) => {
    try {
        const months = await getMonthsForFY(req.query.fy);
        res.json(months);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/kpis', async (req, res) => {
    try {
        const kpis = await getKPIs(req.query.month, parseInt(req.query.year));
        res.json(kpis);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/lifecycle', async (req, res) => {
    try {
        const { currentMonth, currentYear, prevMonth, prevYear } = req.query;
        const changes = await getLifecycleChanges(currentMonth, parseInt(currentYear), prevMonth, parseInt(prevYear));
        res.json(changes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/companies', async (req, res) => {
    try {
        const { month, year, status, instance } = req.query;
        const filters = {};
        if (status) filters.status = parseInt(status);
        if (instance) filters.instance = instance;
        const companies = await getCompanies(month, parseInt(year), filters);
        res.json(companies);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/attention', async (req, res) => {
    try {
        const companies = await getAttentionRequired(req.query.month, parseInt(req.query.year));
        res.json(companies);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/fy-summary', async (req, res) => {
    try {
        const summary = await getFYSummary(req.query.fy);
        res.json(summary);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/companies/:company_id/notes', async (req, res) => {
    try {
        const pool = require('../db');
        const { notes } = req.body;
        const [result] = await pool.query('UPDATE companies SET notes = ? WHERE company_id = ?', [notes || null, req.params.company_id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: `Company ${req.params.company_id} not found` });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
