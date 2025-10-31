import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----- elements -----
const tabs = document.querySelectorAll('.tab');
const sections = [
  '#dashboardView',
  '#recordsView',
  '#reportsView',
  '#settingsView',
  '#helpView'
].map(sel => document.querySelector(sel));

const viewTitle = document.getElementById('viewTitle');
const statusText = document.getElementById('statusText');

// dashboard
const recentTbody   = document.querySelector('#recentTable tbody');
const dashSearch    = document.getElementById('dashSearch');
const dashSearchBtn = document.getElementById('dashSearchBtn');

// records
const recordsTbody = document.querySelector('#recordsTable tbody');
const txTbody      = document.querySelector('#txTable tbody');
const searchText   = document.getElementById('searchText');
const deptFilter   = document.getElementById('deptFilter');
const searchBtn    = document.getElementById('searchBtn');

// ----- view switching (robust) -----
function showOnly(targetSelector){
  sections.forEach(sec => sec.style.display = (('#'+sec.id) === targetSelector) ? 'block' : 'none');
}

tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');

    const target = btn.getAttribute('data-target');   // e.g. "#dashboardView"
    showOnly(target);

    // Title = button text
    const label = btn.textContent.trim();
    viewTitle.textContent = label;
  });
});

// ----- helpers -----
function setConnected(ok){
  statusText.innerHTML = ok
    ? 'Status: <span class="status-ok">Connected to SGW Records Database (PostgreSQL)</span>'
    : 'Status: Unable to connect to database';
}

function renderRows(tbody, rows, cols){
  tbody.innerHTML = '';
  if (!rows.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${cols}">No results.</td>`;
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(r => tbody.appendChild(r));
}

// ----- dashboard (recent) -----
async function loadRecent(){
  const { data, error } = await supabase
    .from('participants')
    .select('participant_id,name,department,status,updated_at')
    .order('updated_at', { ascending:false })
    .limit(3);

  if (error){
    recentTbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    return;
  }

  const rows = data.map(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.participant_id}</td>
      <td>${p.name}</td>
      <td>${p.department ?? ''}</td>
      <td>${p.status}</td>`;
    return tr;
  });
  renderRows(recentTbody, rows, 4);
}

// ----- records list / transactions -----
async function populateDeptFilter(){
  const { data } = await supabase
    .from('participants')
    .select('department')
    .not('department','is',null);

  const unique = [...new Set((data||[]).map(d => d.department).filter(Boolean))].sort();
  deptFilter.innerHTML = `<option value="">Department</option>` + unique.map(d=>`<option>${d}</option>`).join('');
}

async function loadRecords(){
  const q = searchText.value.trim();
  const dept = deptFilter.value.trim();

  let query = supabase.from('participants')
    .select('participant_id,name,employer,status,department')
    .order('participant_id', { ascending:true });

  if (q)   query = query.or(`name.ilike.%${q}%,employer.ilike.%${q}%`);
  if (dept) query = query.eq('department', dept);

  const { data, error } = await query;
  if (error){
    recordsTbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    return;
  }

  const rows = data.map(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${p.participant_id}</td>
      <td>${p.name}</td>
      <td>${p.employer ?? ''}</td>
      <td>${p.status}</td>
      <td><button class="viewBtn" data-id="${p.participant_id}">[View]</button></td>`;
    return tr;
  });
  renderRows(recordsTbody, rows, 5);

  document.querySelectorAll('.viewBtn').forEach(btn => {
    btn.onclick = () => loadTransactions(btn.dataset.id);
  });
}

async function loadTransactions(participantId){
  const { data, error } = await supabase
    .from('transactions')
    .select('tx_date,tx_type,amount,description')
    .eq('participant_id', participantId)
    .order('tx_date', { ascending:false })
    .limit(3);

  if (error){
    txTbody.innerHTML = `<tr><td colspan="4">${error.message}</td></tr>`;
    return;
  }

  const rows = data.map(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.tx_date}</td>
      <td>${t.tx_type}</td>
      <td>$${Number(t.amount).toFixed(2)}</td>
      <td>${t.description ?? ''}</td>`;
    return tr;
  });
  renderRows(txTbody, rows, 4);
}

// ----- search wiring -----
dashSearchBtn.onclick = async () => {
  // Jump to Manage Records with the query applied
  const manageBtn = document.querySelector('.tab[data-target="#recordsView"]');
  manageBtn.click();
  searchText.value = dashSearch.value;
  await loadRecords();
};
searchBtn.onclick = loadRecords;
deptFilter.onchange = loadRecords;

// ----- init -----
(async function init(){
  // connection probe
  const { error } = await supabase.from('participants').select('participant_id').limit(1);
  setConnected(!error);

  await loadRecent();
  await populateDeptFilter();
  await loadRecords();

  // Start on Dashboard for real
  showOnly('#dashboardView');
  viewTitle.textContent = 'Dashboard';
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-target="#dashboardView"]').classList.add('active');
})();
