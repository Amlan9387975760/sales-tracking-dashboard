const cron = require('node-cron');
const path = require('path');
const { scanAndImport } = require('../services/importService');
require('dotenv').config();

function startScheduler() {
    // Runs on the 5th of every month at 10:00 AM
    cron.schedule('0 10 5 * *', async () => {
        console.log(`[Scheduler] Running monthly import - ${new Date().toISOString()}`);
        try {
            const reportsFolder = path.resolve(process.env.REPORTS_FOLDER || './reports');
            const results = await scanAndImport(reportsFolder);
            console.log('[Scheduler] Import complete:', results);
        } catch (err) {
            console.error('[Scheduler] Import failed:', err.message);
        }
    });

    console.log('[Scheduler] Started — will run on the 5th of every month at 10:00 AM');
}

module.exports = { startScheduler };
