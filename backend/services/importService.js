const path = require('path');
const pool = require('../db');
const { parseExcelFile } = require('./excelParser');

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

const STATUS_LABELS = { 1: 'Active', 2: 'Demo', 3: 'Demo Expired' };

function getFiscalYear(date = new Date()) {
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function importUploadedFile(filePath, overrideMonth = null, overrideYear = null) {
    const now = new Date();
    const month = overrideMonth && MONTHS.includes(overrideMonth) ? overrideMonth : MONTHS[now.getMonth()];
    const year = overrideYear ? parseInt(overrideYear) : now.getFullYear();
    const fiscalYear = getFiscalYear(new Date(year, MONTHS.indexOf(month), 1));

    const records = parseExcelFile(filePath);

    // Build a map of existing company instances to detect mismatches
    const companyIds = records.map(r => r.company_id).filter(Boolean);
    let existingInstanceMap = {};
    if (companyIds.length > 0) {
        const placeholders = companyIds.map(() => '?').join(',');
        const [rows] = await pool.query(
            `SELECT company_id, instance FROM companies WHERE company_id IN (${placeholders})`,
            companyIds
        );
        rows.forEach(row => { existingInstanceMap[row.company_id] = (row.instance || '').toLowerCase(); });
    }

    const instanceErrors = [];

    for (const r of records) {
        const statusLabel = STATUS_LABELS[r.company_status] || 'Unknown';
        const fileInstance  = (r.instance || '').toLowerCase();
        const storedInstance = existingInstanceMap[r.company_id];

        // Flag mismatch: company exists + both have values + they differ
        if (storedInstance !== undefined && storedInstance && fileInstance && storedInstance !== fileInstance) {
            instanceErrors.push({
                company_id:    r.company_id,
                company_name:  r.company_name,
                file_instance: r.instance,
                db_instance:   storedInstance
            });
        }

        // Never overwrite instance — only update company_name on duplicate
        await pool.query(
            `INSERT INTO companies (company_id, company_name, instance, created_at)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE company_name = VALUES(company_name)`,
            [r.company_id, r.company_name, r.instance, r.created_at]
        );

        await pool.query(
            `INSERT INTO monthly_snapshots (company_id, month, year, fiscal_year, company_status, status_label)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE company_status = VALUES(company_status), status_label = VALUES(status_label), fiscal_year = VALUES(fiscal_year)`,
            [r.company_id, month, year, fiscalYear, r.company_status, statusLabel]
        );
    }

    await pool.query(
        `INSERT INTO import_log (month, year, total_records)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE total_records = VALUES(total_records), imported_at = CURRENT_TIMESTAMP`,
        [month, year, records.length]
    );

    return { success: true, month, year, fiscalYear, total: records.length, instanceErrors };
}

module.exports = { importUploadedFile };
