// script.js
// Configuration
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
    currentView: 'signup',
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

// View Elements
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

// --- Helper Functions ---
function getSanitizedImageUrls(entry) {
    if (!entry || !entry.image_urls) return [];
    if (Array.isArray(entry.image_urls)) return entry.image_urls;
    if (typeof entry.image_urls === 'string') {
        try {
            const parsed = JSON.parse(entry.image_urls);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn("Could not parse image_urls string:", entry.image_urls, e);
            return [];
        }
    }
    return [];
}

function navigateTo(viewId) {
    appState.currentView = viewId;
    Object.keys(views).forEach(id => {
        if (views[id]) views[id].classList.add('hidden');
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

// --- Auth and Data Loading ---
async function checkAuth() {
    console.log("checkAuth called");
    const urlParams = new URLSearchParams(window.location.search);
    const publicCollectionId = urlParams.get('publicCollectionId');

    if (publicCollectionId) {
        console.log("Public collection ID found in URL:", publicCollectionId);
        appState.isViewingPublicLink = true;
        await displayPublicCollection(publicCollectionId);
        return;
    }
    appState.isViewingPublicLink = false;

    try {
        const { data: { user }, error: getUserError } = await supabaseClient.auth.getUser();
        console.log("getUser response:", { user, getUserError });

        if (getUserError) {
            console.error("Error from getUser():", getUserError);
            // Potentially navigate to login if token is invalid/expired
            navigateTo('login');
            return;
        }

        if (user) {
            appState.currentUser = { ...user }; // Spread to make a mutable copy
            console.log("User is authenticated:", appState.currentUser.id);

            const { data: profile, error: profileError } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            console.log("Profile fetch response:", { profile, profileError });

            if (profileError && profileError.code !== 'PGRST116') { // PGRST116: "Exact one row not found"
                console.error("Error fetching profile (not PGRST116):", profileError);
                // Decide how to handle - maybe user can continue without full profile, or show error
            } else if (profileError && profileError.code === 'PGRST116') {
                 console.warn("Profile not found for user:", user.id, "(PGRST116). This might be expected if profile creation is pending or failed.");
                 // If profile is essential, navigate to a "complete profile" view
                 // For now, we'll proceed, and username will be derived from email.
            }


            if (profile) {
                appState.currentUser.username = profile.username;
                appState.currentUser.phone = profile.phone;
            } else {
                console.log("No profile found in DB for user:", user.id, "Username will be derived from email.");
            }

            await loadCollections();
            renderHomeView();
            navigateTo('home');
        } else {
            console.log("No authenticated user session found.");
            navigateTo('signup');
        }
    } catch (error) {
        console.error('Critical error in checkAuth process:', error);
        navigateTo('login'); // Fallback to login on unexpected errors
    }
}

async function displayPublicCollection(collectionId) {
    // ... (displayPublicCollection function as previously provided, seems okay) ...
    const publicCollectionTitleEl = document.getElementById('public-collection-title');
    const publicEntriesContainerEl = document.getElementById('public-entries-container');
    const publicNoEntriesMessageEl = document.getElementById('public-no-entries-message');
    const publicEntriesLoadingEl = document.getElementById('public-entries-loading');

    publicEntriesLoadingEl.classList.remove('hidden');
    publicEntriesContainerEl.innerHTML = '';
    navigateTo('publicCollection');

    try {
        const { data: collection, error: collectionError } = await supabaseClient
            .from('collections')
            .select('id, name, is_public')
            .eq('id', collectionId)
            .eq('is_public', true)
            .single();

        if (collectionError || !collection) {
            console.error('Error fetching public collection or collection not public/found:', collectionError);
            publicCollectionTitleEl.textContent = 'Collection Not Found';
            publicNoEntriesMessageEl.textContent = 'This collection is not public or does not exist.';
            publicNoEntriesMessageEl.classList.remove('hidden');
            if (collectionError && collectionError.code === 'PGRST116') { // PGRST116: "Exact one row not found"
                 publicNoEntriesMessageEl.textContent = 'This collection is not public or does not exist.';
            }
            return;
        }
        appState.publicCollectionData = collection;
        publicCollectionTitleEl.textContent = collection.name;

        const { data: entries, error: entriesError } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('collection_id', collection.id)
            .order('date', { ascending: false });

        if (entriesError) throw entriesError;

        appState.publicEntries = entries || [];
        publicNoEntriesMessageEl.classList.toggle('hidden', appState.publicEntries.length > 0);

        appState.publicEntries.forEach((entry, idx) => {
            const tile = document.createElement('div');
            tile.className = 'card grid-entry-tile';
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
                    ${entry.notes ? `<p style="font-size:0.85em; color:var(--text-secondary); margin-top:5px; max-height: 40px; overflow:hidden; text-overflow: ellipsis; white-space: nowrap;">${entry.notes}</p>` : ''}
                </div>`;
             tile.onclick = () => {
                appState.activeEntryId = entry.id;
                renderEntryDetailView(entry, true);
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


async function loadCollections() {
    collectionsLoading.classList.remove('hidden');
    noCollectionsMessage.classList.add('hidden'); // Hide initially
    collectionsContainer.innerHTML = ''; // Clear previous
    try {
        if (!appState.currentUser || !appState.currentUser.id) {
            console.warn("loadCollections called without a current user ID.");
            return;
        }
        const { data: collections, error } = await supabaseClient
            .from('collections')
            .select('*')
            .eq('user_id', appState.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        appState.collections = collections || [];

        for (const collection of appState.collections) {
            const { count, error: countError } = await supabaseClient
                .from('entries')
                .select('*', { count: 'exact', head: true })
                .eq('collection_id', collection.id);
            if (countError) console.error("Error getting entry count for collection", collection.id, countError);
            collection.entryCount = count || 0;

            let lastEntryDate = null;
            try {
                const { data: lastEntryData, error: lastEntryError } = await supabaseClient
                    .from('entries')
                    .select('date')
                    .eq('collection_id', collection.id)
                    .order('date', { ascending: false })
                    .limit(1)
                    .single();
                if (lastEntryError && lastEntryError.code !== 'PGRST116') {
                    console.error(`Error fetching last entry date for collection ${collection.id}:`, lastEntryError);
                } else if (lastEntryData) {
                    lastEntryDate = lastEntryData.date;
                }
            } catch (catchError) {
                 console.error(`Unexpected catch fetching last entry for coll ${collection.id}:`, catchError);
            }
            collection.lastEntryDate = lastEntryDate;
        }
        noCollectionsMessage.classList.toggle('hidden', appState.collections.length > 0);
    } catch (error) {
        console.error('Error loading collections:', error);
        noCollectionsMessage.textContent = "Could not load collections.";
        noCollectionsMessage.classList.remove('hidden');
    } finally {
        collectionsLoading.classList.add('hidden');
    }
}
// ... (loadEntries, uploadImage, predictTagsForImage as previously provided - seem okay)
async function loadEntries(collectionId) {
    entriesLoading.classList.remove('hidden');
    noEntriesMessage.classList.add('hidden');
    entriesTimelineContainer.innerHTML = '';
    try {
        const { data: entries, error } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('collection_id', collectionId)
            .order('date', { ascending: false });

        if (error) throw error;
        noEntriesMessage.classList.toggle('hidden', (entries || []).length > 0);
        return entries || [];
    } catch (error) {
        console.error('Error loading entries:', error);
        noEntriesMessage.textContent = "Could not load entries.";
        noEntriesMessage.classList.remove('hidden');
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
    const { data: { publicUrl } } = supabaseClient.storage.from('entry-images').getPublicUrl(fileName);
    return publicUrl;
}

async function predictTagsForImage(imgDataURL) {
    if (!GOOGLE_CLOUD_VISION_API_KEY || GOOGLE_CLOUD_VISION_API_KEY.startsWith('YOUR_')) {
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
                    features: [{ type: 'LABEL_DETECTION', maxResults: 7 }, { type: 'OBJECT_LOCALIZATION', maxResults: 3 }]
                }]
            })
        });
        const result = await response.json();
        if (!response.ok || result.error || !result.responses || !result.responses[0]) {
            console.error('Vision API error:', result.error || 'Invalid response'); return [];
        }
        const labels = result.responses[0].labelAnnotations || [];
        const objects = result.responses[0].localizedObjectAnnotations || [];
        const allPotentialTags = [...labels.map(l => l.description), ...objects.map(o => o.name)];
        const processedTags = allPotentialTags.map(tag => {
            const lt = tag.toLowerCase();
            if (lt.includes('dog') || lt.includes('puppy')) return 'Dog'; if (lt.includes('cat') || lt.includes('kitten')) return 'Cat';
            if (lt.includes('flower') || lt.includes('blossom')) return 'Flowering'; if (lt.includes('plant') || lt.includes('flora')) return 'Plant';
            return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
        });
        return [...new Set(processedTags)].filter(Boolean).slice(0, 5);
    } catch (e) { console.error("Prediction error:", e); return []; }
    finally { imageProcessingLoader.classList.add('hidden'); }
}


// --- Rendering Functions ---
// ... (renderHomeView, renderCollectionTimelineView, _renderTagBar, tag handlers,
//      renderNewEntryForm, renderNewEntryImagePreviews, processFirstImageForNewEntry,
//      renderEditEntryForm, renderEditEntryNewImagePreviews,
//      renderEntryDetailView (with isPublicView flag), displayDetailImage,
//      handleTagClick, fetchEntriesByTag, renderTaggedEntriesView,
//      lightbox functions as previously provided - these seem mostly okay but double check any appState access)
function renderHomeView() {
    if (!appState.currentUser) { navigateTo('signup'); return; }
    greetingEl.textContent = `Welcome, ${appState.currentUser.username || appState.currentUser.email.split('@')[0]}!`;
    collectionsContainer.innerHTML = ''; // Clear before rendering
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
    noCollectionsMessage.classList.toggle('hidden', appState.collections.length > 0);
}

async function renderCollectionTimelineView() {
    const collection = appState.collections.find(c => c.id === appState.activeCollectionId);
    if (!collection) { console.error("Collection not found for timeline view, ID:", appState.activeCollectionId); navigateTo('home'); return; }
    collectionTitleTimeline.textContent = collection.name;
    entriesTimelineContainer.innerHTML = ''; // Clear
    appState.activeEntries = await loadEntries(collection.id); // loadEntries handles loading UI

    appState.activeEntries.forEach((entry, idx) => {
        const tile = document.createElement('div');
        tile.className = 'card grid-entry-tile';
        tile.dataset.id = entry.id;
        let badgeHTML = '';
        if (idx < appState.activeEntries.length - 1) {
            const daysDiff = daysBetween(entry.date, appState.activeEntries[idx + 1].date);
            if (daysDiff && daysDiff > 0) badgeHTML = `<span class="days-since-badge">${daysDiff} day${daysDiff > 1 ? 's' : ''} later</span>`;
            else if (daysDiff === 0) badgeHTML = `<span class="days-since-badge">Same day</span>`;
        }
        const entryImageUrls = getSanitizedImageUrls(entry);
        const firstImageUrl = entryImageUrls.length > 0 ? entryImageUrls[0] : '';
        tile.innerHTML = `
            <img src="${firstImageUrl}" alt="${entry.title}" class="grid-entry-image" ${!firstImageUrl ? 'style="background-color: #eee;"' : ''}>
            <div class="grid-entry-info"> ${badgeHTML} <h3 class="grid-entry-title">${entry.title}</h3> </div>`;
        tile.onclick = () => { appState.activeEntryId = entry.id; renderEntryDetailView(entry); navigateTo('entryDetail'); };
        entriesTimelineContainer.appendChild(tile);
    });
    navigateTo('collectionTimeline');
}

function _renderTagBar(barElement, inputId, selectedTags, suggestedTags, addCustomFn, removeSelectedFn, selectSuggestedFn) {
    const customInputEl = barElement.querySelector(`#${inputId}`);
    const customVal = customInputEl ? customInputEl.value : '';
    barElement.innerHTML = '';
    selectedTags.forEach(tag => { /* ... chip creation ... */
        const chip = document.createElement('span'); chip.className = 'suggested-tag selected'; chip.textContent = tag;
        chip.dataset.tag = tag; chip.onclick = () => removeSelectedFn(tag); barElement.appendChild(chip);
    });
    suggestedTags.forEach(tag => { if (!selectedTags.includes(tag)) { /* ... chip creation ... */
        const chip = document.createElement('span'); chip.className = 'suggested-tag'; chip.textContent = tag;
        chip.dataset.tag = tag; chip.onclick = () => selectSuggestedFn(tag); barElement.appendChild(chip);
    }});
    const newCustomInput = document.createElement('input'); newCustomInput.type = 'text'; newCustomInput.id = inputId;
    newCustomInput.placeholder = 'Add custom tag...'; newCustomInput.value = customVal; barElement.appendChild(newCustomInput);
}
function handleAddCustomTagForNewEntry() { /* ... */ const input = tagBar.querySelector('#custom-tag-input'); const tag = input.value.trim(); if (tag && !appState.currentTags.includes(tag)) { appState.currentTags.push(tag); appState.aiSuggestedTags = appState.aiSuggestedTags.filter(st => st !== tag); } input.value = ''; _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry); }
function handleRemoveSelectedTagForNewEntry(tagToRemove) { /* ... */ appState.currentTags = appState.currentTags.filter(t => t !== tagToRemove); _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry); }
function handleSelectSuggestedTagForNewEntry(tagToSelect) { /* ... */ if (!appState.currentTags.includes(tagToSelect)) { appState.currentTags.push(tagToSelect); } appState.aiSuggestedTags = appState.aiSuggestedTags.filter(t => t !== tagToSelect); _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry); }
function handleAddCustomTagForEditEntry() { /* ... */ const input = editTagBarEl.querySelector('#edit-custom-tag-input'); const tag = input.value.trim(); if (tag && !appState.currentTags.includes(tag)) { appState.currentTags.push(tag); } input.value = ''; _renderTagBar(editTagBarEl, 'edit-custom-tag-input', appState.currentTags, [], handleAddCustomTagForEditEntry, handleRemoveSelectedTagForEditEntry, () => {}); }
function handleRemoveSelectedTagForEditEntry(tagToRemove) { /* ... */ appState.currentTags = appState.currentTags.filter(t => t !== tagToRemove); _renderTagBar(editTagBarEl, 'edit-custom-tag-input', appState.currentTags, [], handleAddCustomTagForEditEntry, handleRemoveSelectedTagForEditEntry, () => {}); }

function renderNewEntryForm() { newEntryForm.reset(); imagePreviewsContainer.innerHTML = ''; imageUploadLabel.classList.remove('hidden'); datePromptMessage.classList.add('hidden'); entryDateInput.value = formatDate(new Date()); appState.newEntrySelectedFiles = []; appState.currentTags = []; appState.aiSuggestedTags = []; _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry); imageProcessingLoader.classList.add('hidden'); entryUploadLoader.classList.add('hidden'); }
function renderNewEntryImagePreviews() { imagePreviewsContainer.innerHTML = ''; if (appState.newEntrySelectedFiles.length > 0) imageUploadLabel.classList.add('hidden'); else imageUploadLabel.classList.remove('hidden'); appState.newEntrySelectedFiles.forEach((file, index) => { const reader = new FileReader(); reader.onload = (e) => { const item = document.createElement('div'); item.className = 'image-preview-item'; item.innerHTML = `<img src="${e.target.result}" alt="Preview ${index + 1}"><button type="button" class="remove-preview-btn" data-index="${index}" title="Remove image">×</button>`; item.querySelector('.remove-preview-btn').onclick = () => { appState.newEntrySelectedFiles.splice(index, 1); renderNewEntryImagePreviews(); if(appState.newEntrySelectedFiles.length === 0) { appState.aiSuggestedTags = []; _renderTagBar(tagBar, 'custom-tag-input', appState.currentTags, appState.aiSuggestedTags, handleAddCustomTagForNewEntry, handleRemoveSelectedTagForNewEntry, handleSelectSuggestedTagForNewEntry); } else if (index === 0) processFirstImageForNewEntry(); }; imagePreviewsContainer.appendChild(item); }; reader.readAsDataURL(file); });}
async function processFirstImageForNewEntry() { if (appState.newEntrySelectedFiles.length > 0) { const file = appState.newEntrySelectedFiles[0]; const reader = new FileReader(); reader.onload = async (event) => { const dataURL = event.target.result; EXIF.getData(file, function() { let exifDateFound = false; const dto=EXIF.getTag(this,"DateTimeOriginal"); if(dto){try{const [dp]=dto.split(' ');const [y,m,d]=dp.split(':');if(y&&m&&d&&!isNaN(new Date(`${y}-${m}-${d}`))){entryDateInput.value=`${y}-${m}-${d}`;exifDateFound=true;}}catch(ex){console.warn("EXIF Date parse error:",ex);}} datePromptMessage.classList.toggle('hidden',!exifDateFound); if(!exifDateFound)datePromptMessage.textContent='No date in first image. Set manually or use today.';}); const tags = await predictTagsForImage(dataURL); appState.aiSuggestedTags = tags.filter(pt=>!appState.currentTags.includes(pt)); _renderTagBar(tagBar, 'custom-tag-input',appState.currentTags,appState.aiSuggestedTags,handleAddCustomTagForNewEntry,handleRemoveSelectedTagForNewEntry,handleSelectSuggestedTagForNewEntry);}; reader.readAsDataURL(file);} else { datePromptMessage.classList.add('hidden'); appState.aiSuggestedTags=[]; _renderTagBar(tagBar, 'custom-tag-input',appState.currentTags,appState.aiSuggestedTags,handleAddCustomTagForNewEntry,handleRemoveSelectedTagForNewEntry,handleSelectSuggestedTagForNewEntry);}}
function renderEditEntryForm(entry) { appState.editingEntryOriginal = JSON.parse(JSON.stringify(entry)); const urls = getSanitizedImageUrls(entry); appState.editEntryExistingImageUrls=[...urls]; appState.editEntryFilesToAdd=[]; editExistingImagesContainer.innerHTML=''; editNewImagePreviewsContainer.innerHTML=''; appState.editEntryExistingImageUrls.forEach((url,idx)=>{const item=document.createElement('div');item.className='image-preview-item';item.innerHTML=`<img src="${url}" alt="Existing ${idx+1}"><button type="button" class="remove-preview-btn" data-url="${url}" title="Remove">×</button>`;item.querySelector('.remove-preview-btn').onclick=()=>{appState.editEntryExistingImageUrls=appState.editEntryExistingImageUrls.filter(u=>u!==url);item.remove();};editExistingImagesContainer.appendChild(item);}); document.getElementById('edit-entry-date').value=formatDate(entry.date); document.getElementById('edit-entry-title').value=entry.title; document.getElementById('edit-entry-notes').value=entry.notes||''; appState.currentTags=[...(entry.tags||[])]; _renderTagBar(editTagBarEl,'edit-custom-tag-input',appState.currentTags,[],handleAddCustomTagForEditEntry,handleRemoveSelectedTagForEditEntry,()=>{}); document.getElementById('edit-upload-loader').classList.add('hidden');}
function renderEditEntryNewImagePreviews() { editNewImagePreviewsContainer.innerHTML=''; appState.editEntryFilesToAdd.forEach((file,idx)=>{const reader=new FileReader();reader.onload=(e)=>{const item=document.createElement('div');item.className='image-preview-item';item.innerHTML=`<img src="${e.target.result}" alt="New preview ${idx+1}"><button type="button" class="remove-preview-btn" data-index="${idx}" title="Remove new">×</button>`;item.querySelector('.remove-preview-btn').onclick=()=>{appState.editEntryFilesToAdd.splice(idx,1);renderEditEntryNewImagePreviews();};editNewImagePreviewsContainer.appendChild(item);};reader.readAsDataURL(file);});}
// renderEntryDetailView function as provided before, with isPublicView flag
// displayDetailImage function as provided before
// handleTagClick, fetchEntriesByTag, renderTaggedEntriesView as provided before
// Lightbox functions as provided before
function displayDetailImage(entry, index) {
    const entryImageUrls = getSanitizedImageUrls(entry);
    if (entryImageUrls.length === 0 || index < 0 || index >= entryImageUrls.length) {
        detailImage.src = ''; detailImage.alt = 'No image available';
        detailImage.style.cursor = 'default'; detailImage.onclick = null;
        detailThumbnailsContainer.innerHTML = ''; return;
    }
    appState.currentDetailImageIndex = index; const currentImageUrl = entryImageUrls[index];
    detailImage.src = currentImageUrl; detailImage.alt = `${entry.title} - Image ${index + 1}`;
    detailImage.style.cursor = 'zoom-in'; detailImage.onclick = () => openLightbox(currentImageUrl);
    detailThumbnailsContainer.innerHTML = '';
    entryImageUrls.forEach((url, i) => {
        const thumb = document.createElement('img'); thumb.src = url; thumb.alt = `Thumbnail ${i + 1}`;
        thumb.className = 'detail-thumbnail'; if (i === index) thumb.classList.add('active-thumb');
        thumb.onclick = () => displayDetailImage(entry, i); detailThumbnailsContainer.appendChild(thumb);
    });
}
// renderEntryDetailView, handleTagClick, fetchEntriesByTag, renderTaggedEntriesView, lightbox functions (kept concise for brevity here but use full versions)
// ... (Use the full versions of these functions from previous correct snippets)
// For brevity, I'm not re-pasting all rendering functions if they were largely okay.
// The key focus is signup and the share button logic.


// --- Event Handlers ---
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden'); loginError.textContent = '';
        const emailVal = document.getElementById('login-email').value;
        const passwordVal = document.getElementById('login-password').value;
        try {
            const { error } = await supabaseClient.auth.signInWithPassword({ email: emailVal, password: passwordVal });
            if (error) throw error;
            await checkAuth(); // checkAuth will handle navigation
        } catch (error) {
            console.error("Login error:", error);
            loginError.textContent = error.message;
            loginError.classList.remove('hidden');
        }
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
            const { data: authData, error: authError } = await supabaseClient.auth.signUp({
                email: emailVal,
                password: passwordVal,
                options: { // Pass username and phone for potential backend profile creation (e.g., via Edge Function)
                    data: {
                        username_from_signup: usernameVal,
                        phone_from_signup: phoneVal
                    }
                }
            });
            console.log('Auth signup response:', { authData: authData ? 'User/Session present' : 'No user/session', authError });

            if (authError) {
                console.error('Auth signup failed:', JSON.stringify(authError, null, 2));
                throw authError;
            }

            if (authData && authData.user) {
                console.log('Auth user created in auth.users, ID:', authData.user.id);

                // Attempt to insert profile client-side.
                // IMPORTANT: This will FAIL if email verification is ON, because the user isn't fully authenticated yet for RLS.
                // For email verification ON, profile creation should ideally be handled by an Edge Function trigger.
                // If email verification is OFF, this client-side insert (with correct RLS) should work.
                console.log('Attempting to insert profile client-side with data:', {
                    id: authData.user.id, // ASSUMES 'id' is the UUID column name in your 'profiles' table
                    username: usernameVal,
                    phone: phoneVal
                });

                const { data: newProfile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .insert({
                        id: authData.user.id, // ENSURE 'id' MATCHES YOUR 'profiles' TABLE UUID COLUMN NAME
                        username: usernameVal,
                        phone: phoneVal
                    })
                    .select()
                    .single();

                if (profileError) {
                    console.error('CLIENT-SIDE PROFILE INSERTION FAILED. Error details:', JSON.stringify(profileError, null, 2));
                    // This error is expected if email verification is ON.
                    // If email verification is OFF and this still fails, it's an RLS or schema issue.
                    // Provide a generic message to the user.
                    if (profileError.message.includes("violates row-level security policy")) {
                         signupError.textContent = 'Account created. Profile setup issue (RLS). Check email to verify, then login. If issue persists, contact support.';
                    } else {
                         signupError.textContent = 'Account created, but profile setup encountered an issue. Please try logging in after verifying your email.';
                    }
                    signupError.classList.remove('hidden');
                    signupError.style.color = 'var(--danger-color)';
                    // Even if profile insert fails here (e.g. due to email verify needed),
                    // guide user to verify email if that's the flow.
                    if (!authData.session) { // No session means email verification is likely pending
                         console.log('Email confirmation required for new user.');
                         signupError.textContent = 'Account created! Please check your email to confirm your account, then log in to complete profile setup if needed.';
                         signupError.classList.remove('hidden');
                         signupError.style.color = 'var(--primary-accent)';
                         setTimeout(() => navigateTo('login'), 6000);
                         return; // Stop further execution
                    }
                    // If there was a session but profile still failed, that's more unusual.
                    return;
                }

                console.log('Client-side profile inserted successfully:', newProfile);
                appState.currentUser = { // Construct a more complete currentUser for immediate use
                    id: authData.user.id, email: authData.user.email,
                    username: newProfile.username, phone: newProfile.phone,
                    // ... other relevant fields from authData.user
                };

                if (authData.session) { // User is immediately active (email verification likely OFF or auto-confirmed)
                    console.log('Session available post-signup, proceeding to checkAuth.');
                    await checkAuth();
                } else { // Email confirmation IS required
                    console.log('Email confirmation required for new user.');
                    signupError.textContent = 'Account created! Please check your email to confirm and then log in.';
                    signupError.classList.remove('hidden');
                    signupError.style.color = 'var(--primary-accent)';
                    setTimeout(() => navigateTo('login'), 6000);
                }
            } else {
                console.warn('Auth signup successful but no user data (authData.user is null/undefined). This is unexpected if authError is null.');
                signupError.textContent = 'An unexpected issue occurred during signup (Code: ASU_ND). Please try again.';
                signupError.classList.remove('hidden');
                signupError.style.color = 'var(--danger-color)';
            }
        } catch (error) {
            console.error('Overall signup process error:', error);
            signupError.textContent = error.message || 'An error occurred during signup.';
            signupError.classList.remove('hidden');
            signupError.style.color = 'var(--danger-color)';
        }
    };
}

// ... (other event handlers like sign-out, new collection, etc., should be largely okay,
//      but ensure they correctly use appState.currentUser.id where needed)

document.getElementById('sign-out-btn').onclick = async () => { if (confirm("Are you sure you want to sign out?")) { await supabaseClient.auth.signOut(); appState.currentUser = null; appState.collections = []; appState.activeCollectionId = null; appState.activeEntryId = null; navigateTo('login'); }};
document.getElementById('new-collection-btn-home').onclick = () => { document.getElementById('collection-name').value = ''; navigateTo('newCollectionModal'); };
document.getElementById('cancel-new-collection-btn').onclick = () => navigateTo('home');
if (newCollectionForm) { newCollectionForm.onsubmit = async (e) => { e.preventDefault(); if (!appState.currentUser || !appState.currentUser.id) { alert("Please sign in to create a collection."); return; } try { const { data: newColl, error } = await supabaseClient.from('collections').insert({ name: document.getElementById('collection-name').value, user_id: appState.currentUser.id }).select().single(); if (error) throw error; await loadCollections(); renderHomeView(); navigateTo('home'); } catch (error) { console.error('Error creating collection:', error); alert('Error creating collection.'); }};}
document.getElementById('back-to-home-btn').onclick = () => navigateTo('home');
document.getElementById('add-entry-fab').onclick = () => { renderNewEntryForm(); navigateTo('newEntry'); };
document.getElementById('back-to-timeline-btn').onclick = () => { if (appState.activeCollectionId) renderCollectionTimelineView(); else navigateTo('home'); };
if (imageUploadInput) { imageUploadInput.onchange = e => { appState.newEntrySelectedFiles = Array.from(e.target.files); renderNewEntryImagePreviews(); processFirstImageForNewEntry(); };}
document.getElementById('add-custom-tag-btn').onclick = handleAddCustomTagForNewEntry;
if (tagBar) { tagBar.addEventListener('keypress', e => { if (e.target.id === 'custom-tag-input' && e.key === 'Enter') { e.preventDefault(); handleAddCustomTagForNewEntry(); }});}
if (newEntryForm) { newEntryForm.onsubmit = async (e) => { e.preventDefault(); if (appState.newEntrySelectedFiles.length === 0) { alert("Please select at least one image."); return; } if (!appState.currentUser || !appState.currentUser.id) { alert("Please sign in to create an entry."); return; } entryUploadLoader.classList.remove('hidden'); document.getElementById('create-entry-btn').disabled = true; try { const uploadedImageUrls = []; for (const file of appState.newEntrySelectedFiles) { const url = await uploadImage(file, appState.currentUser.id); uploadedImageUrls.push(url); } const entryData = { collection_id: appState.activeCollectionId, title: document.getElementById('entry-title').value, notes: document.getElementById('entry-notes').value, date: entryDateInput.value, image_urls: uploadedImageUrls, tags: appState.currentTags.filter(Boolean) }; const { error } = await supabaseClient.from('entries').insert(entryData).select().single(); if (error) throw error; appState.newEntrySelectedFiles = []; imagePreviewsContainer.innerHTML = ''; imageUploadLabel.classList.remove('hidden'); await renderCollectionTimelineView(); } catch (error) { console.error('Error in entry creation:', error); alert(`Error creating entry: ${error.message}`); } finally { entryUploadLoader.classList.add('hidden'); document.getElementById('create-entry-btn').disabled = false; }};}
document.getElementById('back-to-timeline-from-detail-btn').onclick = () => { if (appState.isViewingPublicLink && appState.publicCollectionData) { displayPublicCollection(appState.publicCollectionData.id); } else if (appState.activeCollectionId) { renderCollectionTimelineView(); } else { navigateTo('home'); }};
document.getElementById('back-from-tagged-view-btn').onclick = async () => { if (appState.viewBeforeTagSearch === 'entryDetail' && appState.entryIdBeforeTagSearch && appState.collectionIdForEntryBeforeTagSearch) { appState.activeEntryId = appState.entryIdBeforeTagSearch; appState.activeCollectionId = appState.collectionIdForEntryBeforeTagSearch; appState.activeEntries = await loadEntries(appState.activeCollectionId); const originalEntry = appState.activeEntries.find(e => e.id === appState.entryIdBeforeTagSearch); if (originalEntry) { renderEntryDetailView(originalEntry); navigateTo('entryDetail'); } else { navigateTo('home'); } } else if (appState.activeCollectionId) { renderCollectionTimelineView(); } else { navigateTo('home'); }};
document.getElementById('delete-collection-btn').onclick = async () => { const col = appState.collections.find(c => c.id === appState.activeCollectionId); if (!col || !confirm(`Delete collection "${col.name}" and ALL its entries? This cannot be undone.`)) return; try { await supabaseClient.from('entries').delete().eq('collection_id', appState.activeCollectionId); await supabaseClient.from('collections').delete().eq('id', appState.activeCollectionId); appState.activeCollectionId = null; await loadCollections(); renderHomeView(); navigateTo('home'); } catch (error) { console.error('Error deleting collection:', error); alert('Error deleting collection.'); }};
document.getElementById('delete-entry-btn').onclick = async () => { if (!appState.activeEntryId || !confirm("Are you sure you want to delete this entry?")) return; try { await supabaseClient.from('entries').delete().eq('id', appState.activeEntryId); appState.activeEntryId = null; await renderCollectionTimelineView(); } catch (error) { console.error('Error deleting entry:', error); alert('Error deleting entry.'); }};
document.getElementById('switch-to-signup').onclick = () => navigateTo('signup');
document.getElementById('switch-to-login').onclick = () => navigateTo('login');
document.getElementById('edit-entry-btn').onclick = () => { const entry = appState.activeEntries.find(e => e.id === appState.activeEntryId); if (entry) { renderEditEntryForm(entry); navigateTo('editEntry'); }};
document.getElementById('back-to-detail-btn').onclick = () => { const entry = appState.editingEntryOriginal || appState.activeEntries.find(e => e.id === appState.activeEntryId); if (entry) { renderEntryDetailView(entry); navigateTo('entryDetail'); } else if (appState.activeCollectionId) { renderCollectionTimelineView(); } else {navigateTo('home');}};
if (editAddMoreImagesInput) { editAddMoreImagesInput.onchange = (e) => { appState.editEntryFilesToAdd = Array.from(e.target.files); renderEditEntryNewImagePreviews(); };}
document.getElementById('edit-add-custom-tag-btn').onclick = handleAddCustomTagForEditEntry;
if (editTagBarEl) { editTagBarEl.addEventListener('keypress', e => { if (e.target.id === 'edit-custom-tag-input' && e.key === 'Enter') { e.preventDefault(); handleAddCustomTagForEditEntry(); }});}
if (editEntryForm) { editEntryForm.onsubmit = async (e) => { e.preventDefault(); const editLoader = document.getElementById('edit-upload-loader'); const saveBtn = document.getElementById('save-entry-btn'); editLoader.classList.remove('hidden'); saveBtn.disabled = true; try { const newUploadedImageUrls = []; for (const file of appState.editEntryFilesToAdd) { const url = await uploadImage(file, appState.currentUser.id); newUploadedImageUrls.push(url); } const finalImageUrls = [...appState.editEntryExistingImageUrls, ...newUploadedImageUrls]; const updatedEntryData = { title: document.getElementById('edit-entry-title').value, notes: document.getElementById('edit-entry-notes').value, date: document.getElementById('edit-entry-date').value, tags: appState.currentTags.filter(Boolean), image_urls: finalImageUrls }; const { error } = await supabaseClient.from('entries').update(updatedEntryData).eq('id', appState.activeEntryId); if (error) throw error; appState.activeEntries = await loadEntries(appState.activeCollectionId); const updatedEntry = appState.activeEntries.find(entry => entry.id === appState.activeEntryId); if (updatedEntry) { renderEntryDetailView(updatedEntry); navigateTo('entryDetail'); } else { renderCollectionTimelineView(); } } catch (error) { console.error('Error updating entry:', error); alert('Error updating entry.'); } finally { editLoader.classList.add('hidden'); saveBtn.disabled = false; appState.editEntryFilesToAdd = []; editNewImagePreviewsContainer.innerHTML = ''; }};}
let touchstartX = 0, touchendX = 0; const entryDetailViewEl = views.entryDetail; function handleSwipe() { const swipeThreshold = 50; if (touchendX < touchstartX - swipeThreshold) document.getElementById('next-entry-btn').click(); if (touchendX > touchstartX + swipeThreshold) document.getElementById('prev-entry-btn').click(); } if (entryDetailViewEl) { entryDetailViewEl.addEventListener('touchstart', e => { touchstartX = e.changedTouches[0].screenX; }, {passive: true}); entryDetailViewEl.addEventListener('touchend', e => { touchendX = e.changedTouches[0].screenX; handleSwipe(); }, {passive: true});}


// DOMContentLoaded to attach main event listeners
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOMContentLoaded: Script loaded, starting checkAuth.");
    await checkAuth(); // Initial check

    // Lightbox event listeners
    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    if (lightboxZoomInBtn) lightboxZoomInBtn.addEventListener('click', zoomInLightbox);
    if (lightboxZoomOutBtn) lightboxZoomOutBtn.addEventListener('click', zoomOutLightbox);
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener('click', (event) => {
            if (event.target === lightboxOverlay) {
                closeLightbox();
            }
        });
    }

    // Share Publicly Button Listener
    const generatePublicLinkBtn = document.getElementById('generate-public-link-btn');
    console.log('DOMContentLoaded: Attempting to find generatePublicLinkBtn:', generatePublicLinkBtn);

    if (generatePublicLinkBtn) {
        console.log('DOMContentLoaded: generatePublicLinkBtn found, attaching onclick listener.');
        generatePublicLinkBtn.onclick = async () => {
            console.log('Share Publicly button CLICKED!');

            if (!appState.currentUser || !appState.currentUser.id || !appState.activeCollectionId) {
                console.error("Share button: currentUser, currentUser.id, or activeCollectionId missing.", {
                    currentUser: appState.currentUser,
                    activeCollectionId: appState.activeCollectionId
                });
                alert("Cannot generate link. Please ensure you are logged in and viewing a collection.");
                return;
            }
            console.log("Share button: User and Active Collection ID present.", {
                userId: appState.currentUser.id,
                collectionId: appState.activeCollectionId
            });

            try {
                console.log("Share button: Attempting to update collection in DB to set is_public = true.");
                const { data, error } = await supabaseClient
                    .from('collections')
                    .update({ is_public: true })
                    .eq('id', appState.activeCollectionId)
                    .eq('user_id', appState.currentUser.id)
                    .select('name, is_public') // Verify the update
                    .single();

                console.log("Share button: DB Update response:", { data, error });

                if (error) {
                    console.error("Share button: DB UPDATE FAILED. Error details:", JSON.stringify(error, null, 2));
                    alert('Error making collection public: ' + error.message + ' (See console for details)');
                    return;
                }

                if (!data) {
                    console.error("Share button: No data returned from DB update. Collection not found, user not owner, or RLS issue (already public?).");
                    alert("Could not update collection. You might not be the owner, or the collection ID is wrong.");
                    return;
                }

                console.log("Share button: Collection update successful in DB. Returned data:", data);

                const publicLink = `${window.location.origin}${window.location.pathname}?publicCollectionId=${appState.activeCollectionId}`;
                console.log("Share button: Generated link:", publicLink);

                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(publicLink);
                    alert(`Public link for "${data.name}" copied to clipboard!\n${publicLink}\n\nTo make it private again, a 'Make Private' button is needed.`);
                } else {
                    prompt(`Public link for "${data.name}" (Copy this manually):`, publicLink);
                }

                const collectionInState = appState.collections.find(c => c.id === appState.activeCollectionId);
                if (collectionInState) {
                    collectionInState.is_public = true;
                }
                generatePublicLinkBtn.textContent = "Public Link Shared";
                console.log("Share button: UI updated.");

            } catch (error) {
                console.error('Share button: UNEXPECTED error in try block:', error.message, error);
                alert('An unexpected error occurred: ' + error.message);
            }
        };
    } else {
        console.error('DOMContentLoaded: generatePublicLinkBtn was NOT found!');
    }
});
