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

        // Special logic for Rule Sections (Conditions, Combat, etc.) — improved & future-proof
        if (route === 'sections') {
            let contentParts = [];

            // Main markdown content — this is where conditions and most rules live
            if (data.desc && data.desc.trim().length > 20) {
                contentParts.push(marked.parse(data.desc));
            }

            // Fallback when content is missing/empty
            if (contentParts.length === 0) {
                contentParts.push(
                    `<p style="color: #e67e22; font-style: italic;">` +
                    `(No detailed rules text found in API response for "${data.name}". ` +
                    `The entry may be incomplete or placeholder in the Open5e database.)</p>`
                );
            }

            contentHtml += `<div class="description-block">${contentParts.join('\n')}</div>`;
        } 
        
        // Dedicated spell display logic
        else if (route === 'spells') {
            let spellContent = '';

            // Core casting info - stat-block style
            spellContent += `
                <div class="stat-block" style="margin-bottom: 1.5em;">
                    <p><strong>Level:</strong> ${data.level || 'Cantrip'}</p>
                    <p><strong>School:</strong> ${data.school || '—'}</p>
                    <p><strong>Casting Time:</strong> ${data.casting_time || '—'}</p>
                    <p><strong>Range:</strong> ${data.range || '—'}</p>
                    <p><strong>Components:</strong> ${data.components || '—'} 
                        ${data.material ? `(${data.material})` : ''}</p>
                    <p><strong>Duration:</strong> ${data.duration || '—'} 
                        ${data.requires_concentration ? '(Concentration)' : ''}</p>
                    ${data.ritual === 'yes' || data.can_be_cast_as_ritual ? '<p><strong>Ritual:</strong> Yes</p>' : ''}
                </div>`;

            // Main description
            if (data.desc) {
                spellContent += `<section>${marked.parse(data.desc)}</section>`;
            }

            // Higher level / at higher levels scaling
            if (data.higher_level) {
                spellContent += `
                    <section>
                        <h3>At Higher Levels</h3>
                        ${marked.parse(data.higher_level)}
                    </section>`;
            }

            // Classes / spell lists
            if (data.dnd_class || data.spell_lists?.length > 0) {
                const classes = data.dnd_class || data.spell_lists?.join(', ') || 'Unknown';
                spellContent += `
                    <section>
                        <h3>Classes</h3>
                        <p>${classes}</p>
                    </section>`;
            }

            // Fallback if nothing substantial
            if (!spellContent.trim() || spellContent === '<div class="stat-block" style="margin-bottom: 1.5em;"></div>') {
                spellContent = '<p style="color: #e67e22; font-style: italic;">No detailed spell information available in API response.</p>';
            }

            contentHtml += `<div class="description-block">${spellContent}</div>`;
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
        // Classes display logic
        else if (route === "classes") {
            let allContent = "";
        
            if (data.desc) {
                allContent += `<section>${marked.parse(data.desc)}</section>`;
            }
        
            if (data.hit_dice || data.hp_at_1st_level || data.hp_at_higher_levels) {
                allContent += `<section><h3>Hit Points</h3>`;
                if (data.hit_dice) allContent += `<p><strong>Hit Dice:</strong> ${data.hit_dice}</p>`;
                if (data.hp_at_1st_level) allContent += `<p><strong>Hit Points at 1st Level:</strong> ${data.hp_at_1st_level}</p>`;
                if (data.hp_at_higher_levels) allContent += `<p><strong>Hit Points at Higher Levels:</strong> ${data.hp_at_higher_levels}</p>`;
                allContent += `</section>`;
            }
        
            allContent += `<section><h3>Proficiencies</h3>`;
            if (data.prof_armor) allContent += `<p><strong>Armor:</strong> ${data.prof_armor}</p>`;
            if (data.prof_weapons) allContent += `<p><strong>Weapons:</strong> ${data.prof_weapons}</p>`;
            if (data.prof_tools) allContent += `<p><strong>Tools:</strong> ${data.prof_tools}</p>`;
            if (data.prof_saving_throws) allContent += `<p><strong>Saving Throws:</strong> ${data.prof_saving_throws}</p>`;
            if (data.prof_skills) allContent += `<p><strong>Skills:</strong> ${data.prof_skills}</p>`;
            allContent += `</section>`;
        
            if (data.equipment) {
                allContent += `<section>${marked.parse(data.equipment)}</section>`;
            }
        
            if (data.table) {
                allContent += `<section>${marked.parse(data.table)}</section>`;
            }
        
            if (data.spellcasting_ability) {
                allContent += `<section><h3>Spellcasting</h3>`;
                allContent += `<p><strong>Spellcasting Ability:</strong> ${data.spellcasting_ability}</p>`;
                if (data.spellcasting) allContent += marked.parse(data.spellcasting);
                allContent += `</section>`;
            }
        
            if (Array.isArray(data.archetypes) && data.archetypes.length > 0) {
                allContent += `<h2>${data.subtypes_name || 'Archetypes'}</h2>`;
                
                data.archetypes.forEach(arch => {
                    let archHtml = `<h3>${arch.name}</h3>`;
                    
                    if (arch.desc && typeof arch.desc === 'string' && arch.desc.trim().length > 0) {
                        archHtml += marked.parse(arch.desc);
                    }
                    
                    if (arch.table && typeof arch.table === 'string' && arch.table.trim().length > 0) {
                        archHtml += marked.parse(arch.table);
                    }
                    
                    if (Array.isArray(arch.features)) {
                        arch.features.forEach(feat => {
                            let featHtml = '';
                            if (feat.name) featHtml += `<h4>${feat.name}</h4>`;
                            if (feat.desc && typeof feat.desc === 'string') {
                                featHtml += marked.parse(feat.desc);
                            }
                            archHtml += featHtml;
                        });
                    }
                    
                    Object.entries(arch).forEach(([key, value]) => {
                        if (typeof value === 'string' && 
                            value.trim().length > 20 && 
                            (value.includes('#####') || value.includes('Starting at') || value.includes('level')) &&
                            key !== 'desc' && key !== 'table' && key !== 'name' && key !== 'slug') {
                            archHtml += marked.parse(value);
                        }
                    });
                    
                    allContent += `<section style="margin: 20px 0; padding: 15px; border: 1px solid #c9ad6a; border-radius: 6px;">${archHtml}</section>`;
                });
            }
    
            contentHtml += `<div class="description-block">${allContent || "<p>No description available.</p>"}</div>`;
        }
        // Main Race display logic    
        else if (route === "races") {
            let allContent = "";
        
            if (data.desc) {
                allContent += `<section>${marked.parse(data.desc)}</section>`;
            }
        
            if (data.asi_desc) {
                allContent += `<section>${marked.parse(data.asi_desc)}</section>`;
            }
        
            if (data.age) allContent += `<section>${marked.parse(data.age)}</section>`;
            if (data.alignment) allContent += `<section>${marked.parse(data.alignment)}</section>`;
            if (data.size) allContent += `<section>${marked.parse(data.size)}</section>`;
        
            if (data.speed_desc) {
                allContent += `<section>${marked.parse(data.speed_desc)}</section>`;
            } else if (data.speed && typeof data.speed === 'object') {
                const speedText = Object.entries(data.speed).map(([k, v]) => `${k} ${v} ft.`).join(', ');
                allContent += `<section><h3>Speed</h3><p>Your base walking speed is ${speedText}.</p></section>`;
            }
        
            if (data.vision) allContent += `<section>${marked.parse(data.vision)}</section>`;
            if (data.languages) allContent += `<section>${marked.parse(data.languages)}</section>`;
        
            if (data.traits) {
                allContent += `<section><h3>Racial Traits</h3>${marked.parse(data.traits)}</section>`;
            }
        
            if (Array.isArray(data.subraces) && data.subraces.length > 0) {
                allContent += `<h2>Subraces</h2>`;
                data.subraces.forEach(sub => {
                    let subHtml = `<h3>${sub.name}</h3>`;
                    if (sub.desc) subHtml += marked.parse(sub.desc);
                    if (sub.asi_desc) subHtml += `<p>${marked.parse(sub.asi_desc)}</p>`;
                    if (sub.traits) {
                        subHtml += `<h4>Subrace Traits</h4>${marked.parse(sub.traits)}`;
                    }
                    allContent += `<section style="margin: 20px 0; padding: 15px; border: 1px solid #c9ad6a; border-radius: 6px;">${subHtml}</section>`;
                });
            } else {
                allContent += `<p style="color: orange;">No subraces data available in this response.</p>`;
            }
        
            contentHtml += `<div class="description-block">${allContent || "<p>No description available.</p>"}</div>`;
        }
        
        // Default / fallback for other categories
        else {
            contentHtml += `<div class="description-block">${marked.parse(data.desc || "<p>No description available.</p>")}</div>`;
        }

        modalBody.innerHTML = contentHtml;
    } catch (e) { 
        console.error("Fetch error:", e);
        modalBody.innerHTML = `<p class="error">Failed to load details. The archives may be incomplete.</p>`; 
    }
}

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
