// BDO Client for storing and retrieving representative answers
// Using proxy server to avoid CORS issues

class BDOClient {
    constructor() {
        this.baseUrl = '/api/bdo';
    }

    // Create a new BDO with answer data
    async createAnswer(repName, repState, repDistrict, answerLink, submittedBy = 'anonymous') {
        const answerData = {
            representativeName: repName,
            state: repState,
            district: repDistrict,
            answerLink: answerLink,
            submittedBy: submittedBy,
            submittedAt: Date.now(),
            type: 'healthcare-answer'
        };

        try {
            const response = await fetch(`${this.baseUrl}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: answerData,
                    public: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create BDO');
            }

            const result = await response.json();
            return result.uuid;
        } catch (error) {
            console.error('Error creating answer BDO:', error);
            throw error;
        }
    }

    // Get all answers for a specific representative
    async getAnswersForRep(repName, repState, repDistrict) {
        // For now, we'll need to query by a search/filter mechanism
        // This is a placeholder - BDO API might need specific query endpoints
        // We'll store a mapping in localStorage as a simple solution
        const repKey = this.getRepKey(repName, repState, repDistrict);
        const storedAnswers = localStorage.getItem(`answers_${repKey}`);

        if (!storedAnswers) {
            return [];
        }

        const answerUUIDs = JSON.parse(storedAnswers);
        const answers = [];

        for (const uuid of answerUUIDs) {
            try {
                const answer = await this.getAnswer(uuid);
                if (answer) {
                    answers.push(answer);
                }
            } catch (error) {
                console.error(`Failed to fetch answer ${uuid}:`, error);
            }
        }

        return answers;
    }

    // Get a specific answer by UUID
    async getAnswer(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}`);

            if (!response.ok) {
                throw new Error('Failed to fetch BDO');
            }

            const result = await response.json();
            return {
                uuid: uuid,
                ...result.data
            };
        } catch (error) {
            console.error('Error fetching answer BDO:', error);
            throw error;
        }
    }

    // Store answer UUID locally for a representative
    storeAnswerLocally(repName, repState, repDistrict, uuid) {
        const repKey = this.getRepKey(repName, repState, repDistrict);
        const storedAnswers = localStorage.getItem(`answers_${repKey}`);

        let answerUUIDs = storedAnswers ? JSON.parse(storedAnswers) : [];

        if (!answerUUIDs.includes(uuid)) {
            answerUUIDs.push(uuid);
            localStorage.setItem(`answers_${repKey}`, JSON.stringify(answerUUIDs));
        }
    }

    // Generate a unique key for a representative
    getRepKey(repName, repState, repDistrict) {
        return `${repName}_${repState}_${repDistrict}`.replace(/\s+/g, '_').toLowerCase();
    }

    // Organization methods
    async createOrganization(zipcode, orgName, orgDescription, orgLink, submittedBy = 'anonymous') {
        const orgData = {
            zipcode: zipcode,
            organizationName: orgName,
            description: orgDescription,
            link: orgLink || null,
            submittedBy: submittedBy,
            submittedAt: Date.now(),
            type: 'healthcare-organization'
        };

        try {
            const response = await fetch(`${this.baseUrl}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: orgData,
                    public: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create organization BDO');
            }

            const result = await response.json();
            return result.uuid;
        } catch (error) {
            console.error('Error creating organization BDO:', error);
            throw error;
        }
    }

    async getOrganizationsForZipcode(zipcode) {
        const zipKey = `orgs_${zipcode}`;
        const storedOrgs = localStorage.getItem(zipKey);

        if (!storedOrgs) {
            return [];
        }

        const orgUUIDs = JSON.parse(storedOrgs);
        const organizations = [];

        for (const uuid of orgUUIDs) {
            try {
                const org = await this.getOrganization(uuid);
                if (org) {
                    organizations.push(org);
                }
            } catch (error) {
                console.error(`Failed to fetch organization ${uuid}:`, error);
            }
        }

        return organizations;
    }

    async getOrganization(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}`);

            if (!response.ok) {
                throw new Error('Failed to fetch organization BDO');
            }

            const result = await response.json();
            return {
                uuid: uuid,
                ...result.data
            };
        } catch (error) {
            console.error('Error fetching organization BDO:', error);
            throw error;
        }
    }

    storeOrganizationLocally(zipcode, uuid) {
        const zipKey = `orgs_${zipcode}`;
        const storedOrgs = localStorage.getItem(zipKey);

        let orgUUIDs = storedOrgs ? JSON.parse(storedOrgs) : [];

        if (!orgUUIDs.includes(uuid)) {
            orgUUIDs.push(uuid);
            localStorage.setItem(zipKey, JSON.stringify(orgUUIDs));
        }
    }

    // Vigil methods - server now stores all vigils in single BDO
    async createVigil(zipcode, location, date, time, description, contact, organizerName = 'anonymous') {
        const vigilData = {
            zipcode: zipcode,
            location: location,
            date: date,
            time: time,
            description: description || null,
            contact: contact || null,
            organizerName: organizerName,
            type: 'justice-vigil'
        };

        try {
            const response = await fetch(`${this.baseUrl}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: vigilData,
                    public: true
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create vigil');
            }

            const result = await response.json();
            console.log(`✓ Vigil created: ${result.uuid}, synced to: ${result.syncedTo?.join(', ')}`);
            return result.uuid;
        } catch (error) {
            console.error('Error creating vigil:', error);
            throw error;
        }
    }

    async getVigilsForZipcode(zipcode) {
        try {
            const response = await fetch(`/api/vigils/${zipcode}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vigils');
            }

            const result = await response.json();
            return result.vigils || [];
        } catch (error) {
            console.error('Error fetching vigils for zipcode:', error);
            return [];
        }
    }

    async getVigil(uuid) {
        try {
            const response = await fetch(`${this.baseUrl}/${uuid}`);

            if (!response.ok) {
                throw new Error('Failed to fetch vigil');
            }

            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error('Error fetching vigil:', error);
            throw error;
        }
    }

    // No longer need local storage methods - server handles persistence
    storeVigilLocally(zipcode, uuid) {
        // No-op: server now stores everything in BDO
    }
}

// Export for use in other files
const bdoClient = new BDOClient();
