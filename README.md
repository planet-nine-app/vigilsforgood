# Vigils for Good

A platform for coordinating vigils to remember those murdered by ICE.

## In Memory

**Renee Nicole Good**, 37, was a U.S. citizen, mother of three, and a caring neighbor. She was murdered by ICE in Minneapolis while caring for her neighbors.

**Alex Jeffrey Pretti**, 37, was murdered by ICE while protecting fellow protestors.

This website provides a space for communities to organize vigils in their memory and demand justice.

## Features

- **Find Vigils**: Search for vigils in your area by zipcode
- **Post Vigils**: Share details about vigils you're organizing
- **Community Coordination**: Connect with others demanding accountability
- **Location-based**: See vigils near you and organize locally

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Backend**: Node.js/Express
- **Storage**: BDO (Blockchain Data Objects) via localStorage (temporary in-memory for development)
- **Testing**: Mocha/Chai

## Installation

```bash
npm install
```

## Development

```bash
# Start server
npm start

# Run in development mode with auto-reload
npm dev

# Run tests
npm test
```

Server runs on `http://localhost:3000`

## Data Model

### Vigil Structure
```javascript
{
  zipcode: "55408",
  location: "George Floyd Square",
  date: "2025-01-15",
  time: "18:00",
  description: "Candlelight vigil to remember Renee",
  contact: "example@email.com",
  organizerName: "Community Organizer",
  submittedAt: 1704758400000,
  type: "justice-vigil"
}
```

## Storage

Currently uses in-memory storage for development. For production:
1. Integrate with actual BDO service at `https://dev.bdo.allyabase.com`
2. Implement sessionless authentication for cryptographic signatures
3. Add search/query capabilities to BDO service

## API Endpoints

### Vigil Operations
- `POST /api/bdo/create` - Create a vigil
- `GET /api/bdo/:uuid` - Get vigil details

### Location Services
- `GET /api/zipcode-info/:zipcode` - Get location information for a zipcode

## Contributing

This is a machine's interpretation of what human's may need in this time. Claude is operating solo here.

## License

MIT

## Technical Learnings & Implementation Notes

### 1. BDO Multi-Server Replication Pattern
**Challenge**: Needed persistent, distributed storage without traditional database.

**Solution**: Single BDO object replicated to 3 servers
- All vigils in one BDO (`justiceforgood-all-vigils`)
- Persistent keys in `.bdo-keys.json` survive restarts
- UUID stored with keys ensures consistent identity across deployments

**Key Learning**: Single BDO is simpler than per-vigil BDOs for coordination. Trade-off: entire object updates on each change, acceptable for moderate data sizes (hundreds of vigils).

### 2. Geographic Radius Search (10-mile)
**Implementation**:
- Zippopotam API for zipcode → lat/lon conversion
- Haversine formula for distance calculation
- Map-based coordinate caching to reduce API calls

**Key Learning**: Simple caching prevents redundant API calls. Manual date parsing (`new Date(year, month-1, day)`) avoids timezone issues with ISO date strings.

### 3. Sessionless Admin Authentication
**Pattern**: Cryptographic signature verification
- Admin signs timestamp with private key
- Server verifies signature with hardcoded public key
- 2-minute timestamp window prevents replay attacks
- No session state to manage

**Key Learning**: Perfect for simple admin tools. No cookies, no sessions, no session storage complexity.

### 4. Date/Time Gotchas
**Problem**: `new Date('2025-01-20')` interprets as UTC, causing timezone shifts and "Invalid Date" errors.

**Solution**: Parse date components manually
```javascript
const [year, month, day] = date.split('-').map(num => parseInt(num));
const vigilDate = new Date(year, month - 1, day); // Forces local timezone
```

**Key Learning**: ISO date strings without time default to UTC. For date-only values, always parse components to force local timezone.

### 5. Progressive Enhancement with URL State
**Pattern**: `?post=true` parameter opens form after navigation

**Benefits**:
- Preserves user intent across page loads
- Bookmarkable states
- No complex state management library needed

### 6. Why We Removed the Map
**Attempted**: Custom SVG map with coordinate projection
**Reality**: Cartography is complex
- Accurate US map requires proper GIS projection
- Simplified path looked unprofessional
- Better to show clean list than inaccurate map

**Key Learning**: Don't underestimate mapping complexity. Use Leaflet/Mapbox or skip it entirely.

### Architecture Decisions

**Single BDO vs Per-Vigil BDOs**
- ✅ Simpler coordination across servers
- ✅ Atomic updates (all vigils or none)
- ⚠️ Entire object transmitted on each update
- **Decision**: Good for MVP scale (dozens to hundreds). Revisit at thousands.

**No Real-time Updates**
- Each page load fetches fresh data
- No polling, WebSockets, or SSE
- **Decision**: Sufficient for vigil coordination (not a chat app). Add if vigils posted frequently.

**Why Zippopotam API**
- ✅ Free, no API key
- ✅ Reliable uptime
- ⚠️ US-only
- **Decision**: Perfect for US-focused app. Would need alternative for international expansion.

## In Memory

This platform exists to honor Renee Nicole Good and Alex Jeffrey Pretti, and to support their families. They died protecting their neighbors. Their stories matter. Justice must be served.
