// script.js
// Configuration - Replace these with your values
const SUPABASE_URL = 'https://wgjxmpahcfhzgflcnlib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnanhtcGFoY2ZoemdmbGNubGliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcyMzQzNjAsImV4cCI6MjA2MjgxMDM2MH0.6ji6OY6-g8IkdVvR6f9iZAN83qJunCN4EjnVey8_LJc';
const GOOGLE_CLOUD_VISION_API_KEY = 'AIzaSyDB9lq0UssbbXndJrwVL-TEaplkbPOmk4w'; // Your actual key

// Initialize Supabase
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// App State
const appState = {
    currentUser: null,
    collections: [],
    currentView: 'signup', // Default view (will be updated by checkAuth)
    activeCollectionId: null,
    activeEntryId: null,
    activeEntries: [],

    newEntrySelectedFiles: [],

    editingEntryOriginal: null,
    editEntryExistingImageUrls: [],
    editEntryFilesToAdd: [],

    currentTags: [],
    aiSuggestedTags: [],
    currentTagName: null,
    taggedEntries: [],
    viewBeforeTagSearch: null,
    entryIdBeforeTagSearch: null,
    collectionIdForEntryBeforeTagSearch: null,
    currentDetailImageIndex: 0,

    isViewingPublicLink: false,
    publicCollectionData: null,
    publicEntries: [],
};

// View Elements (IDs must match HTML)
const views = {
    signup: document.getElementById('signup-view'),
    login: document.getElementById('login-view'),
    home: document.getElementById('home-view'),
    newCollectionModal: document.getElementById('new-collection-modal-view'),
    collectionTimeline: document.getElementById('collection-timeline-view'),
    newEntry: document.getElementById('new-entry-view'),
    entryDetail: document.getElementById('entry-detail-view'),
    editEntry: document.getElementById('edit-entry-view'),
    taggedEntries: document.getElementById('tagged-entries-view'),
    publicCollection: document.getElementById('public-collection-view'),
};

// Form Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const newCollectionForm = document.getElementById('new-collection-form');
const newEntryForm = document.getElementById('new-entry-form');
const editEntryForm = document.getElementById('edit-entry-form');

// Other DOM Elements
const greetingEl = document.getElementById('greeting');
const collectionsContainer = document.getElementById('collections-container');
const noCollectionsMessage = document.getElementById('no-collections-message');
const collectionsLoading = document.getElementById('collections-loading');
const collectionTitleTimeline = document.getElementById('collection-title-timeline');
const entriesTimelineContainer = document.getElementById('entries-timeline-container');
const noEntriesMessage = document.getElementById('no-entries-message');
const entriesLoading = document.getElementById('entries-loading');

const imageUploadInput = document.getElementById('image-upload');
const imageUploadLabel = document.getElementById('image-upload-label');
const imagePreviewsContainer = document.getElementById('image-previews-container');
const imageProcessingLoader = document.getElementById('image-processing-loader');
const entryDateInput = document.getElementById('entry-date');
const datePromptMessage = document.getElementById('date-prompt-message');
const tagBar = document.getElementById('tag-bar');
const editTagBarEl = document.getElementById('edit-tag-bar');
const entryUploadLoader = document.getElementById('entry-upload-loader');

const detailImage = document.getElementById('detail-image');
const detailThumbnailsContainer = document.getElementById('detail-thumbnails-container');
const detailTitle = document.getElementById('detail-title');
const detailNotes = document.getElementById('detail-notes');
const detailTagsContainer = document.getElementById('detail-tags');
const detailMetadata = document.getElementById('detail-metadata');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

const editExistingImagesContainer = document.getElementById('edit-existing-images-container');
const editAddMoreImagesInput = document.getElementById('edit-add-more-images-input');
const editNewImagePreviewsContainer = document.getElementById('edit-new-image-previews-container');

const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxContent = document.getElementById('lightbox-content');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCloseBtn = document.getElementById('lightbox-close');
const lightboxZoomInBtn = document.getElementById('lightbox-zoom-in');
const lightboxZoomOutBtn = document.getElementById('lightbox-zoom-out');

let currentLightboxZoomScale = 1;
const LIGHTBOX_ZOOM_STEP = 0.2;
const LIGHTBOX_MIN_ZOOM = 0.4;
const LIGHTBOX_MAX_ZOOM = 5;

// --- Helper function to safely get image URLs array ---
function getSanitizedImageUrls(entry) {
    if (!entry || !entry.image_urls) return [];
    if (Array.isArray(entry.image_urls)) return entry.image_urls;
    if (typeof entry.image_urls === 'string') {
        try {
            const parsed = JSON.parse(entry.image_urls);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn("Could not parse image_urls string, treating as empty:", entry.image_urls, e);
            return [];
        }
    }
    return []; // Default to empty if not array or parsable string
}


function navigateTo(viewId) {
    appState.currentView = viewId;
    Object.keys(views).forEach(id => {
        views[id].classList.add('hidden');
    });
    if (views[viewId]) {
        views[viewId].classList.remove('hidden');
    }
    window.scrollTo(0, 0);
}

function formatDate(dateStrOrObj) {
    const date = new Date(dateStrOrObj);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function daysBetween(d1Str, d2Str) {
    if (!d1Str || !d2Str) return null;
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    if (isNaN(d1) || isNaN(d2)) return null;
    const laterDate = Math.max(d1.getTime(), d2.getTime());
    const earlierDate = Math.min(d1.getTime(), d2.getTime());
    return Math.ceil((laterDate - earlierDate) / (1000 * 60 * 60 * 24));
}

async function checkAuth() {

    const urlParams = new URLSearchParams(window.location.search);
    const publicCollectionId = urlParams.get('publicCollectionId');

    if (publicCollectionId) {
        appState.isViewingPublicLink = true;
        // Prevent normal auth flow from redirecting if not logged in
        // No need to call supabaseClient.auth.getUser() here for public view
        await displayPublicCollection(publicCollectionId);
        return; // Stop further auth processing for public links
    }
    appState.isViewingPublicLink = false; // Ensure it's reset if not a public link
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
            appState.currentUser = user;
            const { data: profile } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                appState.currentUser.username = profile.username;
                appState.currentUser.phone = profile.phone;
            }

            await loadCollections();
            renderHomeView();
            navigateTo('home');
        } else {
            navigateTo('signup');
        }
    } catch (error) {
        console.error('Auth check error:', error);
        navigateTo('signup');
    }
}

async function displayPublicCollection(collectionId) {
    const publicCollectionTitleEl = document.getElementById('public-collection-title');
    const publicEntriesContainerEl = document.getElementById('public-entries-container');
    const publicNoEntriesMessageEl = document.getElementById('public-no-entries-message');
    const publicEntriesLoadingEl = document.getElementById('public-entries-loading');

    publicEntriesLoadingEl.classList.remove('hidden');
    publicEntriesContainerEl.innerHTML = '';
    navigateTo('publicCollection');

    try {
        // Fetch public collection details (Supabase client uses 'anon' role if not logged in)
        const { data: collection, error: collectionError } = await supabaseClient
            .from('collections')
            .select('id, name, is_public') // Only select what's needed
            .eq('id', collectionId)
            .eq('is_public', true) // Crucial check
            .single();

        if (collectionError || !collection) {
            console.error('Error fetching public collection or collection not public/found:', collectionError);
            publicCollectionTitleEl.textContent = 'Collection Not Found';
            publicNoEntriesMessageEl.textContent = 'This collection is not public or does not exist.';
            publicNoEntriesMessageEl.classList.remove('hidden');
            if (collectionError && collectionError.message.includes("JSON object requested")) {
                 publicNoEntriesMessageEl.textContent = 'This collection is not public or does not exist.';
            }
            return;
        }
        appState.publicCollectionData = collection;
        publicCollectionTitleEl.textContent = collection.name;

        // Fetch entries for this public collection
        const { data: entries, error: entriesError } = await supabaseClient
            .from('entries')
            .select('*') // Select all entry details needed for display
            .eq('collection_id', collection.id)
            .order('date', { ascending: false });

        if (entriesError) throw entriesError;

        appState.publicEntries = entries || [];
        publicNoEntriesMessageEl.classList.toggle('hidden', appState.publicEntries.length > 0);

        appState.publicEntries.forEach((entry, idx) => {
            const tile = document.createElement('div');
            tile.className = 'card grid-entry-tile'; // Use existing styles
            // tile.dataset.id = entry.id; // Not strictly needed if not navigating to detail from here yet

            let badgeHTML = '';
            if (idx < appState.publicEntries.length - 1) {
                const daysDiff = daysBetween(entry.date, appState.publicEntries[idx + 1].date);
                if (daysDiff && daysDiff > 0) {
                    badgeHTML = `<span class="days-since-badge">${daysDiff} day${daysDiff > 1 ? 's' : ''} later</span>`;
                } else if (daysDiff === 0) {
                    badgeHTML = `<span class="days-since-badge">Same day</span>`;
                }
            }
            const entryImageUrls = getSanitizedImageUrls(entry);
            const firstImageUrl = entryImageUrls.length > 0 ? entryImageUrls[0] : '';

            tile.innerHTML = `
                <img src="${firstImageUrl}" alt="${entry.title}" class="grid-entry-image" ${!firstImageUrl ? 'style="background-color: #eee;"' : ''}>
                <div class="grid-entry-info">
                    ${badgeHTML}
                    <h3 class="grid-entry-title">${entry.title}</h3>
                    ${entry.notes ? `<p style="font-size:0.85em; color:var(--text-secondary); margin-top:5px; max-height: 40px; overflow:hidden;">${entry.notes.substring(0,50)}...</p>` : ''}
                </div>`;
            // For public view, clicking tiles could open a read-only detail view (future enhancement)
            // For now, they are just display tiles.
             tile.onclick = () => {
                appState.activeEntryId = entry.id; // Set for detail view
                // We need to pass that we are in public mode to renderEntryDetailView
                renderEntryDetailView(entry, true); // Pass 'isPublicView = true'
                navigateTo('entryDetail');
            };
            publicEntriesContainerEl.appendChild(tile);
        });

    } catch (error) {
        console.error('Error displaying public collection:', error);
        publicCollectionTitleEl.textContent = 'Error Loading Collection';
        publicNoEntriesMessageEl.textContent = 'Could not load this collection.';
        publicNoEntriesMessageEl.classList.remove('hidden');
    } finally {
        publicEntriesLoadingEl.classList.add('hidden');
    }
}

// Modify renderEntryDetailView to accept an 'isPublicView' flag
function renderEntryDetailView(entry, isPublicView = false) { // Added isPublicView
    const entryImageUrls = getSanitizedImageUrls(entry);

    // ... (existing image display logic) ...
    if (!entry || entryImageUrls.length === 0) {
        detailImage.src = '';
        detailImage.alt = 'No image available';
        detailImage.style.cursor = 'default';
        detailImage.onclick = null;
        detailThumbnailsContainer.innerHTML = '';
    } else {
        // appState.currentDetailImageIndex = 0; // This should be handled by displayDetailImage
        displayDetailImage(entry, 0); // Always start with the first image
    }


    detailTitle.textContent = entry.title;
    detailNotes.textContent = entry.notes || 'No notes.';
    detailMetadata.textContent = `Date: ${formatDate(entry.date)}`;

    detailTagsContainer.innerHTML = '';
    (entry.tags || []).forEach(tag => {
        const tagChip = document.createElement('span');
        tagChip.className = 'tag-chip'; // Default, no click for public view of tags
        if (!isPublicView && !appState.isViewingPublicLink) { // Only make clickable if not public
            tagChip.classList.add('clickable-tag');
            tagChip.onclick = () => handleTagClick(tag);
        }
        tagChip.textContent = tag;
        detailTagsContainer.appendChild(tagChip);
    });

    const prevBtn = document.getElementById('prev-entry-btn');
    const nextBtn = document.getElementById('next-entry-btn');
    const editBtn = document.getElementById('edit-entry-btn');
    const deleteEntryBtn = document.getElementById('delete-entry-btn'); // The main delete button for the entry

    if (isPublicView || appState.isViewingPublicLink) { // If it's a public view
        editBtn.classList.add('hidden');
        deleteEntryBtn.classList.add('hidden');
        // Navigation for public entries (if needed)
        const entriesToNavigate = appState.publicEntries;
        const currentPublicIndex = entriesToNavigate.findIndex(e => e.id === entry.id);

        prevBtn.disabled = currentPublicIndex <= 0;
        nextBtn.disabled = currentPublicIndex >= entriesToNavigate.length - 1;

        prevBtn.onclick = () => {
            if (currentPublicIndex > 0) {
                renderEntryDetailView(entriesToNavigate[currentPublicIndex - 1], true);
            }
        };
        nextBtn.onclick = () => {
            if (currentPublicIndex < entriesToNavigate.length - 1) {
                renderEntryDetailView(entriesToNavigate[currentPublicIndex + 1], true);
            }
        };

    } else { // If it's an authenticated user's view
        editBtn.classList.remove('hidden');
        deleteEntryBtn.classList.remove('hidden');

        const idx = appState.activeEntries.findIndex(e => e.id === appState.activeEntryId);
        prevBtn.disabled = idx <= 0; // Use <= 0 to handle empty or single item arrays
        nextBtn.disabled = idx < 0 || idx >= appState.activeEntries.length - 1; // Also handle if not found

        prevBtn.onclick = () => {
            if (idx > 0) { appState.activeEntryId = appState.activeEntries[idx - 1].id; renderEntryDetailView(appState.activeEntries[idx - 1]); }
        };
        nextBtn.onclick = () => {
            if (idx < appState.activeEntries.length - 1) { appState.activeEntryId = appState.activeEntries[idx + 1].id; renderEntryDetailView(appState.activeEntries[idx + 1]); }
        };
    }
}

// Modify back button from detail view
document.getElementById('back-to-timeline-from-detail-btn').onclick = () => {
    if (appState.isViewingPublicLink) {
        displayPublicCollection(appState.publicCollectionData.id); // Go back to public collection view
    } else if (appState.activeCollectionId) {
        renderCollectionTimelineView();
    } else {
        navigateTo('home');
    }
}

async function loadCollections() {
    collectionsLoading.classList.remove('hidden');
    try {
        const { data: collections, error } = await supabaseClient
            .from('collections')
            .select('*')
            .eq('user_id', appState.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        appState.collections = collections || [];

        for (const collection of appState.collections) {
            const { count } = await supabaseClient
                .from('entries')
                .select('*', { count: 'exact', head: true })
                .eq('collection_id', collection.id);
            collection.entryCount = count || 0;

            const { data: lastEntry } = await supabaseClient
                .from('entries')
                .select('date')
                .eq('collection_id', collection.id)
                .order('date', { ascending: false })
                .limit(1)
                .single();
            collection.lastEntryDate = lastEntry?.date;
        }
    } catch (error) {
        console.error('Error loading collections:', error);
    } finally {
        collectionsLoading.classList.add('hidden');
    }
}

async function loadEntries(collectionId) {
    entriesLoading.classList.remove('hidden');
    try {
        const { data: entries, error } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('collection_id', collectionId)
            .order('date', { ascending: false });

        if (error) throw error;
        return entries || [];
    } catch (error) {
        console.error('Error loading entries:', error);
        return [];
    } finally {
        entriesLoading.classList.add('hidden');
    }
}

async function uploadImage(file, userId) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabaseClient.storage
        .from('entry-images')
        .upload(fileName, file, { contentType: file.type, upsert: false });

    if (error) { console.error('Upload error for file ' + file.name + ':', error); throw error; }

    const { data: { publicUrl } } = supabaseClient.storage
        .from('entry-images')
        .getPublicUrl(fileName);
    return publicUrl;
}

async function predictTagsForImage(imgDataURL) {
    if (!GOOGLE_CLOUD_VISION_API_KEY || GOOGLE_CLOUD_VISION_API_KEY === 'YOUR_GOOGLE_CLOUD_VISION_API_KEY_HERE') {
        console.warn("Google Cloud Vision API key not configured. Skipping tag prediction.");
        return [];
    }
    imageProcessingLoader.classList.remove('hidden');
    try {
        const base64Content = imgDataURL.split(',')[1];
        const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_CLOUD_VISION_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{
                    image: { content: base64Content },
                    features: [
                        { type: 'LABEL_DETECTION', maxResults: 7 },
                        { type: 'OBJECT_LOCALIZATION', maxResults: 3 }
                    ]
                }]
            })
        });
        const result = await response.json();
        if (!response.ok || result.error || !result.responses || !result.responses[0]) {
            console.error('Vision API error:', result.error || 'Invalid response');
            return [];
        }
        const labels = result.responses[0].labelAnnotations || [];
        const objects = result.responses[0].localizedObjectAnnotations || [];
        const allPotentialTags = [...labels.map(l => l.description), ...objects.map(o => o.name)];
        const processedTags = allPotentialTags.map(tag => {
            const lowercaseTag = tag.toLowerCase();
            if (lowercaseTag.includes('dog') || lowercaseTag.includes('puppy')) return 'Dog';
            if (lowercaseTag.includes('cat') || lowercaseTag.includes('kitten')) return 'Cat';
            if (lowercaseTag.includes('flower') || lowercaseTag.includes('blossom')) return 'Flowering';
            if (lowercaseTag.includes('plant') || lowercaseTag.includes('flora')) return 'Plant';
            return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
        });
        return [...new Set(processedTags)].filter(Boolean).slice(0, 5);
    } catch (e) {
        console.error("Prediction error:", e);
        return [];
    } finally {
        imageProcessingLoader.classList.add('hidden');
    }
}

function renderHomeView() {
    if (!appState.currentUser) { navigateTo('signup'); return; }
    greetingEl.textContent = `Welcome, ${appState.currentUser.username || appState.currentUser.email.split('@')[0]}!`;
    collectionsContainer.innerHTML = '';
    noCollectionsMessage.classList.toggle('hidden', appState.collections.length > 0);
    appState.collections.forEach(col => {
        const card = document.createElement('div');
        card.className = 'card collection-card';
        card.dataset.id = col.id;
        card.innerHTML = `
            <h3>${col.name}</h3>
            <p>${col.entryCount || 0} entries. ${col.lastEntryDate ? `Last: ${formatDate(col.lastEntryDate)}` : 'No entries yet'}</p>
        `;
        card.onclick = () => {
            appState.activeCollectionId = col.id;
            renderCollectionTimelineView();
        };
        collectionsContainer.appendChild(card);
    });
}

async function renderCollectionTimelineView() {
    const collection = appState.collections.find(c => c.id === appState.activeCollectionId);
    if (!collection) { console.error("Collection not found"); navigateTo('home'); return; }
    collectionTitleTimeline.textContent = collection.name;
    entriesTimelineContainer.innerHTML = '';
    appState.activeEntries = await loadEntries(collection.id);
    noEntriesMessage.classList.toggle('hidden', appState.activeEntries.length > 0);

    appState.activeEntries.forEach((entry, idx) => {
        const tile = document.createElement('div');
        tile.className = 'card grid-entry-tile';
        tile.dataset.id = entry.id;

        let badgeHTML = '';
        if (idx < appState.activeEntries.length - 1) {
            const currentDate = new Date(entry.date);
            const olderEntryDate = new Date(appState.activeEntries[idx + 1].date);

            if (currentDate.getTime() > olderEntryDate.getTime()) {
                const daysDiff = daysBetween(entry.date, appState.activeEntries[idx + 1].date);
                if (daysDiff > 0) {
                    badgeHTML = `<span class="days-since-badge">${daysDiff} day${daysDiff > 1 ? 's' : ''} later</span>`;
                }
            } else if (currentDate.getTime() === olderEntryDate.getTime()) {
                badgeHTML = `<span class="days-since-badge">Same day</span>`;
            }
        }
        const entryImageUrls = getSanitizedImageUrls(entry);
        const firstImageUrl = entryImageUrls.length > 0 ? entryImageUrls[0] : '';

        tile.innerHTML = `
            <img src="${firstImageUrl}" alt="${entry.title}" class="grid-entry-image" ${!firstImageUrl ? 'style="background-color: #eee;"' : ''}>
            <div class="grid-entry-info">
                ${badgeHTML}
                <h3 class="grid-entry-title">${entry.title}</h3>
            </div>`;
        tile.onclick = () => {
            appState.activeEntryId = entry.id;
            renderEntryDetailView(entry);
            navigateTo('entryDetail');
        };
        entriesTimelineContainer.appendChild(tile);
    });
    navigateTo('collectionTimeline');
}

function _renderTagBar(barElement, inputId, selectedTags, suggestedTags, addCustomFn, removeSelectedFn, selectSuggestedFn) {
    const customInputEl = barElement.querySelector(`#${inputId}`);
    const customVal = customInputEl ? customInputEl.value : '';
    barElement.innerHTML = '';

    selectedTags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'suggested-tag selected';
        chip.textContent = tag;
        chip.dataset.tag = tag;
        chip.onclick = () => removeSelectedFn(tag);
        barElement.appendChild(chip);
    });

    suggestedTags.forEach(tag => {
        if (!selectedTags.includes(tag)) {
            const chip = document.createElement('span');
            chip.className = 'suggested-tag';
            chip.textContent = tag;
            chip.dataset.tag = tag;
            chip.onclick = () => selectSuggestedFn(tag);
            barElement.appendChild(chip);
        }
    });

    const newCustomInput = document.createElement('input');
    newCustomInput.type = 'text';
    newCustomInput.id = inputId;
    newCustomInput.placeholder = 'Add custom tag...';
    newCustomInput.value = customVal;
    barElement.appendChild(newCustomInput);
}

function handleAddCustomTagForNewEntry() {
    const input = tagBar.querySelector('#custom-tag-input');
    const tag = input.value.trim();
    if (tag && !appState.currentTags.includes(tag)) {
        appState.currentTags.push(tag);
        appState.aiSuggestedTags = appState.aiSuggestedTags.filter(st => st !== tag);
    }
    input.value = '';
    _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
}
function handleRemoveSelectedTagForNewEntry(tagToRemove) {
    appState.currentTags = appState.currentTags.filter(t => t !== tagToRemove);
    _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
}
function handleSelectSuggestedTagForNewEntry(tagToSelect) {
    if (!appState.currentTags.includes(tagToSelect)) {
        appState.currentTags.push(tagToSelect);
    }
    appState.aiSuggestedTags = appState.aiSuggestedTags.filter(t => t !== tagToSelect);
    _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
}

function handleAddCustomTagForEditEntry() {
    const input = editTagBarEl.querySelector('#edit-custom-tag-input');
    const tag = input.value.trim();
    if (tag && !appState.currentTags.includes(tag)) {
        appState.currentTags.push(tag);
    }
    input.value = '';
    _renderTagBar(editTagBarEl, 'edit-custom-tag-input', appState.currentTags, [], handleAddCustomTagForEditEntry, handleRemoveSelectedTagForEditEntry, () => {});
}
function handleRemoveSelectedTagForEditEntry(tagToRemove) {
    appState.currentTags = appState.currentTags.filter(t => t !== tagToRemove);
    _renderTagBar(editTagBarEl, 'edit-custom-tag-input', appState.currentTags, [], handleAddCustomTagForEditEntry, handleRemoveSelectedTagForEditEntry, () => {});
}

function renderNewEntryForm() {
    newEntryForm.reset();
    imagePreviewsContainer.innerHTML = '';
    imageUploadLabel.classList.remove('hidden');
    datePromptMessage.classList.add('hidden');
    entryDateInput.value = formatDate(new Date());

    appState.newEntrySelectedFiles = [];
    appState.currentTags = [];
    appState.aiSuggestedTags = [];
    _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);

    imageProcessingLoader.classList.add('hidden');
    entryUploadLoader.classList.add('hidden');
}

function renderNewEntryImagePreviews() {
    imagePreviewsContainer.innerHTML = '';
    if (appState.newEntrySelectedFiles.length > 0) {
        imageUploadLabel.classList.add('hidden');
    } else {
        imageUploadLabel.classList.remove('hidden');
    }

    appState.newEntrySelectedFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button type="button" class="remove-preview-btn" data-index="${index}" title="Remove image">×</button>
            `;
            previewItem.querySelector('.remove-preview-btn').onclick = () => {
                appState.newEntrySelectedFiles.splice(index, 1);
                renderNewEntryImagePreviews();
                if(appState.newEntrySelectedFiles.length === 0) {
                     appState.aiSuggestedTags = [];
                     _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
                } else if (index === 0) {
                    processFirstImageForNewEntry();
                }
            };
            imagePreviewsContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

async function processFirstImageForNewEntry() {
    if (appState.newEntrySelectedFiles.length > 0) {
        const firstFile = appState.newEntrySelectedFiles[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const firstImageDataURL = event.target.result;
            EXIF.getData(firstFile, function() {
                let exifDateFound = false;
                const dto = EXIF.getTag(this, "DateTimeOriginal");
                if (dto) {
                    try {
                        const [datePart] = dto.split(' ');
                        const [year, month, day] = datePart.split(':');
                        if (year && month && day && !isNaN(new Date(`${year}-${month}-${day}`))) {
                            entryDateInput.value = `${year}-${month}-${day}`;
                            exifDateFound = true;
                        }
                    } catch (ex) { console.warn("EXIF parse error:", ex); }
                }
                datePromptMessage.classList.toggle('hidden', exifDateFound);
                if (!exifDateFound) datePromptMessage.textContent = 'No date in first image. Set manually or use today.';
            });
            const predictedTags = await predictTagsForImage(firstImageDataURL);
            appState.aiSuggestedTags = predictedTags.filter(pt => !appState.currentTags.includes(pt));
            _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
        };
        reader.readAsDataURL(firstFile);
    } else {
         datePromptMessage.classList.add('hidden');
         appState.aiSuggestedTags = [];
         _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry);
    }
}

function renderEditEntryForm(entry) {
    appState.editingEntryOriginal = JSON.parse(JSON.stringify(entry));
    const existingUrls = getSanitizedImageUrls(entry);
    appState.editEntryExistingImageUrls = [...existingUrls];
    appState.editEntryFilesToAdd = [];

    editExistingImagesContainer.innerHTML = '';
    editNewImagePreviewsContainer.innerHTML = '';

    appState.editEntryExistingImageUrls.forEach((url, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'image-preview-item';
        previewItem.innerHTML = `
            <img src="${url}" alt="Existing image ${index + 1}">
            <button type="button" class="remove-preview-btn" data-url="${url}" title="Remove image">×</button>
        `;
        previewItem.querySelector('.remove-preview-btn').onclick = () => {
            appState.editEntryExistingImageUrls = appState.editEntryExistingImageUrls.filter(imgUrl => imgUrl !== url);
            previewItem.remove();
        };
        editExistingImagesContainer.appendChild(previewItem);
    });

    document.getElementById('edit-entry-date').value = formatDate(entry.date);
    document.getElementById('edit-entry-title').value = entry.title;
    document.getElementById('edit-entry-notes').value = entry.notes || '';
    appState.currentTags = [...(entry.tags || [])];
    _renderTagBar(editTagBarEl, 'edit-custom-tag-input', appState.currentTags, [], handleAddCustomTagForEditEntry, handleRemoveSelectedTagForEditEntry, () => {});
    document.getElementById('edit-upload-loader').classList.add('hidden');
}

function renderEditEntryNewImagePreviews() {
    editNewImagePreviewsContainer.innerHTML = '';
    appState.editEntryFilesToAdd.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'image-preview-item';
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="New preview ${index + 1}">
                <button type="button" class="remove-preview-btn" data-index="${index}" title="Remove new image">×</button>
            `;
            previewItem.querySelector('.remove-preview-btn').onclick = () => {
                appState.editEntryFilesToAdd.splice(index, 1);
                renderEditEntryNewImagePreviews();
            };
            editNewImagePreviewsContainer.appendChild(previewItem);
        };
        reader.readAsDataURL(file);
    });
}

function renderEntryDetailView(entry) {
    const entryImageUrls = getSanitizedImageUrls(entry);

    if (!entry || entryImageUrls.length === 0) {
        detailImage.src = '';
        detailImage.alt = 'No image available';
        detailImage.style.cursor = 'default';
        detailImage.onclick = null;
        detailThumbnailsContainer.innerHTML = '';
    } else {
        appState.currentDetailImageIndex = 0;
        displayDetailImage(entry, appState.currentDetailImageIndex);
    }

    detailTitle.textContent = entry.title;
    detailNotes.textContent = entry.notes || 'No notes.';
    detailMetadata.textContent = `Date: ${formatDate(entry.date)}`;

    detailTagsContainer.innerHTML = '';
    (entry.tags || []).forEach(tag => {
        const tagChip = document.createElement('span');
        tagChip.className = 'tag-chip clickable-tag';
        tagChip.textContent = tag;
        tagChip.dataset.tag = tag;
        tagChip.onclick = () => handleTagClick(tag);
        detailTagsContainer.appendChild(tagChip);
    });

    const idx = appState.activeEntries.findIndex(e => e.id === appState.activeEntryId);
    document.getElementById('prev-entry-btn').disabled = idx === 0;
    document.getElementById('next-entry-btn').disabled = idx === appState.activeEntries.length - 1;
    document.getElementById('prev-entry-btn').onclick = () => {
        if (idx > 0) { appState.activeEntryId = appState.activeEntries[idx - 1].id; renderEntryDetailView(appState.activeEntries[idx - 1]); }
    };
    document.getElementById('next-entry-btn').onclick = () => {
        if (idx < appState.activeEntries.length - 1) { appState.activeEntryId = appState.activeEntries[idx + 1].id; renderEntryDetailView(appState.activeEntries[idx + 1]); }
    };
}

function displayDetailImage(entry, index) {
    const entryImageUrls = getSanitizedImageUrls(entry);
    if (entryImageUrls.length === 0 || index < 0 || index >= entryImageUrls.length) {
        // Fallback if somehow called with invalid index or no images after initial check
        detailImage.src = '';
        detailImage.alt = 'No image available';
        detailImage.style.cursor = 'default';
        detailImage.onclick = null;
        detailThumbnailsContainer.innerHTML = '';
        return;
    }

    appState.currentDetailImageIndex = index;
    const currentImageUrl = entryImageUrls[index];
    detailImage.src = currentImageUrl;
    detailImage.alt = `${entry.title} - Image ${index + 1}`;
    detailImage.style.cursor = 'zoom-in';
    detailImage.onclick = () => openLightbox(currentImageUrl);

    detailThumbnailsContainer.innerHTML = '';
    entryImageUrls.forEach((url, i) => {
        const thumb = document.createElement('img');
        thumb.src = url;
        thumb.alt = `Thumbnail ${i + 1}`;
        thumb.className = 'detail-thumbnail';
        if (i === index) {
            thumb.classList.add('active-thumb');
        }
        thumb.onclick = () => displayDetailImage(entry, i);
        detailThumbnailsContainer.appendChild(thumb);
    });
}


async function handleTagClick(tagName) {
    appState.currentTagName = tagName;
    appState.viewBeforeTagSearch = appState.currentView;
    appState.entryIdBeforeTagSearch = appState.activeEntryId;
    appState.collectionIdForEntryBeforeTagSearch = appState.activeCollectionId;

    document.getElementById('tagged-entries-loading').classList.remove('hidden');
    document.getElementById('tagged-entries-container').innerHTML = '';
    document.getElementById('no-tagged-entries-message').classList.add('hidden');
    navigateTo('taggedEntries');

    const entries = await fetchEntriesByTag(tagName);
    appState.taggedEntries = entries;
    renderTaggedEntriesView(tagName, entries);
    document.getElementById('tagged-entries-loading').classList.add('hidden');
}

async function fetchEntriesByTag(tagName) {
    try {
        const { data: userCollectionObjects, error: collectionError } = await supabaseClient
            .from('collections')
            .select('id')
            .eq('user_id', appState.currentUser.id);

        if (collectionError) throw collectionError;
        if (!userCollectionObjects || userCollectionObjects.length === 0) return [];

        const userCollectionIds = userCollectionObjects.map(c => c.id);

        const { data: entries, error: entriesError } = await supabaseClient
            .from('entries')
            .select('*')
            .in('collection_id', userCollectionIds)
            .contains('tags', [tagName])
            .order('date', { ascending: false });

        if (entriesError) throw entriesError;
        return entries || [];
    } catch (error) {
        console.error(`Error in fetchEntriesByTag for tag "${tagName}":`, error);
        const noTaggedMsg = document.getElementById('no-tagged-entries-message');
        noTaggedMsg.textContent = `Error loading entries. Please check console.`;
        noTaggedMsg.classList.remove('hidden');
        return [];
    }
}

function renderTaggedEntriesView(tagName, entries) {
    document.getElementById('tagged-entries-title').textContent = `Entries tagged: "${tagName}"`;
    const container = document.getElementById('tagged-entries-container');
    container.innerHTML = '';

    const noTaggedMsg = document.getElementById('no-tagged-entries-message');
    noTaggedMsg.classList.toggle('hidden', entries.length > 0);
    if (entries.length === 0 && !noTaggedMsg.textContent.startsWith("Error")) {
         noTaggedMsg.textContent = 'No entries found with this tag.';
    }

    entries.forEach((entry, idx) => {
        const tile = document.createElement('div');
        tile.className = 'card grid-entry-tile';
        tile.dataset.id = entry.id;

        let badgeHTML = '';
        if (idx < entries.length - 1) {
            const currentDate = new Date(entry.date);
            const olderEntryDate = new Date(entries[idx + 1].date);

            if (currentDate.getTime() > olderEntryDate.getTime()) {
                const daysDiff = daysBetween(entry.date, entries[idx + 1].date);
                if (daysDiff > 0) {
                    badgeHTML = `<span class="days-since-badge">${daysDiff} day${daysDiff > 1 ? 's' : ''} later</span>`;
                }
            } else if (currentDate.getTime() === olderEntryDate.getTime()) {
                badgeHTML = `<span class="days-since-badge">Same day</span>`;
            }
        }
        const entryImageUrls = getSanitizedImageUrls(entry);
        const firstImageUrl = entryImageUrls.length > 0 ? entryImageUrls[0] : '';

        tile.innerHTML = `
            <img src="${firstImageUrl}" alt="${entry.title}" class="grid-entry-image" ${!firstImageUrl ? 'style="background-color: #eee;"' : ''}>
            <div class="grid-entry-info">
                ${badgeHTML}
                <h3 class="grid-entry-title">${entry.title}</h3>
            </div>`;
        tile.onclick = async () => {
            appState.activeEntryId = entry.id;
            appState.activeCollectionId = entry.collection_id;
            appState.activeEntries = await loadEntries(entry.collection_id);
            const fullEntryData = appState.activeEntries.find(e => e.id === entry.id) || entry; // Prefer fresh load
            renderEntryDetailView(fullEntryData);
            navigateTo('entryDetail');
        };
        container.appendChild(tile);
    });
}

function applyLightboxZoom() {
    lightboxImage.style.transform = `scale(${currentLightboxZoomScale})`;
    if (currentLightboxZoomScale > 1) {
        lightboxContent.style.cursor = 'grab';
        lightboxContent.style.overflow = 'auto';
    } else {
        lightboxContent.style.cursor = 'default';
        lightboxContent.style.overflow = 'hidden';
    }
}

function openLightbox(imageUrl) {
    if (!imageUrl) return; // Don't open if no URL
    lightboxImage.src = imageUrl;
    currentLightboxZoomScale = 1;
    applyLightboxZoom();
    lightboxOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleLightboxEscKey);
}

function closeLightbox() {
    lightboxOverlay.classList.add('hidden');
    lightboxImage.src = '#';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleLightboxEscKey);
    lightboxContent.style.cursor = 'default';
    lightboxContent.scrollTop = 0;
    lightboxContent.scrollLeft = 0;
}

function handleLightboxEscKey(event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
}

function zoomInLightbox() {
    if (currentLightboxZoomScale < LIGHTBOX_MAX_ZOOM) {
        currentLightboxZoomScale += LIGHTBOX_ZOOM_STEP;
        if (currentLightboxZoomScale > LIGHTBOX_MAX_ZOOM) currentLightboxZoomScale = LIGHTBOX_MAX_ZOOM;
    }
    applyLightboxZoom();
}

function zoomOutLightbox() {
    if (currentLightboxZoomScale > LIGHTBOX_MIN_ZOOM) {
        currentLightboxZoomScale -= LIGHTBOX_ZOOM_STEP;
        if (currentLightboxZoomScale < LIGHTBOX_MIN_ZOOM) currentLightboxZoomScale = LIGHTBOX_MIN_ZOOM;
    }
    applyLightboxZoom();
}


// --- Event Handlers ---
// Ensure forms exist before attaching handlers, or defer script execution
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault(); loginError.classList.add('hidden'); loginError.textContent = '';
        const emailVal = document.getElementById('login-email').value;
        const passwordVal = document.getElementById('login-password').value;
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email: emailVal, password: passwordVal });
            if (error) throw error;
            await checkAuth();
        } catch (error) { loginError.textContent = error.message; loginError.classList.remove('hidden'); }
    };
}

if (signupForm) {
    signupForm.onsubmit = async (e) => {
        e.preventDefault();
        signupError.classList.add('hidden');
        signupError.textContent = '';
        const usernameVal = document.getElementById('username').value;
        const phoneVal = document.getElementById('phone').value;
        const emailVal = document.getElementById('email').value;
        const passwordVal = document.getElementById('password').value;

        console.log('Signup attempt with:', { usernameVal, phoneVal, emailVal });

        try {
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email: emailVal, password: passwordVal });
            console.log('Auth signup response:', { authData: authData ? 'User/Session present' : 'No user/session', authError });

            if (authError) {
                console.error('Auth signup failed:', JSON.stringify(authError, null, 2));
                throw authError; // Re-throw to be caught by the outer catch
            }

            if (authData && authData.user) { // Check both authData and authData.user
                console.log('Auth user created, ID:', authData.user.id);
                console.log('Attempting to insert profile with data:', {
                    // Ensure these key names match your 'profiles' table column names EXACTLY
                    id: authData.user.id,       // Or user_id: authData.user.id if your column is user_id
                    username: usernameVal,
                    phone: phoneVal
                });

                // ***** THIS IS THE PROFILE INSERTION CODE *****
                const { data: newProfile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .insert({
                        // Ensure these key names match your 'profiles' table column names EXACTLY
                        id: authData.user.id,       // Or user_id: authData.user.id
                        username: usernameVal,
                        phone: phoneVal
                    })
                    .select() // IMPORTANT: To get back the inserted row or a more detailed error
                    .single(); // .single() ensures we expect one row back or a specific error if not.

                if (profileError) {
                    console.error('PROFILE INSERTION FAILED. Error details:', JSON.stringify(profileError, null, 2));
                    signupError.textContent = 'Account created, but profile setup failed. Please contact support. (Error code: PIF)';
                    signupError.classList.remove('hidden');
                    signupError.style.color = 'var(--danger-color)';
                    return; // Stop if profile creation fails
                }

                console.log('Profile inserted successfully:', newProfile);
                // Update appState.currentUser immediately with profile info
                // Note: authData.user might not have custom claims/metadata yet.
                // We are constructing a more complete currentUser object here.
                appState.currentUser = {
                    id: authData.user.id,
                    email: authData.user.email,
                    // Add other fields from authData.user if needed (e.g., created_at)
                    username: newProfile.username, // Use username from the successfully inserted profile
                    phone: newProfile.phone      // Use phone from the successfully inserted profile
                };


                if (authData.session) { // User is immediately active (e.g., email confirmation disabled or auto-confirmed)
                    console.log('Session available post-signup, proceeding to checkAuth (which will re-fetch profile if needed).');
                    await checkAuth(); // checkAuth will re-fetch profile if necessary and navigate
                } else { // Email confirmation likely required
                    console.log('Email confirmation required for new user.');
                    signupError.textContent = 'Account created! Please check your email to confirm and then log in.';
                    signupError.classList.remove('hidden');
                    signupError.style.color = 'var(--primary-accent)';
                    setTimeout(() => navigateTo('login'), 4000);
                }
            } else {
                // This case should ideally not be reached if authError is null,
                // as auth.signUp should return { data: { user: User, session: Session | null }, error: null } on success.
                console.warn('Auth signup successful but no user or session data returned in authData. This is unexpected.');
                signupError.textContent = 'An unexpected issue occurred during signup (Code: ASU_ND). Please try again.';
                signupError.classList.remove('hidden');
                signupError.style.color = 'var(--danger-color)';
            }
        } catch (error) { // Catch errors from auth.signUp or any re-thrown profileError
            console.error('Overall signup process error:', error);
            signupError.textContent = error.message || 'An error occurred during signup.';
            signupError.classList.remove('hidden');
            signupError.style.color = 'var(--danger-color)';
        }
    };
}

document.getElementById('sign-out-btn').onclick = async () => {
    if (confirm("Are you sure you want to sign out?")) {
        await supabaseClient.auth.signOut();
        appState.currentUser = null; appState.collections = []; appState.activeCollectionId = null; appState.activeEntryId = null;
        navigateTo('login');
    }
};

document.getElementById('new-collection-btn-home').onclick = () => { document.getElementById('collection-name').value = ''; navigateTo('newCollectionModal'); };
document.getElementById('cancel-new-collection-btn').onclick = () => navigateTo('home');

if (newCollectionForm) {
    newCollectionForm.onsubmit = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabaseClient.from('collections').insert({ name: document.getElementById('collection-name').value, user_id: appState.currentUser.id }).select().single();
            if (error) throw error;
            await loadCollections(); renderHomeView(); navigateTo('home');
        } catch (error) { console.error('Error creating collection:', error); alert('Error creating collection.'); }
    };
}

document.getElementById('back-to-home-btn').onclick = () => navigateTo('home');
document.getElementById('add-entry-fab').onclick = () => { renderNewEntryForm(); navigateTo('newEntry'); };
document.getElementById('back-to-timeline-btn').onclick = () => { appState.activeCollectionId ? renderCollectionTimelineView() : navigateTo('home'); };

if (imageUploadInput) {
    imageUploadInput.onchange = e => {
        appState.newEntrySelectedFiles = Array.from(e.target.files);
        renderNewEntryImagePreviews();
        processFirstImageForNewEntry();
    };
}

document.getElementById('add-custom-tag-btn').onclick = handleAddCustomTagForNewEntry;
if (tagBar) {
    tagBar.addEventListener('keypress', e => { if (e.target.id === 'custom-tag-input' && e.key === 'Enter') { e.preventDefault(); handleAddCustomTagForNewEntry(); }});
}

if (newEntryForm) {
    newEntryForm.onsubmit = async (e) => {
        e.preventDefault();
        if (appState.newEntrySelectedFiles.length === 0) {
            alert("Please select at least one image."); return;
        }
        entryUploadLoader.classList.remove('hidden');
        document.getElementById('create-entry-btn').disabled = true;

        try {
            const uploadedImageUrls = [];
            for (const file of appState.newEntrySelectedFiles) {
                const url = await uploadImage(file, appState.currentUser.id); // Corrected from imageUrl to url
                uploadedImageUrls.push(url);
            }

            const entryData = {
                collection_id: appState.activeCollectionId,
                title: document.getElementById('entry-title').value,
                notes: document.getElementById('entry-notes').value,
                date: entryDateInput.value,
                image_urls: uploadedImageUrls,
                tags: appState.currentTags.filter(Boolean)
            };
            const { error } = await supabaseClient.from('entries').insert(entryData).select().single();
            if (error) throw error;

            appState.newEntrySelectedFiles = [];
            imagePreviewsContainer.innerHTML = '';
            imageUploadLabel.classList.remove('hidden');

            await renderCollectionTimelineView();
        } catch (error) {
            console.error('Error in entry creation process:', error);
            alert(`Error creating entry: ${error.message}`);
        } finally {
            entryUploadLoader.classList.add('hidden');
            document.getElementById('create-entry-btn').disabled = false;
        }
    };
}

document.getElementById('back-to-timeline-from-detail-btn').onclick = () => { appState.activeCollectionId ? renderCollectionTimelineView() : navigateTo('home'); };

document.getElementById('back-from-tagged-view-btn').onclick = async () => {
    if (appState.viewBeforeTagSearch === 'entryDetail' && appState.entryIdBeforeTagSearch && appState.collectionIdForEntryBeforeTagSearch) {
        appState.activeEntryId = appState.entryIdBeforeTagSearch;
        appState.activeCollectionId = appState.collectionIdForEntryBeforeTagSearch;
        appState.activeEntries = await loadEntries(appState.activeCollectionId);
        const originalEntry = appState.activeEntries.find(e => e.id === appState.entryIdBeforeTagSearch);
        if (originalEntry) {
            renderEntryDetailView(originalEntry);
            navigateTo('entryDetail');
        } else {
            navigateTo('home');
        }
    } else {
         appState.activeCollectionId ? renderCollectionTimelineView() : navigateTo('home');
    }
};


document.getElementById('delete-collection-btn').onclick = async () => {
    const col = appState.collections.find(c => c.id === appState.activeCollectionId);
    if (!col || !confirm(`Delete collection "${col.name}" and ALL its entries? This cannot be undone.`)) return;
    try {
        // Delete entries first (if foreign key cascades are not set up, this is safer)
        const { error: entriesError } = await supabaseClient.from('entries').delete().eq('collection_id', appState.activeCollectionId);
        if (entriesError) throw entriesError;

        const { error } = await supabaseClient.from('collections').delete().eq('id', appState.activeCollectionId);
        if (error) throw error;

        appState.activeCollectionId = null; await loadCollections(); renderHomeView(); navigateTo('home');
    } catch (error) { console.error('Error deleting collection:', error); alert('Error deleting collection.'); }
};

document.getElementById('delete-entry-btn').onclick = async () => {
    if (!appState.activeEntryId || !confirm("Are you sure you want to delete this entry?")) return;
    try {
        const { error } = await supabaseClient.from('entries').delete().eq('id', appState.activeEntryId);
        if (error) throw error;
        appState.activeEntryId = null; await renderCollectionTimelineView();
    } catch (error) { console.error('Error deleting entry:', error); alert('Error deleting entry.'); }
};

document.getElementById('switch-to-signup').onclick = () => navigateTo('signup');
document.getElementById('switch-to-login').onclick = () => navigateTo('login');

document.getElementById('edit-entry-btn').onclick = () => {
    const entry = appState.activeEntries.find(e => e.id === appState.activeEntryId);
    if (entry) { renderEditEntryForm(entry); navigateTo('editEntry'); }
};
document.getElementById('back-to-detail-btn').onclick = () => {
    const entry = appState.activeEntries.find(e => e.id === appState.activeEntryId) || appState.editingEntryOriginal;
    if (entry) { renderEntryDetailView(entry); navigateTo('entryDetail'); }
    else { renderCollectionTimelineView(); }
};

if (editAddMoreImagesInput) {
    editAddMoreImagesInput.onchange = (e) => {
        appState.editEntryFilesToAdd = Array.from(e.target.files);
        renderEditEntryNewImagePreviews();
    };
}

document.getElementById('edit-add-custom-tag-btn').onclick = handleAddCustomTagForEditEntry;
if (editTagBarEl) {
    editTagBarEl.addEventListener('keypress', e => { if (e.target.id === 'edit-custom-tag-input' && e.key === 'Enter') { e.preventDefault(); handleAddCustomTagForEditEntry(); }});
}

if (editEntryForm) {
    editEntryForm.onsubmit = async (e) => {
        e.preventDefault();
        const editLoader = document.getElementById('edit-upload-loader');
        const saveBtn = document.getElementById('save-entry-btn');
        editLoader.classList.remove('hidden');
        saveBtn.disabled = true;

        try {
            const newUploadedImageUrls = [];
            for (const file of appState.editEntryFilesToAdd) {
                const url = await uploadImage(file, appState.currentUser.id);
                newUploadedImageUrls.push(url);
            }

            const finalImageUrls = [...appState.editEntryExistingImageUrls, ...newUploadedImageUrls];

            const updatedEntryData = {
                title: document.getElementById('edit-entry-title').value,
                notes: document.getElementById('edit-entry-notes').value,
                date: document.getElementById('edit-entry-date').value,
                tags: appState.currentTags.filter(Boolean),
                image_urls: finalImageUrls
            };

            const { error } = await supabaseClient
                .from('entries')
                .update(updatedEntryData)
                .eq('id', appState.activeEntryId);

            if (error) throw error;

            appState.activeEntries = await loadEntries(appState.activeCollectionId);
            const updatedEntry = appState.activeEntries.find(entry => entry.id === appState.activeEntryId);

            if (updatedEntry) {
                renderEntryDetailView(updatedEntry);
                navigateTo('entryDetail');
            } else {
                renderCollectionTimelineView();
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            alert('Error updating entry.');
        } finally {
            editLoader.classList.add('hidden');
            saveBtn.disabled = false;
            appState.editEntryFilesToAdd = [];
            // appState.editEntryExistingImageUrls is implicitly reset when renderEditEntryForm is called
            editNewImagePreviewsContainer.innerHTML = '';
        }
    };
}

let touchstartX = 0, touchendX = 0;
const entryDetailViewEl = views.entryDetail;
function handleSwipe() {
    const swipeThreshold = 50;
    if (touchendX < touchstartX - swipeThreshold) document.getElementById('next-entry-btn').click();
    if (touchendX > touchstartX + swipeThreshold) document.getElementById('prev-entry-btn').click();
}
if (entryDetailViewEl) {
    entryDetailViewEl.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true});
    entryDetailViewEl.addEventListener('touchend', e => { touchendX = e.changedTouches[0].screenX; handleSwipe(); }, {passive: true});
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initial auth check to set up the app
    await checkAuth();

    // Lightbox event listeners
    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (lightboxZoomInBtn) lightboxZoomInBtn.addEventListener('click', zoomInLightbox);
    if (lightboxZoomOutBtn) lightboxZoomOutBtn.addEventListener('click', zoomOutLightbox);
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener('click', (event) => {
            if (event.target === lightboxOverlay) { // Clicked on overlay itself, not content
                closeLightbox();
                
    const generatePublicLinkBtn = document.getElementById('generate-public-link-btn');
if (generatePublicLinkBtn) {
    generatePublicLinkBtn.onclick = async () => {
        if (!appState.currentUser || !appState.activeCollectionId) {
            alert("Cannot generate link. Please ensure you are logged in and viewing a collection.");
            return;
        }

        try {
            // 1. Update the collection to be public
            const { data, error } = await supabaseClient
                .from('collections')
                .update({ is_public: true })
                .eq('id', appState.activeCollectionId)
                .eq('user_id', appState.currentUser.id) // Ensure only owner can make public
                .select('name') // get name for confirmation
                .single();

            if (error) throw error;
            if (!data) {
                alert("Could not update collection. You might not be the owner.");
                return;
            }


            // 2. Construct the link
            const publicLink = `${window.location.origin}${window.location.pathname}?publicCollectionId=${appState.activeCollectionId}`;

            // 3. Copy to clipboard
            if (navigator.clipboard && window.isSecureContext) { // Check if clipboard API is available
                await navigator.clipboard.writeText(publicLink);
                alert(`Public link for "${data.name}" copied to clipboard!\n${publicLink}\n\nTo make it private again, you'll need a 'Make Private' button (not yet implemented).`);
            } else {
                // Fallback for non-secure contexts or older browsers
                prompt(`Public link for "${data.name}" (Copy this manually):`, publicLink);
            }

            // Visually update the button state if needed (e.g., change text to "Link Copied" or "View Public")
            // Also update the local appState.collections if you want to reflect is_public immediately
            const collectionInState = appState.collections.find(c => c.id === appState.activeCollectionId);
            if (collectionInState) {
                collectionInState.is_public = true;
                // You might want to change the button text or disable it,
                // or change it to a "Make Private" button.
                generatePublicLinkBtn.textContent = "Public Link Shared";
                // generatePublicLinkBtn.disabled = true; // Or change functionality
            }


        } catch (error) {
            console.error('Error generating public link:', error);
            alert('Error making collection public: ' + error.message);
        }
    };
}
            }
        });
    }
});
