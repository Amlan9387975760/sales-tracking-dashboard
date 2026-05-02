const xlsx = require('xlsx');
const path = require('path');

const companies = [
    { id: 'C001', name: 'Alpha Technologies', instance: 'india' },
    { id: 'C002', name: 'Beta Solutions', instance: 'us' },
    { id: 'C003', name: 'Gamma Corp', instance: 'europe' },
    { id: 'C004', name: 'Delta Systems', instance: 'uae' },
    { id: 'C005', name: 'Epsilon Retail', instance: 'india' },
    { id: 'C006', name: 'Zeta Logistics', instance: 'us' },
    { id: 'C007', name: 'Eta Innovations', instance: 'europe' },
    { id: 'C008', name: 'Theta Finance', instance: 'uae' },
    { id: 'C009', name: 'Iota Healthcare', instance: 'india' },
    { id: 'C010', name: 'Kappa Media', instance: 'us' },
    { id: 'C011', name: 'Lambda Retail', instance: 'india' },
    { id: 'C012', name: 'Mu Networks', instance: 'europe' },
    { id: 'C013', name: 'Nu Analytics', instance: 'uae' },
    { id: 'C014', name: 'Xi Platforms', instance: 'us' },
    { id: 'C015', name: 'Omicron Tech', instance: 'india' }
];

const STATUS = {
    ACTIVE: { status: 1, label: 'Active' },
    DEMO: { status: 2, label: 'Demo' },
    EXPIRED: { status: 3, label: 'Demo Expired' }
};

// April 2025 data
const aprilData = [
    { ...companies[0], ...STATUS.ACTIVE, created_at: '2024-01-15' },
    { ...companies[1], ...STATUS.DEMO, created_at: '2025-03-10' },
    { ...companies[2], ...STATUS.ACTIVE, created_at: '2023-11-20' },
    { ...companies[3], ...STATUS.DEMO, created_at: '2025-02-28' },
    { ...companies[4], ...STATUS.EXPIRED, created_at: '2024-08-05' },
    { ...companies[5], ...STATUS.ACTIVE, created_at: '2023-06-12' },
    { ...companies[6], ...STATUS.DEMO, created_at: '2025-03-25' },
    { ...companies[7], ...STATUS.EXPIRED, created_at: '2024-10-18' },
    { ...companies[8], ...STATUS.ACTIVE, created_at: '2024-04-30' },
    { ...companies[9], ...STATUS.DEMO, created_at: '2025-04-01' },
    { ...companies[10], ...STATUS.EXPIRED, created_at: '2024-07-22' },
    { ...companies[11], ...STATUS.ACTIVE, created_at: '2023-09-14' },
    { ...companies[12], ...STATUS.DEMO, created_at: '2025-03-18' },
    { ...companies[13], ...STATUS.ACTIVE, created_at: '2024-02-11' },
    { ...companies[14], ...STATUS.DEMO, created_at: '2025-04-05' }
];

// May 2025 data — some companies changed status to show lifecycle movement
const mayData = [
    { ...companies[0], ...STATUS.ACTIVE, created_at: '2024-01-15' },
    { ...companies[1], ...STATUS.ACTIVE, created_at: '2025-03-10' },   // Demo → Active (converted!)
    { ...companies[2], ...STATUS.ACTIVE, created_at: '2023-11-20' },
    { ...companies[3], ...STATUS.EXPIRED, created_at: '2025-02-28' },  // Demo → Expired (lost lead)
    { ...companies[4], ...STATUS.DEMO, created_at: '2024-08-05' },     // Expired → Demo (re-engaged!)
    { ...companies[5], ...STATUS.ACTIVE, created_at: '2023-06-12' },
    { ...companies[6], ...STATUS.ACTIVE, created_at: '2025-03-25' },   // Demo → Active (converted!)
    { ...companies[7], ...STATUS.EXPIRED, created_at: '2024-10-18' },
    { ...companies[8], ...STATUS.ACTIVE, created_at: '2024-04-30' },
    { ...companies[9], ...STATUS.EXPIRED, created_at: '2025-04-01' },  // Demo → Expired (lost lead)
    { ...companies[10], ...STATUS.EXPIRED, created_at: '2024-07-22' },
    { ...companies[11], ...STATUS.ACTIVE, created_at: '2023-09-14' },
    { ...companies[12], ...STATUS.ACTIVE, created_at: '2025-03-18' },  // Demo → Active (converted!)
    { ...companies[13], ...STATUS.ACTIVE, created_at: '2024-02-11' },
    { ...companies[14], ...STATUS.DEMO, created_at: '2025-04-05' }
];

function toExcelRows(data) {
    return data.map(d => ({
        'Company Id': d.id,
        'Company Name': d.name,
        'Instance': d.instance,
        'Company Status': d.status,
        'status_label': d.label,
        'created_at': d.created_at
    }));
}

function createFile(data, filename) {
    const ws = xlsx.utils.json_to_sheet(toExcelRows(data));
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const filePath = path.join(__dirname, 'reports', filename);
    xlsx.writeFile(wb, filePath);
    console.log(`Created: ${filename}`);
}

createFile(aprilData, 'april_2025.xlsx');
createFile(mayData, 'may_2025.xlsx');
console.log('Sample data files created in /reports folder.');
