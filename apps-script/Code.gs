// ═══════════════════════════════════════════════════════════════════════════
//  Sales Intelligence Dashboard — Google Apps Script Backend
//
//  SETUP (one time):
//  1. Create a new Google Sheet and copy its ID from the URL
//  2. Paste the Spreadsheet ID into SPREADSHEET_ID below
//  3. Set SECRET_KEY (used to authorise notes saves from the frontend)
//  4. Set ERASE_PASSWORD (used to authorise imports and month erases)
//  5. Run setupSheets() once from the editor to create the sheet structure
//  6. Deploy → New deployment → Web app
//       Execute as: Me
//       Who has access: Anyone
//  7. Copy the deployment URL into SCRIPT_URL in index.astro
// ═══════════════════════════════════════════════════════════════════════════

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';   // ← paste after creating sheet
const SECRET_KEY     = 'YOUR_SECRET_KEY';         // ← must match index.astro SECRET_KEY
const ERASE_PASSWORD = 'YOUR_ERASE_PASSWORD';     // ← used for upload and erase

const S_COMPANIES = 'Companies';
const S_SNAPSHOTS = 'Snapshots';
const S_IMPORTLOG = 'ImportLog';

const FY_ORDER = [
  'April','May','June','July','August','September',
  'October','November','December','January','February','March'
];

// ── HTTP entry points ────────────────────────────────────────────────────────

function doGet(e) {
  const p = e.parameter || {};
  try {
    let result;
    switch (p.action) {
      case 'getFiscalYears': result = getFiscalYears();                                                                       break;
      case 'getMonthsForFY': result = getMonthsForFY(p.fy);                                                                   break;
      case 'getKPIs':        result = getKPIs(p.month, +p.year);                                                              break;
      case 'getLifecycle':   result = getLifecycleChanges(p.currentMonth, +p.currentYear, p.prevMonth, +p.prevYear);          break;
      case 'getCompanies':   result = getCompanies(p.month, +p.year, p.status || '', p.instance || '');                       break;
      case 'getAttention':   result = getAttentionRequired(p.month, +p.year);                                                 break;
      case 'getFYSummary':   result = getFYSummary(p.fy);                                                                     break;
      case 'getImportLogs':  result = getImportLogs();                                                                        break;
      default:               result = { error: 'Unknown action: ' + p.action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    let result;
    switch (body.action) {
      case 'updateNotes':
        if (body.key !== SECRET_KEY) return jsonOut({ error: 'Unauthorized' });
        result = updateNotes(body.company_id, body.notes || '');
        break;
      case 'importData':
        if (body.password !== ERASE_PASSWORD) return jsonOut({ error: 'Incorrect password' });
        result = importData(body.month, +body.year, body.records);
        break;
      case 'eraseMonth':
        if (body.password !== ERASE_PASSWORD) return jsonOut({ error: 'Incorrect password' });
        result = eraseMonth(body.month, +body.year);
        break;
      default:
        result = { error: 'Unknown action: ' + body.action };
    }
    return jsonOut(result);
  } catch (err) {
    return jsonOut({ error: err.message });
  }
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet helpers ─────────────────────────────────────────────────────────────

function ss() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function getSheet(name) { return ss().getSheetByName(name); }

function getRows(sheetName) {
  const data = getSheet(sheetName).getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function serializeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().slice(0, 19).replace('T', ' ');
  return String(val) || null;
}

// ── Read operations ───────────────────────────────────────────────────────────

function getFiscalYears() {
  const rows = getRows(S_SNAPSHOTS);
  const fys  = [...new Set(rows.map(r => r.fiscal_year))].filter(Boolean);
  fys.sort();
  return fys;
}

function getMonthsForFY(fy) {
  const rows = getRows(S_SNAPSHOTS).filter(r => r.fiscal_year === fy);
  const seen = new Set();
  const result = [];
  rows.forEach(r => {
    const key = r.month + '|' + r.year;
    if (!seen.has(key)) { seen.add(key); result.push({ month: r.month, year: +r.year }); }
  });
  result.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return FY_ORDER.indexOf(a.month) - FY_ORDER.indexOf(b.month);
  });
  return result;
}

function getKPIs(month, year) {
  const rows = getRows(S_SNAPSHOTS).filter(r => r.month === month && +r.year === year);
  const kpis = { active: 0, demo: 0, demo_expired: 0, total: 0 };
  rows.forEach(r => {
    const s = +r.company_status;
    if (s === 1) kpis.active++;
    if (s === 2) kpis.demo++;
    if (s === 3) kpis.demo_expired++;
    kpis.total++;
  });
  return kpis;
}

function getLifecycleChanges(currentMonth, currentYear, prevMonth, prevYear) {
  const snaps    = getRows(S_SNAPSHOTS);
  const current  = snaps.filter(r => r.month === currentMonth && +r.year === currentYear);
  const previous = snaps.filter(r => r.month === prevMonth    && +r.year === prevYear);

  const prevMap = {};
  previous.forEach(r => { prevMap[String(r.company_id)] = r; });

  const changes = [];
  current.forEach(curr => {
    const prev = prevMap[String(curr.company_id)];
    if (prev && +prev.company_status !== +curr.company_status) {
      changes.push({
        company_id:  curr.company_id,
        from_status: +prev.company_status,
        from_label:  prev.status_label,
        to_status:   +curr.company_status,
        to_label:    curr.status_label
      });
    }
  });
  return changes;
}

function getCompanies(month, year, status, instance) {
  const snaps    = getRows(S_SNAPSHOTS).filter(r => r.month === month && +r.year === year);
  const compMap  = {};
  getRows(S_COMPANIES).forEach(c => { compMap[String(c.company_id)] = c; });

  const result = [];
  for (const s of snaps) {
    const c    = compMap[String(s.company_id)] || {};
    const inst = (c.instance || '').toLowerCase();
    if (status   && +s.company_status !== +status)         continue;
    if (instance && inst !== instance.toLowerCase())        continue;
    result.push({
      company_id:     s.company_id,
      company_name:   c.company_name  || String(s.company_id),
      instance:       c.instance      || '',
      created_at:     serializeDate(c.created_at),
      notes:          c.notes         || '',
      company_status: +s.company_status,
      status_label:   s.status_label
    });
  }
  return result.sort((a, b) => String(a.company_name).localeCompare(String(b.company_name)));
}

function getAttentionRequired(month, year) {
  return getCompanies(month, year, '3', '').map(c => ({
    company_id:   c.company_id,
    company_name: c.company_name,
    instance:     c.instance
  }));
}

function getFYSummary(fy) {
  const months = getMonthsForFY(fy);
  if (!months.length) return null;
  const last = months[months.length - 1];
  const kpis = getKPIs(last.month, last.year);

  let totalConverted = 0, totalExpired = 0, totalReengaged = 0;
  for (let i = 1; i < months.length; i++) {
    const changes = getLifecycleChanges(months[i].month, months[i].year, months[i-1].month, months[i-1].year);
    changes.forEach(c => {
      if (c.from_status === 2 && c.to_status === 1) totalConverted++;
      if (c.to_status === 3) totalExpired++;
      if (c.from_status === 3 && c.to_status === 2) totalReengaged++;
    });
  }
  return { ...kpis, totalConverted, totalExpired, totalReengaged, monthsTracked: months.length };
}

function getImportLogs() {
  return getRows(S_IMPORTLOG)
    .map(r => ({ ...r, imported_at: serializeDate(r.imported_at) }))
    .sort((a, b) => (+b.year - +a.year));
}

// ── Write operations ──────────────────────────────────────────────────────────

function updateNotes(companyId, notes) {
  const sheet   = getSheet(S_COMPANIES);
  const data    = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol   = headers.indexOf('company_id');
  const nCol    = headers.indexOf('notes');
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(companyId)) {
      sheet.getRange(i + 1, nCol + 1).setValue(notes);
      return { success: true };
    }
  }
  return { error: 'Company not found: ' + companyId };
}

function importData(month, year, records) {
  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const STATUS_LABELS = { 1: 'Active', 2: 'Demo', 3: 'Demo Expired' };

  const mi = MONTHS.indexOf(month);
  const fiscalYear = mi >= 3 ? `${year}-${year+1}` : `${year-1}-${year}`;

  // ── Upsert Companies ─────────────────────────────────────────────
  const compSheet = getSheet(S_COMPANIES);
  const compData  = compSheet.getDataRange().getValues();
  const compHdr   = compData[0];
  const cIdCol    = compHdr.indexOf('company_id');
  const cNameCol  = compHdr.indexOf('company_name');
  const cInstCol  = compHdr.indexOf('instance');
  const cCatCol   = compHdr.indexOf('created_at');

  const existingMap = {};
  for (let i = 1; i < compData.length; i++) {
    existingMap[String(compData[i][cIdCol])] = i + 1;
  }

  const instanceErrors = [];
  const newCompRows    = [];

  for (const r of records) {
    const id         = String(r.company_id).trim();
    if (!id) continue;
    const fileInst   = (r.instance || '').trim().toLowerCase();
    const rowNum     = existingMap[id];

    if (rowNum) {
      const storedInst = String(compData[rowNum - 1][cInstCol] || '').toLowerCase();
      if (storedInst && fileInst && storedInst !== fileInst) {
        instanceErrors.push({ company_id: id, company_name: r.company_name, file_instance: r.instance, db_instance: storedInst });
      }
      compSheet.getRange(rowNum, cNameCol + 1).setValue(r.company_name);
    } else {
      newCompRows.push([id, r.company_name, fileInst, r.created_at || '', '']);
      existingMap[id] = compData.length + newCompRows.length;
    }
  }

  if (newCompRows.length) {
    compSheet.getRange(compData.length + 1, 1, newCompRows.length, 5).setValues(newCompRows);
  }

  // ── Upsert Snapshots ─────────────────────────────────────────────
  const snapSheet = getSheet(S_SNAPSHOTS);
  const snapData  = snapSheet.getDataRange().getValues();
  const snapHdr   = snapData[0];
  const sIdCol    = snapHdr.indexOf('company_id');
  const sMonCol   = snapHdr.indexOf('month');
  const sYrCol    = snapHdr.indexOf('year');
  const sFyCol    = snapHdr.indexOf('fiscal_year');
  const sStCol    = snapHdr.indexOf('company_status');
  const sSlCol    = snapHdr.indexOf('status_label');

  const snapMap = {};
  for (let i = 1; i < snapData.length; i++) {
    const key = `${snapData[i][sIdCol]}|${snapData[i][sMonCol]}|${snapData[i][sYrCol]}`;
    snapMap[key] = i + 1;
  }

  const newSnapRows = [];
  for (const r of records) {
    const id     = String(r.company_id).trim();
    const status = +r.company_status;
    const label  = STATUS_LABELS[status] || r.status_label || 'Unknown';
    const key    = `${id}|${month}|${year}`;
    const rowNum = snapMap[key];

    if (rowNum) {
      snapSheet.getRange(rowNum, sFyCol + 1).setValue(fiscalYear);
      snapSheet.getRange(rowNum, sStCol + 1).setValue(status);
      snapSheet.getRange(rowNum, sSlCol + 1).setValue(label);
    } else {
      newSnapRows.push([id, month, year, fiscalYear, status, label]);
    }
  }

  if (newSnapRows.length) {
    snapSheet.getRange(snapData.length + 1, 1, newSnapRows.length, 6).setValues(newSnapRows);
  }

  // ── Upsert ImportLog ─────────────────────────────────────────────
  const logSheet = getSheet(S_IMPORTLOG);
  const logData  = logSheet.getDataRange().getValues();
  const logHdr   = logData[0];
  const lmCol    = logHdr.indexOf('month');
  const lyCol    = logHdr.indexOf('year');
  const ltCol    = logHdr.indexOf('total_records');
  const liCol    = logHdr.indexOf('imported_at');
  const now      = new Date().toISOString();

  let logFound = false;
  for (let i = 1; i < logData.length; i++) {
    if (logData[i][lmCol] === month && +logData[i][lyCol] === year) {
      logSheet.getRange(i + 1, ltCol + 1).setValue(records.length);
      logSheet.getRange(i + 1, liCol + 1).setValue(now);
      logFound = true;
      break;
    }
  }
  if (!logFound) logSheet.appendRow([month, year, records.length, now]);

  return { success: true, month, year, fiscalYear, total: records.length, instanceErrors };
}

function eraseMonth(month, year) {
  let deleted = 0;

  const snapSheet = getSheet(S_SNAPSHOTS);
  const snapData  = snapSheet.getDataRange().getValues();
  const snapHdr   = snapData[0];
  const smCol     = snapHdr.indexOf('month');
  const syCol     = snapHdr.indexOf('year');
  const toDelete  = [];
  for (let i = 1; i < snapData.length; i++) {
    if (snapData[i][smCol] === month && +snapData[i][syCol] === year) toDelete.push(i + 1);
  }
  for (let i = toDelete.length - 1; i >= 0; i--) {
    snapSheet.deleteRow(toDelete[i]);
    deleted++;
  }

  const logSheet = getSheet(S_IMPORTLOG);
  const logData  = logSheet.getDataRange().getValues();
  const logHdr   = logData[0];
  const lmCol    = logHdr.indexOf('month');
  const lyCol    = logHdr.indexOf('year');
  for (let i = logData.length - 1; i >= 1; i--) {
    if (logData[i][lmCol] === month && +logData[i][lyCol] === year) logSheet.deleteRow(i + 1);
  }

  return { success: true, deleted, month, year };
}

// ── One-time setup — run this manually from the Apps Script editor ─────────────

function setupSheets() {
  const spreadsheet = ss();
  function ensure(name, headers) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  }
  ensure(S_COMPANIES, ['company_id', 'company_name', 'instance', 'created_at', 'notes']);
  ensure(S_SNAPSHOTS, ['company_id', 'month', 'year', 'fiscal_year', 'company_status', 'status_label']);
  ensure(S_IMPORTLOG, ['month', 'year', 'total_records', 'imported_at']);
  Logger.log('Sheets created successfully.');
}
