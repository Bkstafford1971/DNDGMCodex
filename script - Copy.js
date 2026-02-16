const API_BASE = "https://api.open5e.com";
let currentCategory = ""; 
let allFetchedItems = []; 

// --- 1. CORE FETCHING ---
async function fetchData(target) {
    const display = document.getElementById('display-area');
    const filterUI = document.getElementById('filter-container');
    display.innerHTML = '<div class="loader">Consulting the archives...</div>';
    
    let url;
    if (target.startsWith('http')) {
        url = target;
    } else {
        currentCategory = target; 
        const limit = target.includes('spells') ? 500 : 50;
        url = `${API_BASE}/${target}/?limit=${limit}`;
    }

    try {
        const response = await fetch(url);
        const data = await response.json();
        allFetchedItems = data.results;

        if (filterUI) {
            filterUI.style.display = currentCategory.includes('spells') ? 'block' : 'none';
        }

        renderResults(allFetchedItems, currentCategory, data.next, data.previous);
    } catch (error) {
        display.innerHTML = `<p class="error">Failed to summon data.</p>`;
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

        const strictResults = data.results.filter(m => 
            m.name.toLowerCase().includes(query)
        );

        if (filterUI) filterUI.style.display = 'none';
        renderResults(strictResults, `Search: "${query}"`, data.next, data.previous);
    } catch (e) {
        console.error("Search failed", e);
    }
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

    if (cat.includes('monsters')) {
        tableHeader = `<tr><th>Name</th><th>Type</th><th>Size</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('monsters', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.type}</td>
                <td>${item.size}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`).join('');
    } 
    else if (cat.includes('magicitems')) {
        tableHeader = `<tr><th>Name</th><th>Type</th><th>Rarity</th><th>Attunement</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('magicitems', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.type}</td>
                <td><span class="rarity-tag ${item.rarity ? item.rarity.toLowerCase().replace(/\s+/g, '-') : 'common'}">${item.rarity}</span></td>
                <td>${(item.requires_attunement && item.requires_attunement.toLowerCase() !== 'no') ? 'Yes' : 'No'}</td>
            </tr>`).join('');
    }
    else if (cat.includes('races')) {
		tableHeader = `<tr><th>Race</th><th>Size</th><th>Speed</th><th>Source</th></tr>`;
		tableRows = items.map(item => {
			const cleanSize = item.size 
				? item.size.replace(/[\*\_]/g, '').replace(/^Size\.\s+/i, '') 
				: 'Medium';
			const cleanSpeed = item.speed_desc 
				? item.speed_desc.split('.')[0].replace(/[\*\_]/g, '').replace(/^Speed\.\s+/i, '') 
				: '30 ft.';

			return `
				<tr onclick="viewDetails('races', '${item.slug}')">
					<td><strong>${item.name}</strong></td>
					<td>${cleanSize}</td>
					<td>${cleanSpeed}</td>
					<td class="source-tag">${item.document__title || "SRD"}</td>
				</tr>`;
		}).join('');
	}
    else if (cat.includes('feats')) {
        tableHeader = `<tr><th>Name</th><th>Prerequisite</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('feats', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.prerequisite || 'None'}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`).join('');
    }
    else if (cat.includes('backgrounds')) {
        tableHeader = `<tr><th>Background</th><th>Skills</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('backgrounds', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td>${item.skill_proficiencies || 'Varies'}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`).join('');
    }
    else if (cat.includes('conditions')) {
        tableHeader = `<tr><th>Condition</th><th>Summary</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('conditions', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td class="source-tag">${item.desc.split('.')[0]}.</td>
            </tr>`).join('');
    }
    else if (cat.includes('spells')) {
        tableHeader = `<tr><th>Level</th><th>Name</th><th>School</th><th>Source</th></tr>`;
        tableRows = items.map(item => `
            <tr onclick="viewDetails('spells', '${item.slug}')">
                <td class="cell-bold">${item.level}</td>
                <td><strong>${item.name}</strong></td>
                <td>${item.school}</td>
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
    display.scrollTo(0, 0);
}

// --- 4. DETAIL MODAL ---
async function viewDetails(route, slug) {
    const modal = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body');
    modal.style.display = "block";
    modalBody.innerHTML = '<p>Translating runes...</p>';

    try {
        const response = await fetch(`${API_BASE}/${route}/${slug}/`);
        const data = await response.json();
        let contentHtml = `<h2 class="detail-header">${data.name || data.title}</h2><hr>`;

        if (route === 'monsters') {
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
        else if (route === 'races') {
            const racialContent = [
                data.desc,
                data.asi_desc ? `### Ability Score Increase\n${data.asi_desc}` : null,
                data.age ? `### Age\n${data.age}` : null,
                data.alignment ? `### Alignment\n${data.alignment}` : null,
                data.size ? `### Size\n${data.size}` : null,
                data.speed_desc ? `### Speed\n${data.speed_desc}` : null,
                data.languages ? `### Languages\n${data.languages}` : null,
                data.vision ? `### Vision\n${data.vision}` : null,
                data.traits ? `### Racial Traits\n${data.traits}` : null
            ].filter(Boolean).join('\n\n');
            contentHtml += `<div class="description-block">${marked.parse(racialContent)}<p><strong>Source:</strong> ${data.document__title || "SRD"}</p></div>`;
        } 
        else if (route === 'backgrounds') {
            const backgroundContent = [
                data.desc,
                data.skill_proficiencies ? `### Skill Proficiencies\n${data.skill_proficiencies}` : null,
                data.tool_proficiencies ? `### Tool Proficiencies\n${data.tool_proficiencies}` : null,
                data.languages ? `### Languages\n${data.languages}` : null,
                data.equipment ? `### Equipment\n${data.equipment}` : null,
                data.feature ? `### Feature: ${data.feature}\n${data.feature_desc}` : null,
                data.suggested_characteristics ? `### Suggested Characteristics\n${data.suggested_characteristics}` : null
            ].filter(Boolean).join('\n\n');
            contentHtml += `<div class="description-block">${marked.parse(backgroundContent)}<p><strong>Source:</strong> ${data.document__title || "SRD"}</p></div>`;
        }
        else {
            const description = data.desc || data.description || "No description available.";
            contentHtml += `<div class="description-block">${marked.parse(description)}</div>`;
        }
        
        modalBody.innerHTML = contentHtml;
    } catch (e) { 
        modalBody.innerHTML = "Failed to load details."; 
    }
}

// --- 5. UI HELPERS ---
function toggleSub(id) { 
    document.getElementById(id).classList.toggle('active'); 
}

function closeModal() { 
    document.getElementById('detail-modal').style.display = "none"; 
}

window.onclick = (e) => { 
    if(e.target == document.getElementById('detail-modal')) closeModal(); 
}

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
};