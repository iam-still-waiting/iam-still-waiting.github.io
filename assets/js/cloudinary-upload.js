/**
 * FormVault — Cloudinary Upload Integration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://cloudinary.com and sign up / log in
 * 2. Get your Cloud Name from the Dashboard
 * 3. Go to Settings > Upload > Upload Presets
 * 4. Create an UNSIGNED upload preset
 * 5. Replace the values below
 */

// ⚠️ Replace with YOUR Cloudinary credentials
const CLOUDINARY_CLOUD_NAME = "deckxpuqb";
const CLOUDINARY_UPLOAD_PRESET = "Acsmform";
/**
 * Initialize a Cloudinary upload widget for a specific field
 * @param {string} fieldId - The field element ID
 * @param {function} onSuccess - Callback with the uploaded file info
 * @param {function} onProgress - Callback with upload progress (0-100)
 */
function initCloudinaryUpload(fieldId, onSuccess, onProgress) {
    const uploadZone = document.getElementById(`upload-zone-${fieldId}`);
    const previewContainer = document.getElementById(`upload-preview-${fieldId}`);
    const progressContainer = document.getElementById(`upload-progress-${fieldId}`);

    if (!uploadZone) return;

    uploadZone.addEventListener('click', () => {
        // Open Cloudinary Upload Widget
        const widget = cloudinary.createUploadWidget(
            {
                cloudName: CLOUDINARY_CLOUD_NAME,
                uploadPreset: CLOUDINARY_UPLOAD_PRESET,
                sources: ['local', 'url', 'camera'],
                multiple: false,
                maxFileSize: 10000000, // 10MB
                resourceType: 'auto',
                styles: {
                    palette: {
                        window: '#0a0a1a',
                        windowBorder: '#7c3aed',
                        tabIcon: '#06b6d4',
                        menuIcons: '#7c3aed',
                        textDark: '#f0f0f5',
                        textLight: '#a0a0b0',
                        link: '#7c3aed',
                        action: '#06b6d4',
                        inactiveTabIcon: '#555',
                        error: '#ef4444',
                        inProgress: '#7c3aed',
                        complete: '#10b981',
                        sourceBg: '#0f0f2a'
                    },
                    fonts: {
                        default: null,
                        "'Inter', sans-serif": {
                            url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600",
                            active: true
                        }
                    }
                }
            },
            (error, result) => {
                if (error) {
                    console.error('Upload error:', error);
                    showToast('Upload failed. Please try again.', 'error');
                    return;
                }

                if (result.event === 'success') {
                    const info = result.info;
                    const fileData = {
                        url: info.secure_url,
                        publicId: info.public_id,
                        format: info.format,
                        size: info.bytes,
                        width: info.width,
                        height: info.height,
                        originalFilename: info.original_filename
                    };

                    // Show preview
                    if (previewContainer) {
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(info.format);
                        previewContainer.innerHTML = `
                            <div class="file-preview">
                                ${isImage 
                                    ? `<img src="${info.secure_url}" alt="Preview">`
                                    : `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>`
                                }
                                <span class="file-name">${info.original_filename}.${info.format}</span>
                                <span class="file-remove" onclick="removeUpload('${fieldId}')" title="Remove">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
                                </span>
                            </div>
                        `;
                    }

                    // Hide progress
                    if (progressContainer) {
                        progressContainer.style.display = 'none';
                    }

                    if (onSuccess) onSuccess(fileData);
                    showToast('File uploaded successfully!', 'success');
                }

                if (result.event === 'upload-added') {
                    if (progressContainer) {
                        progressContainer.style.display = 'block';
                    }
                }
            }
        );

        widget.open();
    });
}

/**
 * Remove an uploaded file preview
 */
function removeUpload(fieldId) {
    const previewContainer = document.getElementById(`upload-preview-${fieldId}`);
    if (previewContainer) {
        previewContainer.innerHTML = '';
    }
    // Clear the stored value
    if (window.formUploadData) {
        delete window.formUploadData[fieldId];
    }
}

// Global storage for upload data
window.formUploadData = {};

console.log('☁️ FormVault Cloudinary module loaded');
