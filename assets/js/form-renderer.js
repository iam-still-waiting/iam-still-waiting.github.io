/**
 * FormVault — Public Form Renderer
 * Fetches form config from Firebase and renders it dynamically
 * Handles validation, multi-step navigation, draft saving, and submission
 */

(function() {
    'use strict';

    // State
    let currentForm = null;
    let currentFormId = null;
    let currentStep = 0;
    let totalSteps = 1;
    let sections = [];
    let draftKey = '';

    // DOM References
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const landingState = document.getElementById('landingState');
    const formContainer = document.getElementById('formContainer');
    const successState = document.getElementById('successState');
    const dynamicForm = document.getElementById('dynamicForm');
    const formSections = document.getElementById('formSections');
    const formTitle = document.getElementById('formTitle');
    const formDescription = document.getElementById('formDescription');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const stepIndicators = document.getElementById('stepIndicators');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const submitAnotherBtn = document.getElementById('submitAnotherBtn');

    // Initialize on page load
    init();

    function init() {
        const urlParams = new URLSearchParams(window.location.search);
        const formId = urlParams.get('form');

        if (!formId) {
            showState('landing');
            return;
        }

        currentFormId = formId;
        draftKey = `formvault_draft_${formId}`;
        loadForm(formId);
    }

    /**
     * Load form from Firebase
     */
    async function loadForm(formId) {
        showState('loading');

        try {
            const snapshot = await db.ref(`forms/${formId}`).once('value');
            const formData = snapshot.val();

            if (!formData) {
                showState('error');
                document.getElementById('errorTitle').textContent = 'Form Not Found';
                document.getElementById('errorMessage').textContent = 'This form does not exist or has been removed.';
                return;
            }

            if (!formData.active) {
                showState('error');
                document.getElementById('errorTitle').textContent = 'Form Closed';
                document.getElementById('errorMessage').textContent = 'This form is no longer accepting responses.';
                return;
            }

            currentForm = formData;
            renderForm(formData);
            showState('form');
        } catch (error) {
            console.error('Error loading form:', error);
            showState('error');
            document.getElementById('errorTitle').textContent = 'Error Loading Form';
            document.getElementById('errorMessage').textContent = 'Something went wrong. Please try again later.';
        }
    }

    /**
     * Render form fields
     */
    function renderForm(formData) {
        formTitle.textContent = formData.title || 'Untitled Form';
        formDescription.textContent = formData.description || '';
        document.title = `${formData.title} — FormVault`;

        if (!formData.description) {
            formDescription.style.display = 'none';
        }

        const fields = formData.fields || [];
        if (fields.length === 0) {
            formSections.innerHTML = '<p class="empty-text">This form has no fields yet.</p>';
            submitBtn.style.display = 'none';
            return;
        }

        // Split fields into sections by heading type
        sections = [[]];
        fields.forEach(field => {
            if (field.type === 'heading' && sections[sections.length - 1].length > 0) {
                sections.push([]);
            }
            sections[sections.length - 1].push(field);
        });

        totalSteps = sections.length;
        currentStep = 0;

        // Render sections
        formSections.innerHTML = '';
        sections.forEach((sectionFields, index) => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = `form-section ${index === 0 ? 'active' : ''}`;
            sectionDiv.id = `section-${index}`;

            sectionFields.forEach(field => {
                sectionDiv.appendChild(createFieldElement(field));
            });

            formSections.appendChild(sectionDiv);
        });

        // Setup step indicators
        if (totalSteps > 1) {
            renderStepIndicators();
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'flex';
            submitBtn.style.display = 'none';
        } else {
            stepIndicators.style.display = 'none';
            submitBtn.style.display = 'flex';
        }

        // Load draft
        loadDraft();

        // Update progress
        updateProgress();

        // Setup event listeners
        setupFormEvents();

        // Initialize file uploads
        initFileUploads(fields);
    }

    /**
     * Create a form field element
     */
    function createFieldElement(field) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        wrapper.id = `group-${field.id}`;

        if (field.type === 'heading') {
            wrapper.innerHTML = `<h3 class="section-heading">${escapeHtml(field.label || 'Section')}</h3>`;
            if (field.helpText) {
                wrapper.innerHTML += `<p class="field-help">${escapeHtml(field.helpText)}</p>`;
            }
            return wrapper;
        }

        // Label
        const label = document.createElement('label');
        label.className = 'form-label';
        label.setAttribute('for', `field-${field.id}`);
        label.innerHTML = escapeHtml(field.label || 'Untitled');
        if (field.required) {
            label.innerHTML += ' <span class="required-asterisk">*</span>';
        }
        wrapper.appendChild(label);

        // Field input
        let input;
        switch (field.type) {
            case 'short_text':
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-input';
                input.placeholder = field.placeholder || '';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'long_text':
                input = document.createElement('textarea');
                input.className = 'form-input form-textarea';
                input.placeholder = field.placeholder || '';
                input.id = `field-${field.id}`;
                input.name = field.id;
                input.rows = 4;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-input';
                input.placeholder = field.placeholder || '';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'email':
                input = document.createElement('input');
                input.type = 'email';
                input.className = 'form-input';
                input.placeholder = field.placeholder || 'email@example.com';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'phone':
                input = document.createElement('input');
                input.type = 'tel';
                input.className = 'form-input';
                input.placeholder = field.placeholder || '+1 (555) 000-0000';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                input.className = 'form-input';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'time':
                input = document.createElement('input');
                input.type = 'time';
                input.className = 'form-input';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;
                wrapper.appendChild(input);
                break;

            case 'dropdown':
                input = document.createElement('select');
                input.className = 'form-select';
                input.id = `field-${field.id}`;
                input.name = field.id;
                if (field.required) input.required = true;

                const defaultOpt = document.createElement('option');
                defaultOpt.value = '';
                defaultOpt.textContent = field.placeholder || 'Select an option...';
                input.appendChild(defaultOpt);

                (field.options || []).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    input.appendChild(option);
                });
                wrapper.appendChild(input);
                break;

            case 'radio':
                const radioGroup = document.createElement('div');
                radioGroup.className = 'choice-group';
                radioGroup.id = `field-${field.id}`;

                (field.options || []).forEach((opt, i) => {
                    const choiceItem = document.createElement('label');
                    choiceItem.className = 'choice-item';
                    choiceItem.innerHTML = `
                        <input type="radio" name="${field.id}" value="${escapeHtml(opt)}" ${field.required ? 'required' : ''}>
                        <label>${escapeHtml(opt)}</label>
                    `;
                    radioGroup.appendChild(choiceItem);
                });
                wrapper.appendChild(radioGroup);
                break;

            case 'checkbox':
                const checkGroup = document.createElement('div');
                checkGroup.className = 'choice-group';
                checkGroup.id = `field-${field.id}`;

                (field.options || []).forEach((opt, i) => {
                    const choiceItem = document.createElement('label');
                    choiceItem.className = 'choice-item';
                    choiceItem.innerHTML = `
                        <input type="checkbox" name="${field.id}" value="${escapeHtml(opt)}">
                        <label>${escapeHtml(opt)}</label>
                    `;
                    checkGroup.appendChild(choiceItem);
                });
                wrapper.appendChild(checkGroup);
                break;

            case 'rating':
                const ratingContainer = document.createElement('div');
                ratingContainer.className = 'rating-container';
                ratingContainer.id = `field-${field.id}`;

                for (let i = 5; i >= 1; i--) {
                    ratingContainer.innerHTML += `
                        <input type="radio" name="${field.id}" value="${i}" id="star-${field.id}-${i}" ${field.required ? 'required' : ''}>
                        <label for="star-${field.id}-${i}" title="${i} star${i > 1 ? 's' : ''}">★</label>
                    `;
                }
                wrapper.appendChild(ratingContainer);
                break;

            case 'file':
                const uploadZone = document.createElement('div');
                uploadZone.className = 'file-upload-zone';
                uploadZone.id = `upload-zone-${field.id}`;
                uploadZone.innerHTML = `
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <path d="M17 8l-5-5-5 5"/>
                        <path d="M12 3v12"/>
                    </svg>
                    <p>Click to upload a file</p>
                    <p class="small-text">Max size: 10MB</p>
                `;
                wrapper.appendChild(uploadZone);

                const progressDiv = document.createElement('div');
                progressDiv.className = 'upload-progress';
                progressDiv.id = `upload-progress-${field.id}`;
                progressDiv.style.display = 'none';
                progressDiv.innerHTML = '<div class="upload-progress-bar"></div>';
                wrapper.appendChild(progressDiv);

                const previewDiv = document.createElement('div');
                previewDiv.id = `upload-preview-${field.id}`;
                wrapper.appendChild(previewDiv);
                break;
        }

        // Help text
        if (field.helpText && field.type !== 'heading') {
            const help = document.createElement('span');
            help.className = 'field-help';
            help.textContent = field.helpText;
            wrapper.appendChild(help);
        }

        // Error container
        const errorSpan = document.createElement('span');
        errorSpan.className = 'field-error';
        errorSpan.id = `error-${field.id}`;
        wrapper.appendChild(errorSpan);

        return wrapper;
    }

    /**
     * Initialize file upload widgets
     */
    function initFileUploads(fields) {
        fields.filter(f => f.type === 'file').forEach(field => {
            initCloudinaryUpload(
                field.id,
                (fileData) => {
                    window.formUploadData[field.id] = fileData;
                },
                null
            );
        });
    }

    /**
     * Render step indicators for multi-step forms
     */
    function renderStepIndicators() {
        stepIndicators.innerHTML = '';
        for (let i = 0; i < totalSteps; i++) {
            const dot = document.createElement('div');
            dot.className = `step-dot ${i === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                if (i < currentStep) {
                    goToStep(i);
                }
            });
            stepIndicators.appendChild(dot);
        }
    }

    /**
     * Navigate to a specific step
     */
    function goToStep(step) {
        if (step < 0 || step >= totalSteps) return;

        // Validate current step before moving forward
        if (step > currentStep) {
            if (!validateStep(currentStep)) return;
        }

        // Hide current section
        const currentSection = document.getElementById(`section-${currentStep}`);
        if (currentSection) currentSection.classList.remove('active');

        // Show target section
        currentStep = step;
        const targetSection = document.getElementById(`section-${currentStep}`);
        if (targetSection) targetSection.classList.add('active');

        // Update indicators
        document.querySelectorAll('.step-dot').forEach((dot, i) => {
            dot.className = 'step-dot';
            if (i === currentStep) dot.classList.add('active');
            else if (i < currentStep) dot.classList.add('completed');
        });

        // Update buttons
        prevBtn.style.display = currentStep > 0 ? 'flex' : 'none';
        if (currentStep === totalSteps - 1) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'flex';
        } else {
            nextBtn.style.display = 'flex';
            submitBtn.style.display = 'none';
        }

        // Update progress
        updateProgress();

        // Scroll to top of form
        formContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Validate fields in the current step
     */
    function validateStep(step) {
        const sectionFields = sections[step] || [];
        let isValid = true;

        sectionFields.forEach(field => {
            if (field.type === 'heading') return;
            if (!validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    /**
     * Validate a single field
     */
    function validateField(field) {
        const errorEl = document.getElementById(`error-${field.id}`);
        if (errorEl) errorEl.textContent = '';

        if (field.type === 'heading') return true;

        let value = '';
        let isValid = true;
        let errorMsg = '';

        switch (field.type) {
            case 'radio':
            case 'rating':
                const checked = document.querySelector(`input[name="${field.id}"]:checked`);
                value = checked ? checked.value : '';
                break;
            case 'checkbox':
                const checkedBoxes = document.querySelectorAll(`input[name="${field.id}"]:checked`);
                value = checkedBoxes.length > 0 ? 'filled' : '';
                break;
            case 'file':
                value = (window.formUploadData && window.formUploadData[field.id]) ? 'uploaded' : '';
                break;
            default:
                const input = document.getElementById(`field-${field.id}`);
                value = input ? input.value.trim() : '';
                break;
        }

        // Required check
        if (field.required && !value) {
            isValid = false;
            errorMsg = 'This field is required';
        }

        // Type-specific validation
        if (value && isValid) {
            switch (field.type) {
                case 'email':
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                        isValid = false;
                        errorMsg = 'Please enter a valid email address';
                    }
                    break;
                case 'phone':
                    if (!/^[\+]?[\d\s\-\(\)]{7,}$/.test(value)) {
                        isValid = false;
                        errorMsg = 'Please enter a valid phone number';
                    }
                    break;
                case 'number':
                    if (isNaN(value)) {
                        isValid = false;
                        errorMsg = 'Please enter a valid number';
                    }
                    break;
            }
        }

        if (!isValid && errorEl) {
            errorEl.textContent = errorMsg;
            // Add error class to input
            const input = document.getElementById(`field-${field.id}`);
            if (input) input.classList.add('error');
        } else {
            const input = document.getElementById(`field-${field.id}`);
            if (input) input.classList.remove('error');
        }

        return isValid;
    }

    /**
     * Collect all form data
     */
    function collectFormData() {
        const data = {};
        const fields = currentForm.fields || [];

        fields.forEach(field => {
            if (field.type === 'heading') return;

            switch (field.type) {
                case 'radio':
                case 'rating':
                    const checked = document.querySelector(`input[name="${field.id}"]:checked`);
                    data[field.label || field.id] = checked ? checked.value : '';
                    break;
                case 'checkbox':
                    const checkedBoxes = document.querySelectorAll(`input[name="${field.id}"]:checked`);
                    data[field.label || field.id] = Array.from(checkedBoxes).map(cb => cb.value);
                    break;
                case 'file':
                    data[field.label || field.id] = (window.formUploadData && window.formUploadData[field.id]) 
                        ? window.formUploadData[field.id].url 
                        : '';
                    break;
                default:
                    const input = document.getElementById(`field-${field.id}`);
                    data[field.label || field.id] = input ? input.value.trim() : '';
                    break;
            }
        });

        return data;
    }

    /**
     * Validate all fields across all steps
     */
    function validateAllFields() {
        let isValid = true;
        const fields = currentForm.fields || [];

        fields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });

        return isValid;
    }

    /**
     * Submit form response to Firebase
     */
    async function submitForm() {
        // For multi-step, validate current step first
        if (totalSteps > 1 && !validateStep(currentStep)) return;

        // Validate all fields
        if (!validateAllFields()) {
            // Navigate to first step with error
            for (let i = 0; i < totalSteps; i++) {
                if (!validateStep(i)) {
                    goToStep(i);
                    showToast('Please fill in all required fields', 'error');
                    return;
                }
            }
            return;
        }

        setButtonLoading(submitBtn, true);

        try {
            const responseData = {
                submittedAt: getTimestamp(),
                data: collectFormData()
            };

            const responseId = generateId();
            await db.ref(`responses/${currentFormId}/${responseId}`).set(responseData);

            // Clear draft
            localStorage.removeItem(draftKey);

            // Show success
            showState('success');

            // Fire confetti! 🎉
            fireConfetti();

            showToast('Response submitted successfully!', 'success');
        } catch (error) {
            console.error('Submit error:', error);
            showToast('Failed to submit response. Please try again.', 'error');
            setButtonLoading(submitBtn, false);
        }
    }

    /**
     * Fire confetti animation
     */
    function fireConfetti() {
        if (typeof confetti !== 'function') return;

        // First burst
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b']
        });

        // Side bursts
        setTimeout(() => {
            confetti({
                particleCount: 50,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.6 },
                colors: ['#7c3aed', '#06b6d4']
            });
            confetti({
                particleCount: 50,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.6 },
                colors: ['#7c3aed', '#06b6d4']
            });
        }, 200);
    }

    /**
     * Update progress bar
     */
    function updateProgress() {
        const fields = currentForm.fields.filter(f => f.type !== 'heading');
        if (fields.length === 0) return;

        let filled = 0;
        fields.forEach(field => {
            let value = '';
            switch (field.type) {
                case 'radio':
                case 'rating':
                    const checked = document.querySelector(`input[name="${field.id}"]:checked`);
                    value = checked ? checked.value : '';
                    break;
                case 'checkbox':
                    const checkedBoxes = document.querySelectorAll(`input[name="${field.id}"]:checked`);
                    value = checkedBoxes.length > 0 ? 'filled' : '';
                    break;
                case 'file':
                    value = (window.formUploadData && window.formUploadData[field.id]) ? 'uploaded' : '';
                    break;
                default:
                    const input = document.getElementById(`field-${field.id}`);
                    value = input ? input.value.trim() : '';
                    break;
            }
            if (value) filled++;
        });

        const percent = Math.round((filled / fields.length) * 100);
        const fill = progressBar.querySelector('.progress-fill');
        if (fill) fill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${percent}% complete`;
    }

    /**
     * Save draft to localStorage
     */
    function saveDraft() {
        if (!currentForm) return;
        const data = collectFormData();
        try {
            localStorage.setItem(draftKey, JSON.stringify(data));
        } catch (e) {
            // localStorage full or unavailable
        }
    }

    /**
     * Load draft from localStorage
     */
    function loadDraft() {
        try {
            const draft = localStorage.getItem(draftKey);
            if (!draft) return;

            const data = JSON.parse(draft);
            const fields = currentForm.fields || [];

            fields.forEach(field => {
                if (field.type === 'heading') return;
                const savedValue = data[field.label || field.id];
                if (!savedValue) return;

                switch (field.type) {
                    case 'radio':
                    case 'rating':
                        const radio = document.querySelector(`input[name="${field.id}"][value="${savedValue}"]`);
                        if (radio) radio.checked = true;
                        break;
                    case 'checkbox':
                        if (Array.isArray(savedValue)) {
                            savedValue.forEach(val => {
                                const cb = document.querySelector(`input[name="${field.id}"][value="${val}"]`);
                                if (cb) cb.checked = true;
                            });
                        }
                        break;
                    case 'file':
                        // Can't restore file uploads
                        break;
                    default:
                        const input = document.getElementById(`field-${field.id}`);
                        if (input) input.value = savedValue;
                        break;
                }
            });

            showToast('Draft restored from previous visit', 'info');
        } catch (e) {
            // Invalid draft data
        }
    }

    /**
     * Setup form event listeners
     */
    function setupFormEvents() {
        // Navigation buttons
        if (prevBtn) prevBtn.addEventListener('click', () => goToStep(currentStep - 1));
        if (nextBtn) nextBtn.addEventListener('click', () => goToStep(currentStep + 1));

        // Form submit
        if (dynamicForm) {
            dynamicForm.addEventListener('submit', (e) => {
                e.preventDefault();
                submitForm();
            });
        }

        // Submit another
        if (submitAnotherBtn) {
            submitAnotherBtn.addEventListener('click', () => {
                // Reset form
                if (dynamicForm) dynamicForm.reset();
                window.formUploadData = {};
                currentStep = 0;

                // Clear file previews
                document.querySelectorAll('[id^="upload-preview-"]').forEach(el => {
                    el.innerHTML = '';
                });

                // Reset to first step
                document.querySelectorAll('.form-section').forEach((s, i) => {
                    s.classList.toggle('active', i === 0);
                });

                if (totalSteps > 1) {
                    renderStepIndicators();
                    prevBtn.style.display = 'none';
                    nextBtn.style.display = 'flex';
                    submitBtn.style.display = 'none';
                }

                updateProgress();
                showState('form');
            });
        }

        // Auto-save draft & update progress on input
        if (dynamicForm) {
            dynamicForm.addEventListener('input', () => {
                updateProgress();
                saveDraft();
            });
            dynamicForm.addEventListener('change', () => {
                updateProgress();
                saveDraft();
            });
        }

        // Real-time validation on blur
        const fields = currentForm.fields || [];
        fields.forEach(field => {
            if (field.type === 'heading') return;
            const input = document.getElementById(`field-${field.id}`);
            if (input) {
                input.addEventListener('blur', () => validateField(field));
                input.addEventListener('input', () => {
                    const errorEl = document.getElementById(`error-${field.id}`);
                    if (errorEl && errorEl.textContent) {
                        validateField(field);
                    }
                });
            }
        });
    }

    /**
     * Show a specific state
     */
    function showState(state) {
        [loadingState, errorState, landingState, formContainer, successState].forEach(el => {
            if (el) el.classList.add('hidden');
        });

        switch (state) {
            case 'loading':
                if (loadingState) { loadingState.classList.remove('hidden'); loadingState.classList.add('active'); }
                break;
            case 'error':
                if (loadingState) loadingState.classList.remove('active');
                if (errorState) errorState.classList.remove('hidden');
                break;
            case 'landing':
                if (loadingState) loadingState.classList.remove('active');
                if (landingState) landingState.classList.remove('hidden');
                break;
            case 'form':
                if (loadingState) loadingState.classList.remove('active');
                if (formContainer) formContainer.classList.remove('hidden');
                break;
            case 'success':
                if (formContainer) formContainer.classList.add('hidden');
                if (successState) successState.classList.remove('hidden');
                break;
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();

console.log('📝 FormVault Form Renderer loaded');
