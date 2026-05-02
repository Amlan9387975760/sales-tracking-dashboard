const API = 'http://localhost:3000/api';
let allCompanies = [];
let statusChart = null;
let availableMonths = [];

async function init() {
    await loadMonths();
    document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleString();
}

async function loadMonths() {
    try {
        const res = await fetch(`${API}/dashboard/months`);
        availableMonths = await res.json();

        const select = document.getElementById('month-select');
        select.innerHTML = '';

        if (availableMonths.length === 0) {
            select.innerHTML = '<option value="">No data — click Import Reports</option>';
            return;
        }

        availableMonths.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = JSON.stringify(m);
            opt.textContent = `${m.month} ${m.year}`;
            if (i === availableMonths.length - 1) opt.selected = true;
            select.appendChild(opt);
        });

        await loadDashboard();
    } catch (err) {
        console.error('Failed to load months:', err);
    }
}

async function loadDashboard() {
    const select = document.getElementById('month-select');
    if (!select.value) return;

    const current = JSON.parse(select.value);
    const { month, year } = current;

    await Promise.all([
        loadKPIs(month, year),
        loadCompanies(month, year),
        loadAttention(month, year),
        loadLifecycle(month, year)
    ]);
}

async function loadKPIs(month, year) {
    try {
        const res = await fetch(`${API}/dashboard/kpis?month=${month}&year=${year}`);
        const kpis = await res.json();
        document.getElementById('kpi-active').textContent = kpis.active;
        document.getElementById('kpi-demo').textContent = kpis.demo;
        document.getElementById('kpi-expired').textContent = kpis.demo_expired;
        document.getElementById('kpi-total').textContent = kpis.total;
        renderChart(kpis);
    } catch (err) { console.error(err); }
}

function renderChart(kpis) {
    const ctx = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Demo', 'Demo Expired'],
            datasets: [{
                data: [kpis.active, kpis.demo, kpis.demo_expired],
                backgroundColor: ['#28a745', '#4f8ef7', '#dc3545'],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, font: { size: 13 } } }
            }
        }
    });
}

async function loadLifecycle(currentMonth, currentYear) {
    const idx = availableMonths.findIndex(m => m.month === currentMonth && m.year === currentYear);
    const container = document.getElementById('lifecycle-list');

    if (idx <= 0) {
        container.innerHTML = '<p class="empty-msg">No previous month to compare</p>';
        return;
    }

    const prev = availableMonths[idx - 1];
    try {
        const res = await fetch(`${API}/dashboard/lifecycle?currentMonth=${currentMonth}&currentYear=${currentYear}&prevMonth=${prev.month}&prevYear=${prev.year}`);
        const changes = await res.json();

        if (changes.length === 0) {
            container.innerHTML = '<p class="empty-msg">No status changes from previous month</p>';
            return;
        }

        container.innerHTML = changes.map(c => `
            <div class="lifecycle-item">
                <span class="company">${c.company_id}</span>
                <div class="lifecycle-arrow">
                    <span class="badge ${getBadgeClass(c.from_status)}">${c.from_label}</span>
                    <span class="arrow">→</span>
                    <span class="badge ${getBadgeClass(c.to_status)}">${c.to_label}</span>
                </div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

function getBadgeClass(status) {
    if (status === 1) return 'badge-active';
    if (status === 2) return 'badge-demo';
    return 'badge-expired';
}

async function loadCompanies(month, year) {
    try {
        const res = await fetch(`${API}/dashboard/companies?month=${month}&year=${year}`);
        allCompanies = await res.json();
        renderTable(allCompanies);
    } catch (err) { console.error(err); }
}

function renderTable(companies) {
    const tbody = document.getElementById('companies-tbody');
    if (companies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:24px">No companies found</td></tr>';
        return;
    }
    tbody.innerHTML = companies.map(c => `
        <tr>
            <td>${c.company_id}</td>
            <td>${c.company_name}</td>
            <td><span class="region-tag">${c.instance || '—'}</span></td>
            <td><span class="status-pill status-${c.company_status}">${c.status_label}</span></td>
            <td>${c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
        </tr>
    `).join('');
}

function filterCompanies() {
    const status = document.getElementById('filter-status').value;
    const instance = document.getElementById('filter-instance').value;
    const search = document.getElementById('search-input').value.toLowerCase();

    const filtered = allCompanies.filter(c => {
        const matchStatus = !status || String(c.company_status) === status;
        const matchInstance = !instance || c.instance === instance;
        const matchSearch = !search || c.company_name.toLowerCase().includes(search) || c.company_id.toLowerCase().includes(search);
        return matchStatus && matchInstance && matchSearch;
    });
    renderTable(filtered);
}

async function loadAttention(month, year) {
    try {
        const res = await fetch(`${API}/dashboard/attention?month=${month}&year=${year}`);
        const companies = await res.json();
        const container = document.getElementById('attention-list');

        if (companies.length === 0) {
            container.innerHTML = '<p class="empty-msg" style="color:#888">No companies require attention this month</p>';
            return;
        }

        container.innerHTML = companies.map(c => `
            <div class="attention-item">
                <div class="co-name">${c.company_name}</div>
                <div class="co-region">📍 ${c.instance ? c.instance.toUpperCase() : '—'}</div>
                <div class="co-id">${c.company_id}</div>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

async function runImport() {
    const statusEl = document.getElementById('import-status');
    statusEl.className = 'import-status loading';
    statusEl.textContent = 'Scanning reports folder and importing...';
    statusEl.classList.remove('hidden');

    try {
        const res = await fetch(`${API}/import/scan`, { method: 'POST' });
        const data = await res.json();

        const imported = data.results.filter(r => r.success);
        const skipped = data.results.filter(r => r.skipped);

        statusEl.className = 'import-status success';
        statusEl.textContent = `Import complete — ${imported.length} file(s) imported, ${skipped.length} already up to date.`;

        await loadMonths();
    } catch (err) {
        statusEl.className = 'import-status error';
        statusEl.textContent = 'Import failed: ' + err.message;
    }

    setTimeout(() => statusEl.classList.add('hidden'), 5000);
}

init();
