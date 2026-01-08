// Get zipcode from URL only (no localStorage persistence)
const urlParams = new URLSearchParams(window.location.search);
const zipcode = urlParams.get('zip');

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const errorTextEl = document.getElementById('error-text');
const vigilsContentEl = document.getElementById('vigils-content');
const vigilsListEl = document.getElementById('vigils-list');
const currentZipcodeEl = document.getElementById('current-zipcode');

// If no zipcode, redirect to home
if (!zipcode) {
    window.location.href = 'index.html';
}

// Display current zipcode
currentZipcodeEl.textContent = zipcode;

// Change zipcode button
document.getElementById('change-zipcode').addEventListener('click', () => {
    window.location.href = 'index.html';
});

// Show error
function showError(message) {
    errorTextEl.textContent = message;
    loadingEl.classList.add('hidden');
    errorEl.classList.remove('hidden');
}

// Format date and time for display
function formatVigilDateTime(date, time) {
    // Parse date string (YYYY-MM-DD) to ensure local timezone
    const [year, month, day] = date.split('-').map(num => parseInt(num));
    const vigilDate = new Date(year, month - 1, day); // month is 0-indexed

    const dateStr = vigilDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Convert 24h time to 12h format
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    return { dateStr, timeStr };
}

// Create vigil card
function createVigilCard(vigil) {
    const card = document.createElement('div');
    card.className = 'vigil-card';

    const { dateStr, timeStr } = formatVigilDateTime(vigil.date, vigil.time);
    const organizer = vigil.organizerName || 'Anonymous';

    card.innerHTML = `
        <div class="vigil-header">
            <div class="vigil-date-time">
                <div class="vigil-date">${dateStr}</div>
                <div class="vigil-time">${timeStr}</div>
            </div>
        </div>
        <div class="vigil-info">
            <div class="info-item vigil-location-display">
                <span class="info-label">📍 Location:</span>
                <span class="vigil-location-text">${vigil.location}</span>
            </div>
            ${vigil.description ? `
                <div class="info-item vigil-description-display">
                    <span class="info-label">Details:</span>
                    <span>${vigil.description}</span>
                </div>
            ` : ''}
            ${vigil.contact ? `
                <div class="info-item">
                    <span class="info-label">Contact:</span>
                    <span>${vigil.contact}</span>
                </div>
            ` : ''}
        </div>
        <div class="vigil-footer">
            <span class="organizer-info">Organized by ${organizer}</span>
        </div>
    `;

    return card;
}

// Display vigils
async function displayVigils(vigils) {
    vigilsListEl.innerHTML = '';

    if (vigils.length === 0) {
        vigilsListEl.innerHTML = '<p class="no-vigils-text">No vigils posted yet. Be the first to organize one!</p>';
        return;
    }

    // Sort by date (soonest first)
    const sorted = vigils.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateA - dateB;
    });

    sorted.forEach(vigil => {
        const card = createVigilCard(vigil);
        vigilsListEl.appendChild(card);
    });
}

// Fetch and display location info
async function fetchAndDisplayLocation(zip) {
    const locationInfoEl = document.getElementById('location-info');

    try {
        const response = await fetch(`/api/zipcode-info/${zip}`);

        if (!response.ok) {
            throw new Error('Failed to fetch location info');
        }

        const data = await response.json();
        const place = data.places[0];

        locationInfoEl.innerHTML = `
            <div class="location-info-grid">
                <div class="location-item">
                    <span class="location-label">City</span>
                    <span class="location-value">${place['place name']}</span>
                </div>
                <div class="location-item">
                    <span class="location-label">State</span>
                    <span class="location-value">${place.state} (${place['state abbreviation']})</span>
                </div>
                <div class="location-item">
                    <span class="location-label">Coordinates</span>
                    <span class="location-value">${parseFloat(place.latitude).toFixed(4)}, ${parseFloat(place.longitude).toFixed(4)}</span>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error fetching location info:', error);
        locationInfoEl.innerHTML = '<p class="no-vigils-text">Unable to load location info.</p>';
    }
}

// Vigil modal functions
function openAddVigilModal() {
    document.getElementById('add-vigil-modal').classList.remove('hidden');
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('vigil-date').setAttribute('min', today);
}

function closeAddVigilModal() {
    document.getElementById('add-vigil-modal').classList.add('hidden');
    document.getElementById('add-vigil-form').reset();
}

// Add vigil button in header
document.getElementById('add-vigil-btn-header').addEventListener('click', openAddVigilModal);

// Vigil form submission
document.getElementById('add-vigil-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const location = document.getElementById('vigil-location').value.trim();
    const date = document.getElementById('vigil-date').value;
    const time = document.getElementById('vigil-time').value;
    const description = document.getElementById('vigil-description').value.trim();
    const contact = document.getElementById('vigil-contact').value.trim();
    const organizerName = document.getElementById('organizer-name').value.trim() || 'Anonymous';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
        const uuid = await bdoClient.createVigil(
            zipcode,
            location,
            date,
            time,
            description,
            contact,
            organizerName
        );

        // Store locally
        bdoClient.storeVigilLocally(zipcode, uuid);

        closeAddVigilModal();

        // Refresh the vigils list
        await displayVigils(await bdoClient.getVigilsForZipcode(zipcode));

        alert('Vigil posted successfully!');
    } catch (error) {
        console.error('Error posting vigil:', error);
        alert('Failed to post vigil. Please try again.');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Vigil';
    }
});

// Load vigils on page load
(async () => {
    try {
        // Load location info
        fetchAndDisplayLocation(zipcode);

        // Load vigils
        const vigils = await bdoClient.getVigilsForZipcode(zipcode);
        await displayVigils(vigils);

        // Show content, hide loading
        loadingEl.classList.add('hidden');
        vigilsContentEl.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading vigils:', error);
        showError('Unable to load vigils. Please check your zipcode and try again.');
    }
})();
