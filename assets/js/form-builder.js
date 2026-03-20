/**
 * FormVault — Admin Dashboard & Form Builder
 * Handles: overview stats, forms list, responses viewer, form builder (drag & drop)
 */

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────────
    let currentUser = null;
    let allForms = {};
    let builderFields = [];
    let selectedFieldId = null;
    let editingFormId = null;
    let sortableInstance = null;
    let responsesListener = null;
    let chartInstance = null;

    // ─── Init ─────────────────────────────────────────────────────────────────
    window.initDashboard = function (user) {
        currentUser = user;
        setupNavigation();
        setupOverview();
        setupBuilder();
        setupResponses();
        loadAllForms();
    };

    // ─── Navigation ───────────────────────────────────────────────────────────
    function setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                switchView(view);
            });
        });

        // "New Form" buttons
        const overviewNewBtn = document.getElementById('overviewNewFormBtn');
        const formsNewBtn = document.getElementById('formsNewFormBtn');
        if (overviewNewBtn) overviewNewBtn.addEventListener('click', () => openNewForm());
        if (formsNewBtn) formsNewBtn.addEventListener('click', () => openNewForm());
    }

    function switchView(viewName) {
        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}View`);
        });

        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    }

    // ─── Load All Forms ───────────────────────────────────────────────────────
    function loadAllForms() {
        db.ref('forms').on('value', (snapshot) => {
            allForms = snapshot.val() || {};
            renderFormsGrid();
            updateOverviewStats();
            updateResponsesFormSelect();
        });
    }

    // ─── Overview ─────────────────────────────────────────────────────────────
    function setupOverview() {
        // Chart will be initialized after data loads
    }

    function updateOverviewStats() {
        const forms = Object.values(allForms);
        const totalForms = forms.length;
        const activeForms = forms.filter(f => f.active).length;

        document.getElementById('totalForms').textContent = totalForms;
        document.getElementById('activeForms').textContent = activeForms;

        // Count all responses
        db.ref('responses').once('value', (snapshot) => {
            const allResponses = snapshot.val() || {};
            let total = 0;
            let today = 0;
            const todayStr = new Date().toISOString().slice(0, 10);

            Object.values(allResponses).forEach(formResponses => {
                Object.values(formResponses).forEach(r => {
                    total++;
                    if (r.submittedAt && r.submittedAt.startsWith(todayStr)) today++;
                });
            });

            document.getElementById('totalResponses').textContent = total;
            document.getElementById('todayResponses').textContent = today;

            renderRecentForms();
            renderChart(allResponses);
        });
    }

    function renderRecentForms() {
        const container = document.getElementById('recentFormsList');
        if (!container) return;

        const forms = Object.entries(allForms)
            .sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''))
            .slice(0, 5);

        if (forms.length === 0) {
            container.innerHTML = '<p class="empty-text">No forms yet. Create your first form!</p>';
            return;
        }

        container.innerHTML = forms.map(([id, form]) => `
            <div class="recent-item" onclick="editForm('${id}')">
                <div class="recent-item-info">
                    <span class="recent-item-title">${escHtml(form.title || 'Untitled')}</span>
                    <span class="recent-item-meta">${form.fields ? form.fields.length : 0} fields · ${form.active ? 'Active' : 'Inactive'}</span>
                </div>
                <span class="recent-item-badge ${form.active ? 'badge-active' : 'badge-inactive'}">${form.active ? 'Active' : 'Draft'}</span>
            </div>
        `).join('');
    }

    function renderChart(allResponses) {
        const canvas = document.getElementById('responsesChart');
        if (!canvas) return;
        if (typeof Chart === 'undefined') return;

        // Build last 7 days data
        const days = [];
        const counts = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const label = (d.getMonth()+1) + '/' + d.getDate();
            days.push(label);

            let count = 0;
            try {
                Object.values(allResponses || {}).forEach(formResponses => {
                    Object.values(formResponses || {}).forEach(r => {
                        if (r && r.submittedAt && r.submittedAt.startsWith(dateStr)) count++;
                    });
                });
            } catch(e) {}
            counts.push(count);
        }

        if (chartInstance) { try { chartInstance.destroy(); } catch(e) {} }

        chartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Responses',
                    data: counts,
                    borderColor: '#7c3aed',
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#06b6d4',
                    pointRadius: 4,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)', stepSize: 1 }, beginAtZero: true }
                }
            }
        });
    }

    // ─── Forms Grid ───────────────────────────────────────────────────────────
    function renderFormsGrid() {
        const grid = document.getElementById('formsGrid');
        if (!grid) return;

        const forms = Object.entries(allForms)
            .sort((a, b) => (b[1].createdAt || '').localeCompare(a[1].createdAt || ''));

        if (forms.length === 0) {
            grid.innerHTML = `
                <div class="forms-empty">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <path d="M14 2v6h6M12 18v-6M9 15h6"/>
                    </svg>
                    <p>No forms yet</p>
                    <button class="btn btn-primary" onclick="openNewForm()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                        Create First Form
                    </button>
                </div>`;
            return;
        }

        grid.innerHTML = forms.map(([id, form]) => {
            const fieldCount = form.fields ? form.fields.length : 0;
            const created = form.createdAt ? new Date(form.createdAt).toLocaleDateString() : 'Unknown';
            const shareUrl = `${location.origin}${location.pathname.replace('/admin/dashboard.html', '')}/?form=${id}`;

            return `
            <div class="form-card glass-card fade-in">
                <div class="form-card-header">
                    <div class="form-card-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                        </svg>
                    </div>
                    <span class="form-card-badge ${form.active ? 'badge-active' : 'badge-inactive'}">${form.active ? 'Active' : 'Draft'}</span>
                </div>
                <h3 class="form-card-title">${escHtml(form.title || 'Untitled Form')}</h3>
                <p class="form-card-desc">${escHtml(form.description || 'No description')}</p>
                <div class="form-card-meta">
                    <span>${fieldCount} field${fieldCount !== 1 ? 's' : ''}</span>
                    <span>Created ${created}</span>
                </div>
                <div class="form-card-actions">
                    <button class="btn btn-sm btn-secondary" onclick="editForm('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="showShareLink('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                        Share
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="toggleFormActive('${id}', ${!form.active})">
                        ${form.active
                    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Deactivate'
                    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12l5 5L20 7"/></svg> Activate'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="confirmDeleteForm('${id}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                        Delete
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // ─── Form Builder ─────────────────────────────────────────────────────────
    function setupBuilder() {
        setupPalette();
        setupBuilderCanvas();
        setupPropertyPanel();
        setupSaveButton();
        setupPreview();
    }

    function openNewForm() {
        editingFormId = null;
        builderFields = [];
        selectedFieldId = null;

        document.getElementById('builderTitle').textContent = 'Create New Form';
        document.getElementById('builderFormTitle').value = 'Untitled Form';
        document.getElementById('builderFormDesc').value = '';

        renderBuilderFields();
        hidePropertiesForm();
        switchView('builder');
    }

    window.editForm = function (formId) {
        const form = allForms[formId];
        if (!form) return;

        editingFormId = formId;
        // Firebase stores arrays as objects — convert back to array
        const rawFields = form.fields || [];
        if (Array.isArray(rawFields)) {
            builderFields = JSON.parse(JSON.stringify(rawFields));
        } else {
            builderFields = Object.values(rawFields);
        }
        selectedFieldId = null;

        document.getElementById('builderTitle').textContent = 'Edit Form';
        document.getElementById('builderFormTitle').value = form.title || '';
        document.getElementById('builderFormDesc').value = form.description || '';

        renderBuilderFields();
        hidePropertiesForm();
        switchView('builder');
    };

    // Palette drag-and-drop
    function setupPalette() {
        document.querySelectorAll('.palette-field').forEach(item => {
            // Click always works (desktop + mobile)
            item.addEventListener('click', () => addField(item.dataset.type));

            // Desktop drag
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('fieldType', item.dataset.type);
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));

            // Mobile touch drag
            let touchDragging = false;
            let touchClone = null;

            item.addEventListener('touchstart', (e) => {
                touchDragging = false;
            }, { passive: true });

            item.addEventListener('touchmove', (e) => {
                touchDragging = true;
                e.preventDefault();
                const touch = e.touches[0];

                if (!touchClone) {
                    touchClone = item.cloneNode(true);
                    touchClone.style.cssText = 'position:fixed;opacity:0.8;pointer-events:none;z-index:9999;background:rgba(124,58,237,0.3);border:1px solid #7c3aed;border-radius:8px;padding:0.5rem 1rem;font-size:0.85rem;color:white;transform:scale(1.05);';
                    document.body.appendChild(touchClone);
                }

                touchClone.style.left = (touch.clientX - 60) + 'px';
                touchClone.style.top = (touch.clientY - 20) + 'px';

                const canvas = document.getElementById('builderFields');
                const rect = canvas ? canvas.getBoundingClientRect() : null;
                if (rect && touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    canvas.classList.add('drag-over');
                } else if (canvas) {
                    canvas.classList.remove('drag-over');
                }
            }, { passive: false });

            item.addEventListener('touchend', (e) => {
                if (touchClone) { touchClone.remove(); touchClone = null; }
                const canvas = document.getElementById('builderFields');
                if (canvas) canvas.classList.remove('drag-over');

                if (!touchDragging) return;

                const touch = e.changedTouches[0];
                if (!canvas) return;
                const rect = canvas.getBoundingClientRect();
                if (touch.clientX >= rect.left && touch.clientX <= rect.right &&
                    touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                    addField(item.dataset.type);
                }
                touchDragging = false;
            });
        });
    }

    function setupBuilderCanvas() {
        const canvas = document.getElementById('builderFields');
        if (!canvas) return;

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
        });
        canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            const type = e.dataTransfer.getData('fieldType');
            if (type) addField(type);
        });
    }

    function addField(type) {
        const field = {
            id: generateId(),
            type,
            label: getDefaultLabel(type),
            placeholder: '',
            helpText: '',
            required: false,
            options: ['radio', 'checkbox', 'dropdown'].includes(type) ? ['Option 1', 'Option 2', 'Option 3'] : []
        };

        builderFields.push(field);
        renderBuilderFields();
        selectField(field.id);
    }

    function getDefaultLabel(type) {
        const labels = {
            short_text: 'Short Answer',
            long_text: 'Paragraph',
            number: 'Number',
            email: 'Email',
            phone: 'Phone Number',
            date: 'Date',
            time: 'Time',
            dropdown: 'Dropdown',
            radio: 'Multiple Choice',
            checkbox: 'Checkboxes',
            file: 'File Upload',
            rating: 'Rating',
            heading: 'Section Heading'
        };
        return labels[type] || 'Field';
    }

    function renderBuilderFields() {
        const container = document.getElementById('builderFields');
        const empty = document.getElementById('builderEmpty');
        if (!container) return;

        // Destroy sortable before DOM change
        destroySortable();

        // Remove existing field items only
        container.querySelectorAll('.builder-field-item').forEach(el => el.remove());

        if (builderFields.length === 0) {
            if (empty) empty.style.display = 'flex';
            return;
        }

        if (empty) empty.style.display = 'none';

        builderFields.forEach((field) => {
            const item = document.createElement('div');
            item.className = `builder-field-item ${selectedFieldId === field.id ? 'selected' : ''}`;
            item.dataset.id = field.id;

            item.innerHTML = `
                <div class="field-item-drag">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
                        <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
                        <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
                    </svg>
                </div>
                <div class="field-item-content" onclick="selectBuilderField('${field.id}')">
                    <span class="field-item-type">${getTypeIcon(field.type)} ${getTypeName(field.type)}</span>
                    <span class="field-item-label">${escHtml(field.label)}${field.required ? ' <span class="required-asterisk">*</span>' : ''}</span>
                </div>
                <div class="field-item-actions">
                    <button class="btn-icon-sm" onclick="event.stopPropagation();duplicateField('${field.id}')" title="Duplicate">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    <button class="btn-icon-sm btn-danger-icon" onclick="event.stopPropagation();removeField('${field.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                    </button>
                </div>
            `;

            container.appendChild(item);
        });

        // Init sortable after all items added
        initSortable();
    }

    function initSortable() {
        destroySortable();
        const container = document.getElementById('builderFields');
        if (!container || typeof Sortable === 'undefined') return;

        sortableInstance = Sortable.create(container, {
            animation: 150,
            handle: '.field-item-drag',
            draggable: '.builder-field-item',
            onEnd: (evt) => {
                if (evt.oldIndex === evt.newIndex) return;
                const moved = builderFields.splice(evt.oldIndex, 1)[0];
                builderFields.splice(evt.newIndex, 0, moved);
                // Re-render to sync state without re-init sortable
                container.querySelectorAll('.builder-field-item').forEach(el => el.remove());
                builderFields.forEach((field) => {
                    const item = document.createElement('div');
                    item.className = `builder-field-item ${selectedFieldId === field.id ? 'selected' : ''}`;
                    item.dataset.id = field.id;
                    item.innerHTML = `
                        <div class="field-item-drag">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="5" r="1" fill="currentColor"/>
                                <circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/>
                                <circle cx="9" cy="19" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
                            </svg>
                        </div>
                        <div class="field-item-content" onclick="selectBuilderField('${field.id}')">
                            <span class="field-item-type">${getTypeIcon(field.type)} ${getTypeName(field.type)}</span>
                            <span class="field-item-label">${escHtml(field.label)}${field.required ? ' <span class="required-asterisk">*</span>' : ''}</span>
                        </div>
                        <div class="field-item-actions">
                            <button class="btn-icon-sm" onclick="event.stopPropagation();duplicateField('${field.id}')" title="Duplicate">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                            </button>
                            <button class="btn-icon-sm btn-danger-icon" onclick="event.stopPropagation();removeField('${field.id}')" title="Delete">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"/></svg>
                            </button>
                        </div>
                    `;
                    container.appendChild(item);
                });
            }
        });
    }

    function destroySortable() {
        if (sortableInstance) {
            sortableInstance.destroy();
            sortableInstance = null;
        }
    }

    window.selectBuilderField = function (id) { selectField(id); };

    function selectField(id) {
        selectedFieldId = id;
        renderBuilderFields();
        showPropertiesForm(id);
    }

    window.duplicateField = function (id) {
        const field = builderFields.find(f => f.id === id);
        if (!field) return;
        const copy = JSON.parse(JSON.stringify(field));
        copy.id = generateId();
        copy.label = copy.label + ' (Copy)';
        const index = builderFields.findIndex(f => f.id === id);
        builderFields.splice(index + 1, 0, copy);
        renderBuilderFields();
        showToast('Field duplicated', 'success');
    };

    window.removeField = function (id) {
        builderFields = builderFields.filter(f => f.id !== id);
        if (selectedFieldId === id) {
            selectedFieldId = null;
            hidePropertiesForm();
        }
        renderBuilderFields();
    };

    // ─── Property Panel ───────────────────────────────────────────────────────
    function setupPropertyPanel() {
        const propLabel = document.getElementById('propLabel');
        const propPlaceholder = document.getElementById('propPlaceholder');
        const propHelpText = document.getElementById('propHelpText');
        const propRequired = document.getElementById('propRequired');
        const propOptions = document.getElementById('propOptions');
        const propDelete = document.getElementById('propDeleteField');

        if (propLabel) propLabel.addEventListener('input', () => updateSelectedField('label', propLabel.value));
        if (propPlaceholder) propPlaceholder.addEventListener('input', () => updateSelectedField('placeholder', propPlaceholder.value));
        if (propHelpText) propHelpText.addEventListener('input', () => updateSelectedField('helpText', propHelpText.value));
        if (propRequired) propRequired.addEventListener('change', () => updateSelectedField('required', propRequired.checked));
        if (propOptions) propOptions.addEventListener('input', () => {
            const opts = propOptions.value.split('\n').map(o => o.trim()).filter(Boolean);
            updateSelectedField('options', opts);
        });
        if (propDelete) propDelete.addEventListener('click', () => {
            if (selectedFieldId) {
                window.removeField(selectedFieldId);
            }
        });
    }

    function updateSelectedField(key, value) {
        const field = builderFields.find(f => f.id === selectedFieldId);
        if (!field) return;
        field[key] = value;
        renderBuilderFields();
    }

    function showPropertiesForm(id) {
        const field = builderFields.find(f => f.id === id);
        if (!field) return;

        document.getElementById('propertiesPlaceholder').style.display = 'none';
        document.getElementById('propertiesForm').style.display = 'block';

        document.getElementById('propLabel').value = field.label || '';
        document.getElementById('propPlaceholder').value = field.placeholder || '';
        document.getElementById('propHelpText').value = field.helpText || '';
        document.getElementById('propRequired').checked = field.required || false;

        const optionsGroup = document.getElementById('propOptionsGroup');
        const hasOptions = ['radio', 'checkbox', 'dropdown'].includes(field.type);
        optionsGroup.style.display = hasOptions ? 'block' : 'none';
        if (hasOptions) {
            document.getElementById('propOptions').value = (field.options || []).join('\n');
        }

        // Hide placeholder for heading/file/rating
        const noPlaceholder = ['heading', 'file', 'rating', 'radio', 'checkbox'];
        document.getElementById('propPlaceholder').closest('.form-group').style.display =
            noPlaceholder.includes(field.type) ? 'none' : 'block';
    }

    function hidePropertiesForm() {
        const placeholder = document.getElementById('propertiesPlaceholder');
        const form = document.getElementById('propertiesForm');
        if (placeholder) placeholder.style.display = 'block';
        if (form) form.style.display = 'none';
    }

    // ─── Save Form ────────────────────────────────────────────────────────────
    function setupSaveButton() {
        const saveBtn = document.getElementById('saveFormBtn');
        if (saveBtn) saveBtn.addEventListener('click', saveForm);
    }

    async function saveForm() {
        const title = document.getElementById('builderFormTitle').value.trim();
        const description = document.getElementById('builderFormDesc').value.trim();

        if (!title) {
            showToast('Please enter a form title', 'error');
            document.getElementById('builderFormTitle').focus();
            return;
        }

        const saveBtn = document.getElementById('saveFormBtn');

        // Convert builderFields to plain array (ensure no prototype issues)
        const fieldsToSave = JSON.parse(JSON.stringify(builderFields));

        if (fieldsToSave.length === 0) {
            showToast('Please add at least one field', 'error');
            return;
        }

        setButtonLoading(saveBtn, true);

        try {
            const formData = {
                title,
                description,
                fields: fieldsToSave,
                active: true,
                updatedAt: getTimestamp()
            };

            if (editingFormId) {
                // Update existing
                await db.ref(`forms/${editingFormId}`).update(formData);
                showToast('Form updated successfully!', 'success');
            } else {
                // Create new
                formData.createdAt = getTimestamp();
                const newRef = db.ref('forms').push();
                await newRef.set(formData);
                editingFormId = newRef.key;

                showToast('Form created successfully!', 'success');

                // Show share link
                setTimeout(() => showShareLink(editingFormId), 800);
            }

            setButtonLoading(saveBtn, false);
        } catch (error) {
            console.error('Save error:', error);
            showToast('Failed to save form. Try again.', 'error');
            setButtonLoading(saveBtn, false);
        }
    }

    // ─── Preview ──────────────────────────────────────────────────────────────
    function setupPreview() {
        const previewBtn = document.getElementById('previewFormBtn');
        const closeBtn = document.getElementById('closePreview');
        const modal = document.getElementById('previewModal');

        if (previewBtn) previewBtn.addEventListener('click', () => {
            renderPreview();
            modal.classList.add('active');
        });
        if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('active'));
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    function renderPreview() {
        const body = document.getElementById('previewBody');
        if (!body) return;

        const title = document.getElementById('builderFormTitle').value || 'Untitled Form';
        const desc = document.getElementById('builderFormDesc').value;

        let html = `<h2 style="margin-bottom:0.5rem;font-size:1.4rem;">${escHtml(title)}</h2>`;
        if (desc) html += `<p style="color:rgba(255,255,255,0.6);margin-bottom:1.5rem;">${escHtml(desc)}</p>`;

        if (builderFields.length === 0) {
            html += '<p style="color:rgba(255,255,255,0.4);text-align:center;padding:2rem;">No fields added yet.</p>';
        } else {
            builderFields.forEach(field => {
                if (field.type === 'heading') {
                    html += `<h3 style="margin:1.5rem 0 0.5rem;font-size:1.1rem;color:#7c3aed;">${escHtml(field.label)}</h3>`;
                    return;
                }
                html += `<div style="margin-bottom:1.2rem;">
                    <label style="display:block;margin-bottom:0.4rem;font-size:0.9rem;font-weight:500;">
                        ${escHtml(field.label)}${field.required ? ' <span style="color:#ef4444;">*</span>' : ''}
                    </label>`;

                switch (field.type) {
                    case 'long_text':
                        html += `<textarea class="form-input form-textarea" placeholder="${escHtml(field.placeholder || '')}" rows="3" disabled></textarea>`;
                        break;
                    case 'dropdown':
                        html += `<select class="form-select" disabled>
                            <option>${escHtml(field.placeholder || 'Select an option...')}</option>
                            ${(field.options || []).map(o => `<option>${escHtml(o)}</option>`).join('')}
                        </select>`;
                        break;
                    case 'radio':
                        html += `<div class="choice-group">
                            ${(field.options || []).map(o => `
                            <label class="choice-item">
                                <input type="radio" disabled> <span>${escHtml(o)}</span>
                            </label>`).join('')}
                        </div>`;
                        break;
                    case 'checkbox':
                        html += `<div class="choice-group">
                            ${(field.options || []).map(o => `
                            <label class="choice-item">
                                <input type="checkbox" disabled> <span>${escHtml(o)}</span>
                            </label>`).join('')}
                        </div>`;
                        break;
                    case 'rating':
                        html += `<div style="font-size:1.8rem;color:#f59e0b;letter-spacing:4px;">★★★★★</div>`;
                        break;
                    case 'file':
                        html += `<div class="file-upload-zone" style="cursor:default;opacity:0.6;">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
                            <p>Click to upload</p>
                        </div>`;
                        break;
                    default:
                        html += `<input class="form-input" type="text" placeholder="${escHtml(field.placeholder || '')}" disabled>`;
                }

                if (field.helpText) {
                    html += `<span style="font-size:0.8rem;color:rgba(255,255,255,0.4);display:block;margin-top:0.25rem;">${escHtml(field.helpText)}</span>`;
                }
                html += '</div>';
            });
        }

        body.innerHTML = html;
    }

    // ─── Share Link ───────────────────────────────────────────────────────────
    window.showShareLink = function (formId) {
        const modal = document.getElementById('shareLinkModal');
        const input = document.getElementById('shareLinkInput');
        const copyBtn = document.getElementById('copyLinkBtn');
        const closeBtn = document.getElementById('closeShareModal');

        if (!modal || !input) return;

        const url = `${location.origin}${location.pathname.replace('/admin/dashboard.html', '')}/index.html?form=${formId}`;
        input.value = url;
        modal.classList.add('active');

        if (copyBtn) {
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(url).then(() => {
                    showToast('Link copied!', 'success');
                    modal.classList.remove('active');
                });
            };
        }

        if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => { if (e.target === modal) modal.classList.remove('active'); };
    };

    // ─── Toggle Active ────────────────────────────────────────────────────────
    window.toggleFormActive = async function (formId, active) {
        try {
            await db.ref(`forms/${formId}/active`).set(active);
            showToast(active ? 'Form activated' : 'Form deactivated', 'success');
        } catch (e) {
            showToast('Failed to update form status', 'error');
        }
    };

    // ─── Delete Form ──────────────────────────────────────────────────────────
    let deleteTargetId = null;

    window.confirmDeleteForm = function (formId) {
        deleteTargetId = formId;
        const modal = document.getElementById('deleteModal');
        if (modal) modal.classList.add('active');

        document.getElementById('closeDeleteModal').onclick = () => modal.classList.remove('active');
        document.getElementById('cancelDeleteBtn').onclick = () => modal.classList.remove('active');
        document.getElementById('confirmDeleteBtn').onclick = async () => {
            const btn = document.getElementById('confirmDeleteBtn');
            setButtonLoading(btn, true);
            try {
                await db.ref(`forms/${deleteTargetId}`).remove();
                await db.ref(`responses/${deleteTargetId}`).remove();
                modal.classList.remove('active');
                showToast('Form deleted', 'success');
            } catch (e) {
                showToast('Delete failed', 'error');
            }
            setButtonLoading(btn, false);
        };
    };

    // ─── Responses ────────────────────────────────────────────────────────────
    function setupResponses() {
        const select = document.getElementById('responseFormSelect');
        const exportBtn = document.getElementById('exportCsvBtn');
        const searchInput = document.getElementById('responseSearch');

        if (select) {
            select.addEventListener('change', () => {
                loadResponses(select.value);
            });
        }

        if (exportBtn) exportBtn.addEventListener('click', exportCsv);
        if (searchInput) searchInput.addEventListener('input', () => filterResponsesTable(searchInput.value));
    }

    function updateResponsesFormSelect() {
        const select = document.getElementById('responseFormSelect');
        if (!select) return;

        const current = select.value;
        select.innerHTML = '<option value="">Select a form...</option>';

        Object.entries(allForms).forEach(([id, form]) => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = form.title || 'Untitled';
            select.appendChild(opt);
        });

        if (current) select.value = current;
    }

    let currentResponsesData = [];
    let currentFormFields = [];

    function loadResponses(formId) {
        const container = document.getElementById('responsesTableContainer');
        const searchBar = document.getElementById('responseSearchBar');
        const exportBtn = document.getElementById('exportCsvBtn');
        const subtitle = document.getElementById('responsesSubtitle');

        if (responsesListener) {
            db.ref(`responses/${responsesListener}`).off();
        }

        if (!formId) {
            if (container) container.style.display = 'none';
            if (searchBar) searchBar.style.display = 'none';
            if (exportBtn) exportBtn.style.display = 'none';
            return;
        }

        responsesListener = formId;
        const form = allForms[formId];
        currentFormFields = form ? (form.fields || []).filter(f => f.type !== 'heading') : [];

        if (subtitle) subtitle.textContent = `Responses for: ${form ? form.title : formId}`;

        db.ref(`responses/${formId}`).on('value', (snapshot) => {
            const data = snapshot.val() || {};
            currentResponsesData = Object.entries(data).map(([id, r]) => ({ id, ...r }))
                .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));

            renderResponsesTable(currentResponsesData);

            if (container) container.style.display = 'block';
            if (searchBar) searchBar.style.display = 'flex';
            if (exportBtn) exportBtn.style.display = currentResponsesData.length > 0 ? 'flex' : 'none';
        });
    }

    function renderResponsesTable(responses) {
        const thead = document.getElementById('responsesTableHead');
        const tbody = document.getElementById('responsesTableBody');
        const noText = document.getElementById('noResponsesText');

        if (!thead || !tbody) return;

        if (responses.length === 0) {
            thead.innerHTML = '';
            tbody.innerHTML = '';
            if (noText) noText.style.display = 'block';
            return;
        }

        if (noText) noText.style.display = 'none';

        // Headers
        const headers = ['#', 'Submitted At', ...currentFormFields.map(f => f.label)];
        thead.innerHTML = `<tr>${headers.map(h => `<th>${escHtml(h)}</th>`).join('')}</tr>`;

        // Rows
        tbody.innerHTML = responses.map((r, i) => {
            const date = r.submittedAt ? new Date(r.submittedAt).toLocaleString() : '-';
            const cells = currentFormFields.map(field => {
                const val = r.data ? (r.data[field.label] || r.data[field.id] || '-') : '-';
                const display = Array.isArray(val) ? val.join(', ') : String(val);
                return `<td>${escHtml(display)}</td>`;
            });
            return `<tr><td>${i + 1}</td><td>${date}</td>${cells.join('')}</tr>`;
        }).join('');
    }

    function filterResponsesTable(query) {
        if (!query.trim()) {
            renderResponsesTable(currentResponsesData);
            return;
        }
        const filtered = currentResponsesData.filter(r => {
            const str = JSON.stringify(r).toLowerCase();
            return str.includes(query.toLowerCase());
        });
        renderResponsesTable(filtered);
    }

    function exportCsv() {
        if (currentResponsesData.length === 0) return;

        const headers = ['Submitted At', ...currentFormFields.map(f => f.label)];
        const rows = currentResponsesData.map(r => {
            const date = r.submittedAt || '';
            const cells = currentFormFields.map(field => {
                const val = r.data ? (r.data[field.label] || r.data[field.id] || '') : '';
                const display = Array.isArray(val) ? val.join('; ') : String(val);
                return `"${display.replace(/"/g, '""')}"`;
            });
            return [`"${date}"`, ...cells].join(',');
        });

        const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `responses-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('CSV exported!', 'success');
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function escHtml(str) {
        const d = document.createElement('div');
        d.textContent = String(str || '');
        return d.innerHTML;
    }

    function getTypeName(type) {
        const names = {
            short_text: 'Short Text', long_text: 'Paragraph', number: 'Number',
            email: 'Email', phone: 'Phone', date: 'Date', time: 'Time',
            dropdown: 'Dropdown', radio: 'Multiple Choice', checkbox: 'Checkboxes',
            file: 'File Upload', rating: 'Rating', heading: 'Section Heading'
        };
        return names[type] || type;
    }

    function getTypeIcon(type) {
        const icons = {
            short_text: '✏️', long_text: '📝', number: '🔢', email: '📧',
            phone: '📞', date: '📅', time: '🕐', dropdown: '🔽',
            radio: '🔘', checkbox: '☑️', file: '📎', rating: '⭐', heading: '📌'
        };
        return icons[type] || '•';
    }

    console.log('🏗️ FormVault Builder loaded');
})();
