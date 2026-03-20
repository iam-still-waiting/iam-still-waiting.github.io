/**
 * FormVault — Public Form Renderer
 */

(function() {
    'use strict';

    let currentForm = null;
    let currentFormId = null;
    let currentStep = 0;
    let totalSteps = 1;
    let sections = [];
    let draftKey = '';
    let isSubmitting = false;

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const formId = urlParams.get('form');
        if (!formId) { showState('landing'); return; }
        currentFormId = formId;
        draftKey = 'fv_draft_' + formId;
        loadForm(formId);
    }

    async function loadForm(formId) {
        showState('loading');
        try {
            const snapshot = await db.ref('forms/' + formId).once('value');
            const formData = snapshot.val();
            if (!formData) {
                showError('Form Not Found', 'This form does not exist or has been removed.');
                return;
            }
            if (!formData.active) {
                showError('Form Closed', 'This form is no longer accepting responses.');
                return;
            }
            currentForm = formData;
            renderForm(formData);
            showState('form');
        } catch (err) {
            console.error(err);
            showError('Error', 'Something went wrong. Please try again.');
        }
    }

    function showError(title, msg) {
        showState('error');
        var t = document.getElementById('errorTitle');
        var m = document.getElementById('errorMessage');
        if (t) t.textContent = title;
        if (m) m.textContent = msg;
    }

    function renderForm(formData) {
        var titleEl = document.getElementById('formTitle');
        var descEl = document.getElementById('formDescription');
        if (titleEl) titleEl.textContent = formData.title || 'Untitled Form';
        if (descEl) {
            if (formData.description) {
                descEl.textContent = formData.description;
            } else {
                descEl.style.display = 'none';
            }
        }
        document.title = (formData.title || 'Form') + ' — FormVault';

        // Normalize fields (Firebase may convert array to object)
        var rawFields = formData.fields || [];
        var fields = Array.isArray(rawFields) ? rawFields : Object.values(rawFields);

        var formSections = document.getElementById('formSections');
        var submitBtn = document.getElementById('submitBtn');
        var nextBtn = document.getElementById('nextBtn');
        var prevBtn = document.getElementById('prevBtn');
        var stepIndicators = document.getElementById('stepIndicators');

        if (fields.length === 0) {
            if (formSections) formSections.innerHTML = '<p class="empty-text">This form has no fields.</p>';
            if (submitBtn) submitBtn.style.display = 'none';
            return;
        }

        // Split into sections by heading
        sections = [[]];
        fields.forEach(function(field) {
            if (field.type === 'heading' && sections[sections.length - 1].length > 0) {
                sections.push([]);
            }
            sections[sections.length - 1].push(field);
        });

        totalSteps = sections.length;
        currentStep = 0;

        // Render sections
        if (formSections) {
            formSections.innerHTML = '';
            sections.forEach(function(sFields, idx) {
                var div = document.createElement('div');
                div.className = 'form-section' + (idx === 0 ? ' active' : '');
                div.id = 'section-' + idx;
                sFields.forEach(function(field) {
                    div.appendChild(buildField(field));
                });
                formSections.appendChild(div);
            });
        }

        // Buttons
        if (totalSteps > 1) {
            if (stepIndicators) { stepIndicators.style.display = 'flex'; buildStepDots(); }
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'flex';
            if (submitBtn) submitBtn.style.display = 'none';
        } else {
            if (stepIndicators) stepIndicators.style.display = 'none';
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (submitBtn) { submitBtn.style.display = 'flex'; submitBtn.type = 'button'; }
        }

        // Attach submit
        if (submitBtn) {
            // Remove old listeners by cloning
            var newBtn = submitBtn.cloneNode(true);
            newBtn.type = 'button';
            submitBtn.parentNode.replaceChild(newBtn, submitBtn);
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                doSubmit();
            });
        }

        // Attach next/prev
        var nb = document.getElementById('nextBtn');
        var pb = document.getElementById('prevBtn');
        if (nb) {
            var nb2 = nb.cloneNode(true);
            nb.parentNode.replaceChild(nb2, nb);
            nb2.addEventListener('click', function() { goStep(currentStep + 1); });
        }
        if (pb) {
            var pb2 = pb.cloneNode(true);
            pb.parentNode.replaceChild(pb2, pb);
            pb2.addEventListener('click', function() { goStep(currentStep - 1); });
        }

        // Also block form submit event
        var dynForm = document.getElementById('dynamicForm');
        if (dynForm) {
            dynForm.addEventListener('submit', function(e) { e.preventDefault(); });
        }

        loadDraft();
        updateProgress();
    }

    function buildField(field) {
        var wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        wrapper.id = 'group-' + field.id;

        if (field.type === 'heading') {
            wrapper.innerHTML = '<h3 class="section-heading">' + esc(field.label || 'Section') + '</h3>';
            if (field.helpText) wrapper.innerHTML += '<p class="field-help">' + esc(field.helpText) + '</p>';
            return wrapper;
        }

        // Label
        var lbl = document.createElement('label');
        lbl.className = 'form-label';
        lbl.setAttribute('for', 'field-' + field.id);
        lbl.innerHTML = esc(field.label || 'Field') + (field.required ? ' <span class="required-asterisk">*</span>' : '');
        wrapper.appendChild(lbl);

        // Input
        var inp = null;
        switch (field.type) {
            case 'short_text':
                inp = document.createElement('input');
                inp.type = 'text'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                inp.placeholder = field.placeholder || '';
                wrapper.appendChild(inp);
                break;
            case 'long_text':
                inp = document.createElement('textarea');
                inp.className = 'form-input form-textarea'; inp.rows = 4;
                inp.id = 'field-' + field.id; inp.name = field.id;
                inp.placeholder = field.placeholder || '';
                wrapper.appendChild(inp);
                break;
            case 'number':
                inp = document.createElement('input');
                inp.type = 'number'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                inp.placeholder = field.placeholder || '';
                wrapper.appendChild(inp);
                break;
            case 'email':
                inp = document.createElement('input');
                inp.type = 'email'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                inp.placeholder = field.placeholder || 'email@example.com';
                wrapper.appendChild(inp);
                break;
            case 'phone':
                inp = document.createElement('input');
                inp.type = 'tel'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                inp.placeholder = field.placeholder || '';
                wrapper.appendChild(inp);
                break;
            case 'date':
                inp = document.createElement('input');
                inp.type = 'date'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                wrapper.appendChild(inp);
                break;
            case 'time':
                inp = document.createElement('input');
                inp.type = 'time'; inp.className = 'form-input';
                inp.id = 'field-' + field.id; inp.name = field.id;
                wrapper.appendChild(inp);
                break;
            case 'dropdown':
                inp = document.createElement('select');
                inp.className = 'form-select';
                inp.id = 'field-' + field.id; inp.name = field.id;
                var defOpt = document.createElement('option');
                defOpt.value = ''; defOpt.textContent = field.placeholder || 'Select...';
                inp.appendChild(defOpt);
                (field.options || []).forEach(function(o) {
                    var opt = document.createElement('option');
                    opt.value = o; opt.textContent = o;
                    inp.appendChild(opt);
                });
                wrapper.appendChild(inp);
                break;
            case 'radio':
                var rg = document.createElement('div');
                rg.className = 'choice-group'; rg.id = 'field-' + field.id;
                (field.options || []).forEach(function(o) {
                    var ci = document.createElement('label');
                    ci.className = 'choice-item';
                    ci.innerHTML = '<input type="radio" name="' + field.id + '" value="' + esc(o) + '"> <span>' + esc(o) + '</span>';
                    rg.appendChild(ci);
                });
                wrapper.appendChild(rg);
                break;
            case 'checkbox':
                var cg = document.createElement('div');
                cg.className = 'choice-group'; cg.id = 'field-' + field.id;
                (field.options || []).forEach(function(o) {
                    var ci = document.createElement('label');
                    ci.className = 'choice-item';
                    ci.innerHTML = '<input type="checkbox" name="' + field.id + '" value="' + esc(o) + '"> <span>' + esc(o) + '</span>';
                    cg.appendChild(ci);
                });
                wrapper.appendChild(cg);
                break;
            case 'rating':
                var rc = document.createElement('div');
                rc.className = 'rating-container'; rc.id = 'field-' + field.id;
                for (var i = 5; i >= 1; i--) {
                    rc.innerHTML += '<input type="radio" name="' + field.id + '" value="' + i + '" id="star-' + field.id + '-' + i + '">' +
                        '<label for="star-' + field.id + '-' + i + '">★</label>';
                }
                wrapper.appendChild(rc);
                break;
            case 'file':
                var fileFieldId = field.id;
                var fileWrapper = document.createElement('div');
                fileWrapper.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

                var fileLabel = document.createElement('label');
                fileLabel.htmlFor = 'file-input-' + fileFieldId;
                fileLabel.id = 'upload-zone-' + fileFieldId;
                fileLabel.className = 'file-upload-zone';
                fileLabel.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;';
                fileLabel.innerHTML = '<span style="font-size:1.5rem;">📎</span><p style="margin:0">Tap to select file</p><p class="small-text" style="margin:0">Max 10MB</p>';

                var fileNativeInput = document.createElement('input');
                fileNativeInput.type = 'file';
                fileNativeInput.id = 'file-input-' + fileFieldId;
                fileNativeInput.name = fileFieldId;
                fileNativeInput.accept = 'image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip';
                fileNativeInput.style.cssText = 'display:none;';

                var filePreview = document.createElement('div');
                filePreview.id = 'upload-preview-' + fileFieldId;

                fileNativeInput.addEventListener('change', (function(fId, lbl, prev) {
                    return function() {
                        var file = fileNativeInput.files[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.', 'error'); fileNativeInput.value = ''; return; }
                        lbl.innerHTML = '<span style="font-size:1.5rem;">⏳</span><p style="margin:0">Uploading...</p><p class="small-text" style="margin:0">Please wait</p>';
                        lbl.style.opacity = '0.6';
                        var fd = new FormData();
                        fd.append('file', file);
                        fd.append('upload_preset', 'Acsmform');
                        var xhr2 = new XMLHttpRequest();
                        xhr2.open('POST', 'https://api.cloudinary.com/v1_1/deckxpuqb/auto/upload', true);
                        xhr2.upload.onprogress = function(e) { if (e.lengthComputable) lbl.querySelector('p').textContent = 'Uploading ' + Math.round(e.loaded/e.total*100) + '%'; };
                        xhr2.onload = function() {
                            lbl.style.opacity = '1';
                            if (xhr2.status === 200) {
                                var info = JSON.parse(xhr2.responseText);
                                if (!window.formUploadData) window.formUploadData = {};
                                window.formUploadData[fId] = { url: info.secure_url, publicId: info.public_id, format: info.format, size: info.bytes, originalFilename: info.original_filename };
                                lbl.innerHTML = '<span style="font-size:1.5rem;">✅</span><p style="margin:0;color:#10b981;">' + (info.original_filename||'file') + '.' + info.format + '</p><p class="small-text" style="margin:0;">Tap to change</p>';
                                var isImg = ['jpg','jpeg','png','gif','webp'].includes((info.format||'').toLowerCase());
                                if (isImg) prev.innerHTML = '<img src="' + info.secure_url + '" style="max-width:100%;max-height:180px;border-radius:8px;margin-top:8px;">';
                                showToast('File uploaded!', 'success');
                            } else { lbl.innerHTML = '<span style="font-size:1.5rem;">📎</span><p style="margin:0">Tap to select file</p><p class="small-text" style="margin:0">Max 10MB</p>'; showToast('Upload failed. Try again.', 'error'); }
                        };
                        xhr2.onerror = function() { lbl.style.opacity='1'; lbl.innerHTML='<span style="font-size:1.5rem;">📎</span><p style="margin:0">Tap to select file</p><p class="small-text" style="margin:0">Max 10MB</p>'; showToast('Upload failed.', 'error'); };
                        xhr2.send(fd);
                    };
                })(fileFieldId, fileLabel, filePreview));

                fileWrapper.appendChild(fileLabel);
                fileWrapper.appendChild(fileNativeInput);
                fileWrapper.appendChild(filePreview);
                wrapper.appendChild(fileWrapper);
                break;
        }

        if (field.helpText) {
            var ht = document.createElement('span');
            ht.className = 'field-help'; ht.textContent = field.helpText;
            wrapper.appendChild(ht);
        }

        var err = document.createElement('span');
        err.className = 'field-error'; err.id = 'error-' + field.id;
        wrapper.appendChild(err);

        return wrapper;
    }

    function buildStepDots() {
        var si = document.getElementById('stepIndicators');
        if (!si) return;
        si.innerHTML = '';
        for (var i = 0; i < totalSteps; i++) {
            var dot = document.createElement('div');
            dot.className = 'step-dot' + (i === 0 ? ' active' : '');
            si.appendChild(dot);
        }
    }

    function goStep(step) {
        if (step < 0 || step >= totalSteps) return;
        if (step > currentStep && !validateStep(currentStep)) return;

        document.getElementById('section-' + currentStep).classList.remove('active');
        currentStep = step;
        document.getElementById('section-' + currentStep).classList.add('active');

        document.querySelectorAll('.step-dot').forEach(function(d, i) {
            d.className = 'step-dot' + (i === currentStep ? ' active' : (i < currentStep ? ' completed' : ''));
        });

        var pb = document.getElementById('prevBtn');
        var nb = document.getElementById('nextBtn');
        var sb = document.getElementById('submitBtn');
        if (pb) pb.style.display = currentStep > 0 ? 'flex' : 'none';
        if (nb) nb.style.display = currentStep < totalSteps - 1 ? 'flex' : 'none';
        if (sb) sb.style.display = currentStep === totalSteps - 1 ? 'flex' : 'none';

        updateProgress();
    }

    function validateStep(step) {
        var ok = true;
        (sections[step] || []).forEach(function(field) {
            if (field.type === 'heading') return;
            if (field.required && !getFieldValue(field)) {
                var el = document.getElementById('error-' + field.id);
                if (el) el.textContent = 'This field is required';
                ok = false;
            }
        });
        return ok;
    }

    function getFieldValue(field) {
        switch (field.type) {
            case 'radio': case 'rating':
                var c = document.querySelector('input[name="' + field.id + '"]:checked');
                return c ? c.value : '';
            case 'checkbox':
                var boxes = document.querySelectorAll('input[name="' + field.id + '"]:checked');
                return boxes.length > 0 ? 'checked' : '';
            case 'file':
                return (window.formUploadData && window.formUploadData[field.id]) ? 'uploaded' : '';
            default:
                var el = document.getElementById('field-' + field.id);
                return el ? el.value.trim() : '';
        }
    }

    function collectData() {
        var data = {};
        var fields = Array.isArray(currentForm.fields) ? currentForm.fields : Object.values(currentForm.fields || {});
        fields.forEach(function(field) {
            if (field.type === 'heading') return;
            var key = field.label || field.id;
            switch (field.type) {
                case 'radio': case 'rating':
                    var c = document.querySelector('input[name="' + field.id + '"]:checked');
                    data[key] = c ? c.value : '';
                    break;
                case 'checkbox':
                    var boxes = document.querySelectorAll('input[name="' + field.id + '"]:checked');
                    data[key] = Array.from(boxes).map(function(b) { return b.value; });
                    break;
                case 'file':
                    data[key] = (window.formUploadData && window.formUploadData[field.id]) ? window.formUploadData[field.id].url : '';
                    break;
                default:
                    var el = document.getElementById('field-' + field.id);
                    data[key] = el ? el.value.trim() : '';
            }
        });
        return data;
    }

    async function doSubmit() {
        if (isSubmitting) return;

        // Validate all steps
        var allOk = true;
        for (var i = 0; i < totalSteps; i++) {
            if (!validateStep(i)) {
                allOk = false;
                goStep(i);
                showToast('Please fill in all required fields', 'error');
                return;
            }
        }

        isSubmitting = true;
        var btn = document.getElementById('submitBtn');
        if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

        try {
            // Fetch IP info from worker
            var ipInfo = {};
            try {
                var ipRes = await fetch('https://blue-fog-786d.csm-mohasin-com.workers.dev/');
                if (ipRes.ok) ipInfo = await ipRes.json();
            } catch(e) {}

            var payload = {
                submittedAt: new Date().toISOString(),
                data: collectData(),
                ipInfo: ipInfo
            };
            var newRef = db.ref('responses/' + currentFormId).push();
            await newRef.set(payload);

            try { localStorage.removeItem(draftKey); } catch(e) {}

            // Send EmailJS notification
            try {
                if (window.emailjs) {
                    var formData = collectData();
                    var dataLines = Object.entries(formData).map(function(entry) {
                        return entry[0] + ': ' + (Array.isArray(entry[1]) ? entry[1].join(', ') : entry[1]);
                    }).join('\n');

                    var ipLine = ipInfo && ipInfo.ip
                        ? '\n\nIP: ' + ipInfo.ip + ' | ' + (ipInfo.city || '') + ', ' + (ipInfo.country || '') + ' | ' + (ipInfo.org || '')
                        : '';

                    emailjs.send('service_irwqywo', 'template_0tulqea', {
                        form_title: currentForm.title || 'Untitled Form',
                        message: dataLines + ipLine,
                        submitted_at: new Date().toLocaleString(),
                        form_id: currentFormId
                    });
                }
            } catch(e) { console.warn('EmailJS error:', e); }

            showState('success');
            fireConfetti();
            showToast('Submitted successfully!', 'success');
        } catch (err) {
            console.error('Submit failed:', err);
            showToast('Submit failed: ' + err.message, 'error');
        }

        isSubmitting = false;
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }

    function fireConfetti() {
        if (typeof confetti !== 'function') return;
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#7c3aed','#06b6d4','#10b981'] });
    }

    function updateProgress() {
        if (!currentForm) return;
        var fields = Array.isArray(currentForm.fields) ? currentForm.fields : Object.values(currentForm.fields || {});
        var nonHeading = fields.filter(function(f) { return f.type !== 'heading'; });
        if (nonHeading.length === 0) return;
        var filled = nonHeading.filter(function(f) { return !!getFieldValue(f); }).length;
        var pct = Math.round(filled / nonHeading.length * 100);
        var bar = document.querySelector('#progressBar .progress-fill');
        var txt = document.getElementById('progressText');
        if (bar) bar.style.width = pct + '%';
        if (txt) txt.textContent = pct + '% complete';
    }

    function loadDraft() {
        try {
            var raw = localStorage.getItem(draftKey);
            if (!raw) return;
            var data = JSON.parse(raw);
            var fields = Array.isArray(currentForm.fields) ? currentForm.fields : Object.values(currentForm.fields || {});
            fields.forEach(function(field) {
                if (field.type === 'heading' || field.type === 'file') return;
                var val = data[field.label || field.id];
                if (!val) return;
                var el = document.getElementById('field-' + field.id);
                if (el) el.value = val;
            });
        } catch(e) {}
    }

    function saveDraft() {
        if (!currentForm) return;
        try { localStorage.setItem(draftKey, JSON.stringify(collectData())); } catch(e) {}
    }

    function showState(state) {
        ['loadingState','errorState','landingState','formContainer','successState'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) { el.classList.add('hidden'); el.classList.remove('active'); }
        });
        var map = { loading: 'loadingState', error: 'errorState', landing: 'landingState', form: 'formContainer', success: 'successState' };
        var el = document.getElementById(map[state]);
        if (el) { el.classList.remove('hidden'); if (state === 'loading') el.classList.add('active'); }
    }

    function esc(str) {
        var d = document.createElement('div');
        d.textContent = String(str || '');
        return d.innerHTML;
    }

    // Submit another
    var saBtn = document.getElementById('submitAnotherBtn');
    if (saBtn) {
        saBtn.addEventListener('click', function() {
            isSubmitting = false;
            currentStep = 0;
            var dynForm = document.getElementById('dynamicForm');
            if (dynForm) dynForm.reset();
            window.formUploadData = {};
            showState('form');
            if (currentForm) renderForm(currentForm);
        });
    }

    // Auto-save draft
    document.addEventListener('input', function() { updateProgress(); saveDraft(); });
    document.addEventListener('change', function() { updateProgress(); saveDraft(); });

    init();

})();

console.log('FormVault Renderer loaded');
