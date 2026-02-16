const API_BASE = "https://api.open5e.com";
let currentCategory = ""; 
let allFetchedItems = []; 

// --- 1. CORE FETCHING ---
async function fetchData(target) {
    const display = document.getElementById('display-area');
    const filterUI = document.getElementById('filter-container');
    display.innerHTML = '<div class="loader">Consulting the archives...</div>';
    
    let url;
    currentCategory = target; 

    // Redirect "feats" to your local JSON file
    if (target === 'feats') {
        url = 'feats.json'; 
    } else if (target.startsWith('http')) {
        url = target;
    } else {
        const limit = target.includes('spells') ? 500 : 50;
        url = `${API_BASE}/${target}/?limit=${limit}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Use data.feats for local file, data.results for API
        allFetchedItems = data.feats ? data.feats : data.results;

        if (filterUI) {
            filterUI.style.display = currentCategory.includes('spells') ? 'block' : 'none';
        }

        renderResults(allFetchedItems, currentCategory, data.next, data.previous);
    } catch (error) {
        display.innerHTML = `<p class="error">Failed to summon data from ${url}.</p>`;
    }
}

// --- 2. SEARCH LOGIC ---
async function handleSearch(event) {
    const query = event.target.value.toLowerCase();
    const filterUI = document.getElementById('filter-container');
    if (query.length < 2) return;

    currentCategory = "monsters"; 
    try {
        const response = await fetch(`${API_BASE}/monsters/?search=${query}&limit=100`);
        const data = await response.json();
        const strictResults = data.results.filter(m => m.name.toLowerCase().includes(query));

        if (filterUI) filterUI.style.display = 'none';
        renderResults(strictResults, `Search: "${query}"`, data.next, data.previous);
    } catch (e) { console.error("Search failed", e); }
}

// --- 3. RENDERING ENGINE ---
function renderResults(items, category, nextUrl, prevUrl) {
    const display = document.getElementById('display-area');
    let displayTitle = category.replace(/-/g, ' ').split('?')[0];
    let html = `<h1>${displayTitle.toUpperCase()}</h1>`;
    
    if (!items || items.length === 0) {
        html += "<p>No entries found in this archive.</p>";
        display.innerHTML = html;
        return;
    }

    let tableHeader = "";
    let tableRows = "";
    const cat = category.toLowerCase();

    // Custom Table for local Feats
    if (cat === 'feats') {
        tableHeader = `<tr><th>Name</th><th>Prerequisite</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('local-feats', '${item.name.replace(/'/g, "\\'")}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.prerequisites || 'None'}</td>
                <td class="source-tag">${item.source}</td>
            </tr>`).join('');
    } 
    // Monster Table
    else if (cat.includes('monsters')) {
        tableHeader = `<tr><th>Name</th><th>Type</th><th>Size</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('monsters', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.type}</td>
                <td>${item.size}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`).join('');
    }
    // Standard Tables (Items, Spells, etc.)
    else {
        tableHeader = `<tr><th>Name</th><th>Details</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('${cat}', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.type || item.school || 'General'}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`).join('');
    }

    if (tableHeader) {
        html += `<table class="magic-item-table"><thead>${tableHeader}</thead><tbody>${tableRows}</tbody></table>`;
    }

    if (nextUrl || prevUrl) {
        html += `<div class="pagination-container">
                ${prevUrl ? `<button class="page-btn" onclick="fetchData('${prevUrl}')">← Previous</button>` : ''}
                ${nextUrl ? `<button class="page-btn" onclick="fetchData('${nextUrl}')">Next →</button>` : ''}
            </div>`;
    }
    display.innerHTML = html;
}

// --- 4. DETAIL MODAL ---
async function viewDetails(route, identifier) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = "block";

    // Logic for your local Feats
    if (route === 'local-feats') {
        const feat = allFetchedItems.find(f => f.name === identifier);
        if (!feat) return;

        let benefitsList = feat.benefits.map(b => `<li>${b}</li>`).join('');
        modalBody.innerHTML = `
            <h2 class="detail-header">${feat.name}</h2><hr>
            <div class="description-block">
                <p><strong>Prerequisite:</strong> ${feat.prerequisites || 'None'}</p>
                <h3>Benefits</h3>
                <ul>${benefitsList}</ul>
                <p class="source-tag">Source: ${feat.source}</p>
            </div>`;
        return;
    }

    // Standard API details
    try {
        const response = await fetch(`${API_BASE}/${route}/${identifier}/`);
        const data = await response.json();
        modalBody.innerHTML = `<h2 class="detail-header">${data.name}</h2><hr>
                               <div class="description-block">${marked.parse(data.desc || "No info.")}</div>`;
    } catch (e) { modalBody.innerHTML = "Failed to load details."; }
}

function toggleSub(id) { document.getElementById(id).classList.toggle('active'); }
function closeModal() { document.getElementById('detail-modal').style.display = "none"; }
window.onclick = (e) => { if(e.target == document.getElementById('detail-modal')) closeModal(); }

function showStartPage() {
    const display = document.getElementById('display-area');
    const filterUI = document.getElementById('filter-container');
    
    if (filterUI) filterUI.style.display = 'none';

    display.innerHTML = `
        <div class="start-page">
            <div class="hero-images">
                <img src="https://upload.wikimedia.org/wikipedia/it/d/d2/DnD_5e_logo.png" 
                     alt="Dungeons & Dragons Logo" 
                     class="main-logo">
                <img src="https://static.wikia.nocookie.net/d20modern/images/a/a3/Diceset.png/revision/latest?cb=20200922050323" 
                     alt="D&D Dice Set" 
                     class="dice-image">
            </div>
            <h1>The Dungeon Masters Codex</h1>
            <p class="subtitle">The archives are at your command. Select a category from the sidebar to begin your session.</p>
            
            <div class="session-note">
                <p><em>"The evening is young, and the dungeon is deep. May your natural 20s be many."</em></p>
            </div>
        </div>
    `;
}

window.onload = () => {
    showStartPage();
