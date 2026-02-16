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
    modalBody.innerHTML = '<p class="loader">Consulting the archives...</p>';

    // Logic for your local Feats
    if (route === 'local-feats') {
        const feat = allFetchedItems.find(f => f.name === identifier);
        if (!feat) {
            modalBody.innerHTML = "Feat not found.";
            return;
        }

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
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        let contentHtml = `<h2 class="detail-header">${data.name || data.title}</h2><hr>`;

        // Special logic for Rule Sections (Conditions, Combat, etc.)
        // These use the 'desc' field for the main body of text.
        if (route === 'sections') {
            contentHtml += `<div class="description-block">${marked.parse(data.desc)}</div>`;
        } 
        // Logic for Monsters
        else if (route === 'monsters') {
            contentHtml += `
                <div class="stat-block">
                    <p><em>${data.size} ${data.type}, ${data.alignment}</em></p>
                    <div class="stats-bar">
                        <strong>Armor Class:</strong> ${data.armor_class} (${data.armor_desc || 'natural armor'})<br>
                        <strong>Hit Points:</strong> ${data.hit_points} (${data.hit_dice})<br>
                        <strong>Speed:</strong> ${Object.entries(data.speed).map(([k, v]) => `${k} ${v} ft.`).join(', ')}
                    </div>
                    <div class="abilities-grid">
                        <span><strong>STR</strong> <em>${data.strength}</em></span>
                        <span><strong>DEX</strong> <em>${data.dexterity}</em></span>
                        <span><strong>CON</strong> <em>${data.constitution}</em></span>
                        <span><strong>INT</strong> <em>${data.intelligence}</em></span>
                        <span><strong>WIS</strong> <em>${data.wisdom}</em></span>
                        <span><strong>CHA</strong> <em>${data.charisma}</em></span>
                    </div>
                    ${data.special_abilities ? `<h3>Special Traits</h3><p>${data.special_abilities.map(a => `<strong>${a.name}:</strong> ${a.desc}`).join('<br><br>')}</p>` : ''}
                    <h3>Actions</h3>
                    <p>${data.actions ? data.actions.map(a => `<strong>${a.name}:</strong> ${a.desc}`).join('<br><br>') : 'No actions listed.'}</p>
                </div>`;
        }
    // Main Race display logic    
        else if (route === "races") {
            let allContent = "";
        
            // Debug line (remove later)
            if (data.desc) {
                allContent += `<section>${marked.parse(data.desc)}</section>`;
            }
        
            // Ability Score Increase (usually already plain or simple, but safe to parse)
            if (data.asi_desc) {
                allContent += `<section><h3>Ability Score Increase</h3>${marked.parse(data.asi_desc)}</section>`;
            } else if (data.ability_bonuses) {  // fallback if older structure
                allContent += `<section><h3>Ability Score Increases</h3><p>${data.ability_bonuses}</p></section>`;
            }
        
            // Age, Alignment, Size, Speed, Languages — these contain the problematic **_Field._** markdown
            if (data.age) {
                allContent += `<section>${marked.parse(data.age)}</section>`;
            }
            if (data.alignment) {
                allContent += `<section>${marked.parse(data.alignment)}</section>`;
            }
            if (data.size) {
                allContent += `<section>${marked.parse(data.size)}</section>`;
            }
            if (data.speed_desc) {           // prefer speed_desc if available (has markdown)
                allContent += `<section>${marked.parse(data.speed_desc)}</section>`;
            } else if (data.speed) {
                // fallback: format raw speed object nicely
                const speedText = Object.entries(data.speed)
                    .map(([type, val]) => `${type} ${val} ft.`)
                    .join(", ");
                allContent += `<section><h3>Speed</h3><p>Your base ${speedText}</p></section>`;
            }
            if (data.languages) {
                allContent += `<section>${marked.parse(data.languages)}</section>`;
            }
        
            // Traits (already handled, but ensure it's parsed once)
            if (data.traits) {
                allContent += `<section><h3>Traits</h3>${marked.parse(data.traits)}</section>`;
            }
        
            contentHtml += `<div class="description-block">${allContent || "No description available."}</div>`;
        }
        
        modalBody.innerHTML = contentHtml;
    } catch (e) { 
        console.error("Fetch error:", e);
        modalBody.innerHTML = `<p class="error">Failed to load details. The archives may be incomplete.</p>`; 
    }
}
function toggleSub(id) { document.getElementById(id).classList.toggle('active'); }
function closeModal() { document.getElementById('detail-modal').style.display = "none"; }
window.onclick = (e) => { if(e.target == document.getElementById('detail-modal')) closeModal(); }

// --- 6. START PAGE ---
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
                <img src="https://openclipart.org/image/800px/svg_to_png/172637/diceset.png" 
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
};
