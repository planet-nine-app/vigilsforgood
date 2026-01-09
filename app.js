// Disable zipcode persistence for now
// document.addEventListener('DOMContentLoaded', () => {
//     const savedZipcode = localStorage.getItem('zipcode');
//     if (savedZipcode) {
//         // Redirect to reps page if zipcode exists
//         window.location.href = `reps.html?zip=${savedZipcode}`;
//     }
// });

// Handle form submission (Find a Vigil)
const form = document.getElementById('zipcode-form');
const errorMessage = document.getElementById('error-message');

// Handle "Post a Vigil" button
document.getElementById('post-vigil-btn').addEventListener('click', () => {
    const zipcodeInput = document.getElementById('zipcode');
    const zipcode = zipcodeInput.value.trim();

    // Validate zipcode format
    if (!/^\d{5}$/.test(zipcode)) {
        errorMessage.textContent = 'Please enter a valid 5-digit zipcode';
        return;
    }

    // Clear any previous error
    errorMessage.textContent = '';

    // Redirect to vigils page with post mode
    window.location.href = `vigils.html?zip=${zipcode}&post=true`;
});

// Handle form submission (Find a Vigil)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const zipcodeInput = document.getElementById('zipcode');
    const zipcode = zipcodeInput.value.trim();

    // Validate zipcode format
    if (!/^\d{5}$/.test(zipcode)) {
        errorMessage.textContent = 'Please enter a valid 5-digit zipcode';
        return;
    }

    // Clear any previous error
    errorMessage.textContent = '';

    // Redirect to vigils page
    window.location.href = `vigils.html?zip=${zipcode}`;
});

// Clear error message when user types
document.getElementById('zipcode').addEventListener('input', () => {
    errorMessage.textContent = '';
});

// Fetch and display vigil count
async function fetchVigilCounts() {
    try {
        const response = await fetch('/api/vigils-count');
        if (!response.ok) {
            throw new Error('Failed to fetch vigil count');
        }

        const data = await response.json();

        // Update the counter display
        document.getElementById('total-vigils').textContent = data.total;
    } catch (error) {
        console.error('Error fetching vigil count:', error);
        // Keep the dash placeholder if there's an error
    }
}

// Load count on page load
fetchVigilCounts();

// Format date and time for display
function formatVigilDateTime(date, time) {
    const [year, month, day] = date.split('-').map(num => parseInt(num));
    const vigilDate = new Date(year, month - 1, day);

    const dateStr = vigilDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const timeStr = `${displayHour}:${minutes} ${ampm}`;

    return `${dateStr} at ${timeStr}`;
}

// Fetch and display recent vigils
async function fetchRecentVigils() {
    try {
        const response = await fetch('/api/vigils-recent');
        if (!response.ok) {
            throw new Error('Failed to fetch recent vigils');
        }

        const data = await response.json();
        const vigilsListEl = document.getElementById('recent-vigils-list');

        if (data.vigils.length === 0) {
            vigilsListEl.innerHTML = '<p class="loading-text">No vigils yet. Be the first to post one!</p>';
            return;
        }

        // Render vigil cards
        vigilsListEl.innerHTML = data.vigils.map(vigil => `
            <div class="recent-vigil-card">
                <div class="recent-vigil-location">${vigil.location}</div>
                <div class="recent-vigil-datetime">${formatVigilDateTime(vigil.date, vigil.time)}</div>
                <div class="recent-vigil-zipcode">Zipcode: ${vigil.zipcode}</div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error fetching recent vigils:', error);
        document.getElementById('recent-vigils-list').innerHTML =
            '<p class="loading-text">Unable to load recent vigils</p>';
    }
}

// Load recent vigils on page load
fetchRecentVigils();
