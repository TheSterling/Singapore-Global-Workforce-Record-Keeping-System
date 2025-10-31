import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ----- elements -----
const tabs = document.querySelectorAll('.tab');

// dynamic section collection (any id ending with "View")
function getAllViews(){ return Array.from(document.querySelectorAll('section[id$="View"]')); }
function showOnly(targetSelector){
  const all = getAllViews();
  all.forEach(sec => sec.style.display = 'none');
  const target = document.querySelector(targetSelector);
  if (target) target.style.display = 'block';
}

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

// CRUD buttons + modal
const addBtn      = document.getElementById('addBtn');
const editBtn     = document.getElementById('editBtn');
const archiveBtn  = document.getElementById('archiveBtn');
const deleteBtn   = document.getElementById('deleteBtn');

const recordDialog       = document.getElementById('recordDialog');
const recordForm         = document.getElementById('recordForm');
const recordDialogTitle  = document.getElementById('recordDialogTitle');
const formParticipantId  = document.getElementById('formParticipantId');
const formName           = document.getElementById('formName');
const formEmployer       = document.getElementById('formEmployer');
const formDept           = document.getElementById('formDept');
const formStatus         = document.getElementById('formStatus');
const recordCancelBtn    = document.getElementById('recordCancelBtn');

let selectedId = null;

// ----- nav wiring -----
tabs.forEach(btn => {
  btn.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.getAttribute('data-target');
    showOnly(target);
    viewTitle.textContent = btn.textContent.trim();
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

// ----- records / filters -----
async function populateDeptFilter(){
  const { data } = await supabase
    .from('participants')
    .select('department')
    .not('department','is',null);

  const unique = [...new Set((data||[]).map(d => d.department).filter(Boolean))].sort();
  deptFilter.innerHTML = `<option value="">Department</option>` + unique.map(d=>`<option>${d}</option>`).join('');
}

// selection helper: adds click to each row
function bindRowSelection(){
  document.querySelectorAll('#recordsTable tbody tr').forEach(tr => {
    if (!tr.dataset.id) return;
    tr.addEventListener('click', () => {
      document.querySelectorAll('#recordsTable tbody tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      selectedId = tr.dataset.id;
      editBtn.disabled = false;
      deleteBtn.disabled = false;
      archiveBtn.disabled = false;
      loadTransactions(selectedId);
    });
  });
}

async function loadRecords(){
  const q = searchText.value.trim();
  const dept = deptFilter.value.trim();

  let query = supabase.from('participants')
    .select('participant_id,name,employer,status,department')
    .order('participant_id', { ascending:true });

  if (q)    query = query.or(`name.ilike.%${q}%,employer.ilike.%${q}%`);
  if (dept) query = query.eq('department', dept);

  const { data, error } = await query;
  if (error){
    recordsTbody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    return;
  }

  const rows = data.map(p => {
    const tr = document.createElement('tr');
    tr.dataset.id = p.participant_id; // used for selection
    tr.innerHTML = `
      <td>${p.participant_id}</td>
      <td>${p.name}</td>
      <td>${p.employer ?? ''}</td>
      <td>${p.status}</td>
      <td><button class="viewBtn" data-id="${p.participant_id}" type="button">[View]</button></td>`;
    return tr;
  });
  renderRows(recordsTbody, rows, 5);

  // row selection + [View]
  bindRowSelection();
  document.querySelectorAll('.viewBtn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      // visually select
      document.querySelectorAll('#recordsTable tbody tr').forEach(r => r.classList.remove('selected'));
      btn.closest('tr').classList.add('selected');
      selectedId = id;
      editBtn.disabled = false; deleteBtn.disabled = false; archiveBtn.disabled = false;
      loadTransactions(id);
    };
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

// ----- CRUD: add/edit/archive/delete -----
function openRecordDialog(mode, data=null){
  recordDialogTitle.textContent = mode === 'edit' ? 'Edit Record' : 'Add Record';
  formParticipantId.value = data?.participant_id ?? '';
  formName.value      = data?.name ?? '';
  formEmployer.value  = data?.employer ?? '';
  formDept.value      = data?.department ?? '';
  formStatus.value    = data?.status ?? 'Active';
  recordDialog.showModal();

  recordForm.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: formName.value.trim(),
      employer: formEmployer.value.trim() || null,
      department: formDept.value.trim() || null,
      status: formStatus.value
    };
    if (!payload.name){ alert('Name is required.'); return; }

    try{
      if (mode === 'edit' && formParticipantId.value){
        const { error } = await supabase
          .from('participants')
          .update(payload)
          .eq('participant_id', formParticipantId.value);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('participants')
          .insert([payload]);
        if (error) throw error;
      }
      recordDialog.close();
      await loadRecords();
      await loadRecent();
    } catch(err){
      alert('Save failed: ' + err.message);
    }
  };

  recordCancelBtn.onclick = () => recordDialog.close();
}

async function archiveSelected(){
  if (!selectedId) return;
  try{
    const { error } = await supabase
      .from('participants')
      .update({ status:'Inactive' })
      .eq('participant_id', selectedId);
    if (error) throw error;
    await loadRecords();
    await loadRecent();
  } catch(err){
    alert('Archive failed: ' + err.message);
  }
}

async function deleteSelected(){
  if (!selectedId) return;
  const sure = confirm('Delete this participant? This cannot be undone.');
  if (!sure) return;

  try{
    // ensure child rows are gone if FK doesn’t cascade
    await supabase.from('transactions').delete().eq('participant_id', selectedId);

    const { error } = await supabase
      .from('participants')
      .delete()
      .eq('participant_id', selectedId);
    if (error) throw error;

    selectedId = null;
    editBtn.disabled = true; deleteBtn.disabled = true; archiveBtn.disabled = true;
    txTbody.innerHTML = `<tr><td colspan="4">Select a record to view its transactions.</td></tr>`;
    await loadRecords();
    await loadRecent();
  } catch(err){
    alert('Delete failed: ' + err.message);
  }
}

// button hooks
if (addBtn)    addBtn.onclick    = () => openRecordDialog('add');
if (editBtn)   editBtn.onclick   = async () => {
  if (!selectedId) return;
  const { data, error } = await supabase
    .from('participants')
    .select('participant_id,name,employer,department,status')
    .eq('participant_id', selectedId)
    .single();
  if (error) return alert('Load failed: ' + error.message);
  openRecordDialog('edit', data);
};
if (archiveBtn) archiveBtn.onclick = archiveSelected;
if (deleteBtn)  deleteBtn.onclick  = deleteSelected;

// ----- search wiring -----
if (dashSearchBtn) dashSearchBtn.onclick = async () => {
  document.querySelector('.tab[data-target="#recordsView"]').click();
  searchText.value = dashSearch.value;
  await loadRecords();
};
if (searchBtn)   searchBtn.onclick   = loadRecords;
if (deptFilter)  deptFilter.onchange = loadRecords;

// ----- init -----
(async function init(){
  const { error } = await supabase.from('participants').select('participant_id').limit(1);
  setConnected(!error);

  if (recentTbody) await loadRecent();
  if (deptFilter)  await populateDeptFilter();
  if (recordsTbody) await loadRecords();

  showOnly('#dashboardView');
  viewTitle.textContent = 'Dashboard';
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[data-target="#dashboardView"]').classList.add('active');
})();

