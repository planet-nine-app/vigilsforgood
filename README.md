# Vigils for Renee Nicole Good

A platform for coordinating vigils to remember Renee Nicole Good who was murdered by ICE.

## About Renee

Renee Nicole Good, 37, was a U.S. citizen, mother of three, and a caring neighbor. She was murdered by ICE in Minneapolis while caring for her neighbors. This website provides a space for communities to organize vigils in her memory and demand justice.

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

## In Memory

This platform exists to honor Renee Nicole Good and support her family. Her life mattered. Her story matters. Justice must be served.
