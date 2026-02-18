const API_BASE = "https://api.open5e.com";
let currentCategory = ""; 
let allFetchedItems = [];
let spellCache = null; // Cache all spells to avoid repeated API calls 

// --- SPELL CACHE SYSTEM ---
async function getAllSpells() {
    // Return cached spells if we already have them
    if (spellCache) {
        console.log('Using cached spells');
        return spellCache;
    }
    
    // Otherwise fetch all spells with parallel requests for speed
    console.log('Fetching all spells from API...');
    let allSpells = [];
    
    // First, get the first page to see how many total results there are
    const firstResponse = await fetch(`${API_BASE}/spells/?limit=500`);
    const firstData = await firstResponse.json();
    allSpells = firstData.results;
    
    // Calculate how many more pages we need
    const total = firstData.count;
    const pageSize = 500;
    const totalPages = Math.ceil(total / pageSize);
    
    console.log(`Total spells: ${total}, fetching ${totalPages} pages...`);
    
    // Fetch remaining pages in parallel for speed
    if (totalPages > 1) {
        const pagePromises = [];
        for (let i = 1; i < totalPages; i++) {
            const offset = i * pageSize;
            pagePromises.push(
                fetch(`${API_BASE}/spells/?limit=${pageSize}&offset=${offset}`)
                    .then(r => r.json())
                    .then(data => data.results)
            );
        }
        
        const remainingPages = await Promise.all(pagePromises);
        remainingPages.forEach(pageResults => {
            allSpells = allSpells.concat(pageResults);
        });
    }
    
    console.log(`Loaded ${allSpells.length} total spells`);
    
    // Deduplicate spells by slug (unique identifier)
    const uniqueSpells = [];
    const seenSlugs = new Set();
    
    allSpells.forEach(spell => {
        if (!seenSlugs.has(spell.slug)) {
            seenSlugs.add(spell.slug);
            uniqueSpells.push(spell);
        }
    });
    
    console.log(`After deduplication: ${uniqueSpells.length} unique spells`);
    spellCache = uniqueSpells; // Store deduplicated cache
    return uniqueSpells;
}

// --- SOURCE FILTER SYSTEM ---
function setupSourceFilter(items) {
    const filterContainer = document.getElementById('filter-container');
    const checkboxContainer = document.getElementById('source-checkboxes');
    
    if (!filterContainer || !checkboxContainer) return;
    
    // Get unique sources from items
    const sources = new Set();
    items.forEach(item => {
        const source = item.document__title || 'SRD';
        sources.add(source);
    });
    
    // Sort sources alphabetically
    const sortedSources = Array.from(sources).sort();
    
    // Create filter header with buttons
    const headerDiv = filterContainer.querySelector('div');
    if (headerDiv) {
        headerDiv.innerHTML = `
            <strong>Filter by Source:</strong>
            <div style="display: flex; gap: 10px;">
                <button onclick="selectAllSources()" style="padding: 5px 10px; cursor: pointer; background: var(--deep-red); color: white; border: none; border-radius: 4px; font-size: 0.8rem;">Select All</button>
                <button onclick="deselectAllSources()" style="padding: 5px 10px; cursor: pointer; background: #666; color: white; border: none; border-radius: 4px; font-size: 0.8rem;">Deselect All</button>
            </div>
        `;
    }
    
    // Create checkboxes
    checkboxContainer.innerHTML = '';
    sortedSources.forEach(source => {
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 5px; border-radius: 4px; transition: background 0.2s;';
        label.onmouseover = () => label.style.background = 'rgba(0,0,0,0.05)';
        label.onmouseout = () => label.style.background = 'transparent';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = source;
        checkbox.checked = true; // All checked by default
        checkbox.onchange = applySourceFilter;
        checkbox.style.cursor = 'pointer';
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(source));
        checkboxContainer.appendChild(label);
    });
    
    filterContainer.style.display = 'block';
}

function selectAllSources() {
    const checkboxes = document.querySelectorAll('#source-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = true);
    applySourceFilter();
}

function deselectAllSources() {
    const checkboxes = document.querySelectorAll('#source-checkboxes input[type="checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);
    applySourceFilter();
}

function applySourceFilter() {
    const checkboxes = document.querySelectorAll('#source-checkboxes input[type="checkbox"]');
    const selectedSources = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);
    
    // Filter allFetchedItems based on selected sources
    const filtered = allFetchedItems.filter(item => {
        const source = item.document__title || 'SRD';
        return selectedSources.includes(source);
    });
    
    // Re-render with filtered items
    renderResults(filtered, currentCategory, null, null);
}

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
        // Special handling for spells - use cache system
        if (target === 'spells') {
            const allSpells = await getAllSpells();
            
            // Sort by level
            const sortedSpells = [...allSpells].sort((a, b) => {
                const levelA = a.level === 'Cantrip' ? 0 : parseInt(a.level) || 0;
                const levelB = b.level === 'Cantrip' ? 0 : parseInt(b.level) || 0;
                if (levelA !== levelB) return levelA - levelB;
                return a.name.localeCompare(b.name);
            });
            
            allFetchedItems = sortedSpells;
            renderResults(allFetchedItems, currentCategory, null, null);
            setupSourceFilter(allFetchedItems);
            if (filterUI) filterUI.style.display = 'block';
        } else {
            // Standard single-page fetch for other categories
            const response = await fetch(url);
            const data = await response.json();
            
            // Use data.feats for local file, data.results for API
            allFetchedItems = data.feats ? data.feats : data.results;

            if (filterUI) {
                filterUI.style.display = currentCategory.includes('spells') ? 'block' : 'none';
            }

            renderResults(allFetchedItems, currentCategory, data.next, data.previous);
        }
    } catch (error) {
        display.innerHTML = `<p class="error">Failed to summon data from ${url}.</p>`;
    }
}

// --- 2. CLASS-SPECIFIC SPELL FILTERING ---
async function fetchSpellsByClass(className) {
    const display = document.getElementById('display-area');
    const filterUI = document.getElementById('filter-container');
    display.innerHTML = '<div class="loader">Consulting the archives...</div>';
    
    currentCategory = `spells-${className.toLowerCase()}`;
    
    try {
        // Use cached spell system
        const allSpells = await getAllSpells();
        
        // Filter spells that include this class
        // The API stores classes as a string like "Bard, Sorcerer, Wizard"
        const classSpells = allSpells.filter(spell => {
            if (!spell.dnd_class) return false;
            // Check if the class name appears in the dnd_class string
            return spell.dnd_class.toLowerCase().includes(className.toLowerCase());
        });
        
        // Sort by level
        classSpells.sort((a, b) => {
            const levelA = a.level === 'Cantrip' ? 0 : parseInt(a.level) || 0;
            const levelB = b.level === 'Cantrip' ? 0 : parseInt(b.level) || 0;
            if (levelA !== levelB) return levelA - levelB;
            return a.name.localeCompare(b.name);
        });
        
        allFetchedItems = classSpells;

        renderResults(allFetchedItems, `${className} Spells`, null, null);
        setupSourceFilter(allFetchedItems);
        if (filterUI) {
            filterUI.style.display = 'block';
        }
    } catch (error) {
        display.innerHTML = `<p class="error">Failed to summon ${className} spells from the archives.</p>`;
        console.error('Error fetching spells:', error);
    }
}

// --- 3. SEARCH LOGIC ---
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

// --- 4. RENDERING ENGINE ---
function renderResults(items, category, nextUrl, prevUrl) {
    const display = document.getElementById('display-area');
    let displayTitle = category.replace(/-/g, ' ').split('?')[0];
    let html = `<h1>${displayTitle.toUpperCase()}</h1>`;
    
    if (!items || items.length === 0) {
        html += "<p>No entries found in this archive.</p>";
        display.innerHTML = html;
        return;
    }

    // Add count for spells
    const cat = category.toLowerCase();
    if (cat.includes('spells')) {
        html += `<p style="color: #666; font-style: italic; margin-bottom: 15px;">Total Spells: ${items.length}</p>`;
    }

    let tableHeader = "";
    let tableRows = "";


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
    // Spell Table (with Level column and grouping)
    else if (cat.includes('spells')) {
        // Group spells by level for better organization
        let currentLevel = null;
        let groupedRows = '';
        
        items.forEach((item, index) => {
            const level = item.level === 'Cantrip' ? 0 : parseInt(item.level) || 0;
            const levelDisplay = item.level === 'Cantrip' ? 'Cantrip' : `Level ${item.level}`;
            
            // Add level header row when level changes
            if (currentLevel !== level) {
                currentLevel = level;
                const headerText = item.level === 'Cantrip' ? 'CANTRIPS' : `LEVEL ${item.level} SPELLS`;
                groupedRows += `
                    <tr style="background: var(--deep-red); pointer-events: none;">
                        <td colspan="4" style="color: white; font-weight: bold; text-align: center; padding: 10px; letter-spacing: 2px;">
                            ${headerText}
                        </td>
                    </tr>`;
            }
            
            groupedRows += `
            <tr onclick="viewDetails('spells', '${item.slug}')">
                <td><strong>${item.name}</strong></td>
                <td class="cell-bold">${levelDisplay}</td>
                <td>${item.school || '—'}</td>
                <td class="source-tag">${item.document__title || "SRD"}</td>
            </tr>`;
        });
        
        tableHeader = `<tr><th>Name</th><th>Level</th><th>School</th><th>Source</th></tr>`;
        tableRows = groupedRows;
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
    // Standard Tables (Items, etc.)
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

// --- 5. DETAIL MODAL ---
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

// --- 7. START PAGE ---
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
            
            <div id="spell-status" style="margin-top: 30px; padding: 15px; background: #f0f0f0; border-radius: 8px; font-style: italic; color: #666;">
                <span id="spell-load-indicator">⏳ Loading spell database in background...</span>
            </div>
            
            <div class="session-note">
                <p><em>"The evening is young, and the dungeon is deep. May your natural 20s be many."</em></p>
            </div>
        </div>
    `;
}

window.onload = () => {
    showStartPage();
    
    // Preload spells in the background for faster access
    console.log('Preloading spell database...');
    getAllSpells().then(() => {
        console.log('Spell database ready!');
        // Update the status indicator if it exists
        const indicator = document.getElementById('spell-load-indicator');
        if (indicator) {
            indicator.innerHTML = '✅ Spell database loaded! Instant spell lists ready.';
            indicator.style.color = '#228b22';
        }
    }).catch(err => {
        console.error('Failed to preload spells:', err);
        const indicator = document.getElementById('spell-load-indicator');
        if (indicator) {
            indicator.innerHTML = '⚠️ Spell preload failed. Lists will load on demand.';
            indicator.style.color = '#e67e22';
        }
    });
};