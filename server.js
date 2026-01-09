import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import bdo from 'bdo-js';
import sessionless from 'sessionless-node';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname)));

// BDO Configuration
const BDO_SERVERS = [
    'https://dev.bdo.allyabase.com',
    'https://ent.bdo.allyabase.com',
    'https://ind.bdo.allyabase.com'
];

const VIGILS_HASH = 'justiceforgood-all-vigils';
const KEYS_FILE = path.join(__dirname, '.bdo-keys.json');
const ADMIN_PUBKEY = '030202e359413cdf78d8202e80ebec05e7b2edc51750de45a8eb9326e9f824d7b8';

// Cache for zipcode coordinates to reduce API calls
const zipcodeCoordinatesCache = new Map();

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3959; // Earth's radius in miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

// Get coordinates for a zipcode (with caching)
async function getZipcodeCoordinates(zipcode) {
    // Check cache first
    if (zipcodeCoordinatesCache.has(zipcode)) {
        return zipcodeCoordinatesCache.get(zipcode);
    }

    try {
        const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);
        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        const place = data.places[0];
        const coords = {
            lat: parseFloat(place.latitude),
            lon: parseFloat(place.longitude)
        };

        // Cache the result
        zipcodeCoordinatesCache.set(zipcode, coords);
        return coords;
    } catch (error) {
        console.error(`Error fetching coordinates for zipcode ${zipcode}:`, error);
        return null;
    }
}

// Initialize sessionless keys (persistent across server restarts)
let keys = null;

const saveKeys = (k, uuid = null) => {
    keys = k;
    const dataToSave = uuid ? { ...k, uuid } : k;
    fs.writeFileSync(KEYS_FILE, JSON.stringify(dataToSave, null, 2));
    console.log('✓ Saved keys to file');
};

const getKeys = async () => {
    if (!keys) {
        if (fs.existsSync(KEYS_FILE)) {
            const data = JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8'));
            keys = data;
            console.log('✓ Loaded existing keys from file');
        }
    }
    return keys;
};

// Local vigils storage (synced with BDO)
let vigilsData = {
    vigils: {},  // keyed by UUID
    metadata: {
        lastUpdated: null,
        totalVigils: 0
    }
};

// BDO User UUID (one per server instance)
let bdoUserUUID = null;

// Initialize BDO clients for all three servers
const bdoClients = BDO_SERVERS.map(serverUrl => {
    const client = { ...bdo };
    client.baseURL = serverUrl + '/';
    return { serverUrl, client };
});

// Create user on all BDO servers and initialize vigils BDO
async function initializeBDO() {
    const results = [];

    // Load existing keys to check if we already have a BDO user
    await getKeys();

    // If we have keys with a stored UUID, use the existing BDO
    if (keys && keys.uuid) {
        bdoUserUUID = keys.uuid;
        console.log(`✓ Using existing BDO user: ${bdoUserUUID}`);

        for (const { serverUrl } of bdoClients) {
            results.push({ server: serverUrl, uuid: bdoUserUUID, success: true, existing: true });
        }

        return results;
    }

    // No existing keys/UUID, create new user
    for (const { serverUrl, client } of bdoClients) {
        try {
            const uuid = await client.createUser(
                VIGILS_HASH,
                vigilsData,
                saveKeys,
                getKeys
            );

            if (!bdoUserUUID) {
                bdoUserUUID = uuid;
                // Save the UUID along with the keys
                saveKeys(keys, uuid);
            }

            results.push({ server: serverUrl, uuid, success: true, existing: false });
            console.log(`✓ Created BDO user on ${serverUrl}: ${uuid}`);
        } catch (error) {
            console.error(`✗ Failed to initialize ${serverUrl}:`, error.message);
            results.push({ server: serverUrl, error: error.message, success: false });
        }
    }

    return results;
}

// Update vigils BDO on all servers
async function syncVigilsToBDO() {
    const results = [];

    for (const { serverUrl, client } of bdoClients) {
        try {
            await client.updateBDO(
                bdoUserUUID,
                VIGILS_HASH,
                vigilsData,
                true  // public
            );

            results.push({ server: serverUrl, success: true });
            console.log(`✓ Synced vigils to ${serverUrl}`);
        } catch (error) {
            console.error(`✗ Failed to sync to ${serverUrl}:`, error.message);
            results.push({ server: serverUrl, error: error.message, success: false });
        }
    }

    return results;
}

// Load vigils from BDO (from first available server)
async function loadVigilsFromBDO() {
    if (!bdoUserUUID) {
        console.log('No BDO UUID yet, skipping load');
        return null;
    }

    for (const { serverUrl, client } of bdoClients) {
        try {
            const result = await client.getBDO(bdoUserUUID, VIGILS_HASH);
            if (result && result.bdo) {
                vigilsData = result.bdo;
                console.log(`✓ Loaded vigils from ${serverUrl}: ${Object.keys(vigilsData.vigils || {}).length} vigils`);
                return vigilsData;
            }
        } catch (error) {
            console.error(`✗ Failed to load from ${serverUrl}:`, error.message);
        }
    }

    console.log('No vigils found in BDO, starting fresh');
    return null;
}

// Proxy endpoint for Zippopotam.us (zipcode location info)
app.get('/api/zipcode-info/:zipcode', async (req, res) => {
    const { zipcode } = req.params;

    try {
        // Validate zipcode format
        if (!/^\d{5}$/.test(zipcode)) {
            return res.status(400).json({ error: 'Invalid zipcode format' });
        }

        // Fetch from Zippopotam API
        const response = await fetch(`https://api.zippopotam.us/us/${zipcode}`);

        if (!response.ok) {
            throw new Error('Failed to fetch zipcode info');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching zipcode info:', error);
        res.status(500).json({ error: 'Failed to fetch zipcode info' });
    }
});

// Create a vigil - adds to the single BDO and syncs to all servers
app.post('/api/bdo/create', async (req, res) => {
    try {
        const vigilUUID = `vigil-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const vigilData = {
            ...req.body.data,
            uuid: vigilUUID,
            createdAt: Date.now()
        };

        // Add to local vigils object
        vigilsData.vigils[vigilUUID] = vigilData;
        vigilsData.metadata.lastUpdated = Date.now();
        vigilsData.metadata.totalVigils = Object.keys(vigilsData.vigils).length;

        // Sync to all BDO servers
        const syncResults = await syncVigilsToBDO();

        const successfulSyncs = syncResults.filter(r => r.success);
        if (successfulSyncs.length === 0) {
            return res.status(500).json({
                error: 'Failed to sync to any BDO server',
                details: syncResults
            });
        }

        res.json({
            uuid: vigilUUID,
            vigil: vigilData,
            syncedTo: successfulSyncs.map(r => r.server),
            totalVigils: vigilsData.metadata.totalVigils
        });
    } catch (error) {
        console.error('Error creating vigil:', error);
        res.status(500).json({ error: 'Failed to create vigil' });
    }
});

// Get a specific vigil by UUID
app.get('/api/bdo/:uuid', async (req, res) => {
    const { uuid } = req.params;

    try {
        const vigil = vigilsData.vigils[uuid];

        if (!vigil) {
            return res.status(404).json({ error: 'Vigil not found' });
        }

        res.json({
            uuid: uuid,
            data: vigil
        });
    } catch (error) {
        console.error('Error fetching vigil:', error);
        res.status(500).json({ error: 'Failed to fetch vigil' });
    }
});

// Get all vigils for a zipcode (within 10-mile radius)
app.get('/api/vigils/:zipcode', async (req, res) => {
    const { zipcode } = req.params;
    const RADIUS_MILES = 10;

    try {
        // Get coordinates for the search zipcode
        const searchCoords = await getZipcodeCoordinates(zipcode);

        if (!searchCoords) {
            return res.status(400).json({ error: 'Invalid zipcode or coordinates not found' });
        }

        // Get all vigils
        const allVigils = Object.values(vigilsData.vigils);

        // Filter vigils within radius
        const vigilsWithDistance = [];

        for (const vigil of allVigils) {
            const vigilCoords = await getZipcodeCoordinates(vigil.zipcode);

            if (vigilCoords) {
                const distance = calculateDistance(
                    searchCoords.lat,
                    searchCoords.lon,
                    vigilCoords.lat,
                    vigilCoords.lon
                );

                if (distance <= RADIUS_MILES) {
                    vigilsWithDistance.push({
                        ...vigil,
                        distance: parseFloat(distance.toFixed(1))
                    });
                }
            }
        }

        // Sort by distance (closest first)
        vigilsWithDistance.sort((a, b) => a.distance - b.distance);

        res.json({
            zipcode,
            searchRadius: RADIUS_MILES,
            vigils: vigilsWithDistance,
            count: vigilsWithDistance.length
        });
    } catch (error) {
        console.error('Error fetching vigils for zipcode:', error);
        res.status(500).json({ error: 'Failed to fetch vigils' });
    }
});

// Get all vigils (for debugging/admin)
app.get('/api/vigils', async (req, res) => {
    try {
        res.json({
            vigils: Object.values(vigilsData.vigils),
            metadata: vigilsData.metadata,
            bdoUserUUID
        });
    } catch (error) {
        console.error('Error fetching all vigils:', error);
        res.status(500).json({ error: 'Failed to fetch vigils' });
    }
});

// Get vigil counts (total and today)
app.get('/api/vigils-count', async (req, res) => {
    try {
        const allVigils = Object.values(vigilsData.vigils);
        const totalCount = allVigils.length;

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Count vigils happening today
        const todayCount = allVigils.filter(vigil => vigil.date === todayStr).length;

        res.json({
            total: totalCount,
            today: todayCount
        });
    } catch (error) {
        console.error('Error fetching vigil counts:', error);
        res.status(500).json({ error: 'Failed to fetch vigil counts' });
    }
});

// Admin moderation route
app.get('/admin', async (req, res) => {
    const { timestamp, signature } = req.query;

    try {
        // Verify timestamp is provided
        if (!timestamp || !signature) {
            return res.status(400).send('Missing timestamp or signature');
        }

        // Check timestamp is within 2 minutes
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        const timeDiff = Math.abs(now - requestTime);
        const twoMinutes = 2 * 60 * 1000;

        if (timeDiff > twoMinutes) {
            return res.status(401).send('Timestamp expired (must be within 2 minutes)');
        }

        // Verify signature
        const isValid = await sessionless.verifySignature(
            signature,
            timestamp,
            ADMIN_PUBKEY
        );

        if (!isValid) {
            return res.status(403).send('Invalid signature');
        }

        // Generate HTML for vigil moderation
        const vigils = Object.values(vigilsData.vigils);

        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vigil Moderation - Vigils for Renee Nicole Good</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
        }
        .vigil-card {
            background: white;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .vigil-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 15px;
        }
        .vigil-info {
            flex: 1;
        }
        .vigil-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #000;
            margin-bottom: 5px;
        }
        .vigil-meta {
            color: #666;
            font-size: 0.9em;
            margin: 5px 0;
        }
        .vigil-description {
            margin: 15px 0;
            line-height: 1.6;
        }
        .delete-btn {
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
        }
        .delete-btn:hover {
            background: #c82333;
        }
        .delete-btn:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        .stats {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <h1>Vigil Moderation</h1>

    <div class="stats">
        <strong>Total Vigils:</strong> ${vigils.length}
    </div>

    ${vigils.length === 0 ? `
        <div class="empty-state">
            <h2>No vigils to moderate</h2>
            <p>All vigils have been approved or no vigils have been submitted yet.</p>
        </div>
    ` : vigils.map(vigil => `
        <div class="vigil-card" id="vigil-${vigil.uuid}">
            <div class="vigil-header">
                <div class="vigil-info">
                    <div class="vigil-title">${escapeHtml(vigil.location)}</div>
                    <div class="vigil-meta">
                        📍 ${escapeHtml(vigil.zipcode)} |
                        📅 ${escapeHtml(vigil.date)} at ${escapeHtml(vigil.time)}
                    </div>
                    <div class="vigil-meta">
                        👤 Organized by: ${escapeHtml(vigil.organizerName || 'Anonymous')}
                    </div>
                    ${vigil.contact ? `<div class="vigil-meta">✉️ ${escapeHtml(vigil.contact)}</div>` : ''}
                    <div class="vigil-meta" style="font-size: 0.8em; color: #999;">
                        UUID: ${vigil.uuid} | Created: ${new Date(vigil.createdAt).toLocaleString()}
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteVigil('${vigil.uuid}')">
                    Delete
                </button>
            </div>
            ${vigil.description ? `
                <div class="vigil-description">
                    <strong>Description:</strong><br>
                    ${escapeHtml(vigil.description)}
                </div>
            ` : ''}
        </div>
    `).join('')}

    <script>
        async function deleteVigil(uuid) {
            if (!confirm('Are you sure you want to permanently delete this vigil?')) {
                return;
            }

            const btn = event.target;
            btn.disabled = true;
            btn.textContent = 'Deleting...';

            try {
                const response = await fetch('/admin/delete/' + uuid + '?timestamp=${timestamp}&signature=${signature}', {
                    method: 'DELETE'
                });

                if (response.ok) {
                    document.getElementById('vigil-' + uuid).remove();

                    // Check if all vigils are gone
                    const remaining = document.querySelectorAll('.vigil-card').length;
                    if (remaining === 0) {
                        location.reload();
                    }
                } else {
                    alert('Failed to delete vigil: ' + await response.text());
                    btn.disabled = false;
                    btn.textContent = 'Delete';
                }
            } catch (error) {
                alert('Error deleting vigil: ' + error.message);
                btn.disabled = false;
                btn.textContent = 'Delete';
            }
        }
    </script>
</body>
</html>
        `;

        res.send(html);
    } catch (error) {
        console.error('Admin route error:', error);
        res.status(500).send('Server error: ' + error.message);
    }
});

// Admin delete vigil route
app.delete('/admin/delete/:uuid', async (req, res) => {
    const { timestamp, signature } = req.query;
    const { uuid } = req.params;

    try {
        // Verify timestamp is provided
        if (!timestamp || !signature) {
            return res.status(400).send('Missing timestamp or signature');
        }

        // Check timestamp is within 2 minutes
        const now = Date.now();
        const requestTime = parseInt(timestamp);
        const timeDiff = Math.abs(now - requestTime);
        const twoMinutes = 2 * 60 * 1000;

        if (timeDiff > twoMinutes) {
            return res.status(401).send('Timestamp expired');
        }

        // Verify signature
        const isValid = await sessionless.verifySignature(
            signature,
            timestamp,
            ADMIN_PUBKEY
        );

        if (!isValid) {
            return res.status(403).send('Invalid signature');
        }

        // Check if vigil exists
        if (!vigilsData.vigils[uuid]) {
            return res.status(404).send('Vigil not found');
        }

        // Delete vigil
        delete vigilsData.vigils[uuid];
        vigilsData.metadata.lastUpdated = Date.now();
        vigilsData.metadata.totalVigils = Object.keys(vigilsData.vigils).length;

        // Sync to all BDO servers
        const syncResults = await syncVigilsToBDO();

        const successfulSyncs = syncResults.filter(r => r.success);
        if (successfulSyncs.length === 0) {
            return res.status(500).json({
                error: 'Failed to sync deletion to any BDO server',
                details: syncResults
            });
        }

        console.log(`✓ Admin deleted vigil: ${uuid}`);
        res.json({
            success: true,
            uuid,
            syncedTo: successfulSyncs.map(r => r.server),
            remainingVigils: vigilsData.metadata.totalVigils
        });
    } catch (error) {
        console.error('Error deleting vigil:', error);
        res.status(500).send('Server error: ' + error.message);
    }
});

// Helper function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Serve index.html for root path only
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize BDO on server start
(async () => {
    console.log('Initializing BDO connection...');

    // Set sessionless.getKeys for signing operations
    sessionless.getKeys = getKeys;

    const initResults = await initializeBDO();
    const successfulInits = initResults.filter(r => r.success);

    if (successfulInits.length === 0) {
        console.error('⚠️  Failed to initialize any BDO server, running in degraded mode');
    } else {
        console.log(`✓ Successfully initialized ${successfulInits.length}/${BDO_SERVERS.length} BDO servers`);

        // Try to load existing vigils
        await loadVigilsFromBDO();
    }

    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        console.log(`BDO User UUID: ${bdoUserUUID}`);
        console.log(`Current vigils: ${Object.keys(vigilsData.vigils).length}`);
    });
})();
