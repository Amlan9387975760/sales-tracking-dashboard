const pool = require('../db');

const FY_MONTH_ORDER = ['April','May','June','July','August','September',
                        'October','November','December','January','February','March'];

async function getFiscalYears() {
    const [rows] = await pool.query(
        'SELECT DISTINCT fiscal_year FROM monthly_snapshots ORDER BY fiscal_year ASC'
    );
    return rows.map(r => r.fiscal_year);
}

async function getMonthsForFY(fiscalYear) {
    const [rows] = await pool.query(
        `SELECT DISTINCT month, year FROM monthly_snapshots WHERE fiscal_year = ?`,
        [fiscalYear]
    );
    rows.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return FY_MONTH_ORDER.indexOf(a.month) - FY_MONTH_ORDER.indexOf(b.month);
    });
    return rows;
}

async function getKPIs(month, year) {
    const [rows] = await pool.query(
        `SELECT company_status, COUNT(*) as count
         FROM monthly_snapshots WHERE month = ? AND year = ?
         GROUP BY company_status`,
        [month, year]
    );
    const kpis = { active: 0, demo: 0, demo_expired: 0, total: 0 };
    rows.forEach(r => {
        if (r.company_status === 1) kpis.active = r.count;
        if (r.company_status === 2) kpis.demo = r.count;
        if (r.company_status === 3) kpis.demo_expired = r.count;
        kpis.total += r.count;
    });
    return kpis;
}

async function getLifecycleChanges(currentMonth, currentYear, prevMonth, prevYear) {
    const [current] = await pool.query(
        'SELECT company_id, company_status, status_label FROM monthly_snapshots WHERE month = ? AND year = ?',
        [currentMonth, currentYear]
    );
    const [previous] = await pool.query(
        'SELECT company_id, company_status, status_label FROM monthly_snapshots WHERE month = ? AND year = ?',
        [prevMonth, prevYear]
    );

    const prevMap = {};
    previous.forEach(r => { prevMap[r.company_id] = r; });

    const changes = [];
    current.forEach(curr => {
        const prev = prevMap[curr.company_id];
        if (prev && prev.company_status !== curr.company_status) {
            changes.push({
                company_id: curr.company_id,
                from_status: prev.company_status,
                from_label: prev.status_label,
                to_status: curr.company_status,
                to_label: curr.status_label
            });
        }
    });
    return changes;
}

async function getCompanies(month, year, filters = {}) {
    let query = `
        SELECT c.company_id, c.company_name, c.instance, c.created_at, c.notes,
               ms.company_status, ms.status_label
        FROM companies c
        JOIN monthly_snapshots ms ON c.company_id = ms.company_id
        WHERE ms.month = ? AND ms.year = ?
    `;
    const params = [month, year];

    if (filters.status) { query += ' AND ms.company_status = ?'; params.push(filters.status); }
    if (filters.instance) { query += ' AND LOWER(c.instance) = ?'; params.push(filters.instance.toLowerCase()); }

    query += ' ORDER BY c.company_name ASC';
    const [rows] = await pool.query(query, params);
    return rows;
}

async function getAttentionRequired(month, year) {
    const [rows] = await pool.query(
        `SELECT c.company_id, c.company_name, c.instance
         FROM companies c
         JOIN monthly_snapshots ms ON c.company_id = ms.company_id
         WHERE ms.month = ? AND ms.year = ? AND ms.company_status = 3
         ORDER BY c.company_name`,
        [month, year]
    );
    return rows;
}

async function getFYSummary(fiscalYear) {
    const months = await getMonthsForFY(fiscalYear);
    if (months.length === 0) return null;

    const lastMonth = months[months.length - 1];
    const kpis = await getKPIs(lastMonth.month, lastMonth.year);

    let totalConverted = 0, totalExpired = 0, totalReengaged = 0;

    for (let i = 1; i < months.length; i++) {
        const curr = months[i];
        const prev = months[i - 1];
        const changes = await getLifecycleChanges(curr.month, curr.year, prev.month, prev.year);
        changes.forEach(c => {
            if (c.from_status === 2 && c.to_status === 1) totalConverted++;
            if (c.to_status === 3) totalExpired++;
            if (c.from_status === 3 && c.to_status === 2) totalReengaged++;
        });
    }

    return { ...kpis, totalConverted, totalExpired, totalReengaged, monthsTracked: months.length };
}

module.exports = { getFiscalYears, getMonthsForFY, getKPIs, getLifecycleChanges, getCompanies, getAttentionRequired, getFYSummary };
