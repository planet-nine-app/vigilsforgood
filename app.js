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
