const xlsx = require('xlsx');

function parseDate(val) {
    if (!val) return null;
    // Excel serial number (e.g. 46128.00011574074)
    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return date.toISOString().slice(0, 19).replace('T', ' ');
        }
        return null;
    }
    // String date (e.g. "4/16/2026" or "2026-04-16")
    if (typeof val === 'string') {
        const d = new Date(val);
        if (!isNaN(d.getTime())) {
            return d.toISOString().slice(0, 19).replace('T', ' ');
        }
    }
    return null;
}

function parseExcelFile(filePath) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    return rows.map(row => ({
        company_id: String(row['Company Id'] || row['company_id'] || '').trim(),
        company_name: String(row['Company Name'] || row['company_name'] || '').trim(),
        instance: String(row['Instance'] || row['instance'] || '').trim().toLowerCase(),
        company_status: parseInt(row['Company Status'] || row['company_status'] || 0),
        status_label: String(row['status_label'] || '').trim(),
        created_at: parseDate(row['created_at'] || row['Created At'] || null)
    })).filter(r => r.company_id && r.company_name);
}

module.exports = { parseExcelFile };
