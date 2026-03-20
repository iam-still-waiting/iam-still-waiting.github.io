/**
 * FormVault — Cloudinary Upload (Native File Input)
 * Mobile-compatible: uses native file picker + Cloudinary REST API
 */

const CLOUDINARY_CLOUD_NAME = "deckxpuqb";
const CLOUDINARY_UPLOAD_PRESET = "Acsmform";

function initCloudinaryUpload(fieldId, onSuccess, onProgress) {
    const uploadZone = document.getElementById('upload-zone-' + fieldId);
    const previewContainer = document.getElementById('upload-preview-' + fieldId);
    if (!uploadZone) return;

    // Create hidden native file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.zip';
    fileInput.style.display = 'none';
    fileInput.id = 'file-input-' + fieldId;
    uploadZone.parentNode.insertBefore(fileInput, uploadZone.nextSibling);

    uploadZone.addEventListener('click', function () {
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        const file = fileInput.files[0];
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showToast('File is too large. Maximum 10MB allowed.', 'error');
            fileInput.value = '';
            return;
        }
        uploadToCloudinary(file, fieldId, previewContainer, onSuccess, onProgress);
    });
}

function uploadToCloudinary(file, fieldId, previewContainer, onSuccess, onProgress) {
    const uploadZone = document.getElementById('upload-zone-' + fieldId);

    if (uploadZone) {
        uploadZone.innerHTML = '<p>Uploading...</p><p class="small-text">Please wait</p>';
        uploadZone.style.opacity = '0.6';
        uploadZone.style.pointerEvents = 'none';
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/auto/upload', true);

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            if (uploadZone) uploadZone.innerHTML = '<p>Uploading ' + pct + '%</p><p class="small-text">Please wait</p>';
            if (onProgress) onProgress(pct);
        }
    };

    xhr.onload = function () {
        if (uploadZone) {
            uploadZone.style.opacity = '1';
            uploadZone.style.pointerEvents = 'auto';
            uploadZone.innerHTML = '<p>Click to upload</p><p class="small-text">Max 10MB</p>';
        }
        if (xhr.status === 200) {
            const info = JSON.parse(xhr.responseText);
            const fileData = {
                url: info.secure_url,
                publicId: info.public_id,
                format: info.format,
                size: info.bytes,
                width: info.width,
                height: info.height,
                originalFilename: info.original_filename
            };
            if (!window.formUploadData) window.formUploadData = {};
            window.formUploadData[fieldId] = fileData;

            if (previewContainer) {
                const isImage = ['jpg','jpeg','png','gif','webp','svg'].includes((info.format||'').toLowerCase());
                previewContainer.innerHTML =
                    '<div class="file-preview">' +
                    (isImage ? '<img src="' + info.secure_url + '" alt="Preview" style="max-width:100%;max-height:200px;border-radius:8px;">'
                             : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>') +
                    '<span class="file-name">' + (info.original_filename||'file') + '.' + info.format + '</span>' +
                    '<span class="file-remove" onclick="removeUpload(\'' + fieldId + '\')" title="Remove">' +
                    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>' +
                    '</span></div>';
            }
            if (onSuccess) onSuccess(fileData);
            showToast('File uploaded successfully!', 'success');
        } else {
            showToast('Upload failed. Please try again.', 'error');
        }
    };

    xhr.onerror = function () {
        if (uploadZone) {
            uploadZone.style.opacity = '1';
            uploadZone.style.pointerEvents = 'auto';
            uploadZone.innerHTML = '<p>Click to upload</p><p class="small-text">Max 10MB</p>';
        }
        showToast('Upload failed. Check your connection.', 'error');
    };

    xhr.send(formData);
}

function removeUpload(fieldId) {
    const previewContainer = document.getElementById('upload-preview-' + fieldId);
    const fileInput = document.getElementById('file-input-' + fieldId);
    if (previewContainer) previewContainer.innerHTML = '';
    if (fileInput) fileInput.value = '';
    if (window.formUploadData) delete window.formUploadData[fieldId];
}

window.formUploadData = {};
console.log('☁️ FormVault Cloudinary (native) module loaded');
