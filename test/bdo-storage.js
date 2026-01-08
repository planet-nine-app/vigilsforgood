import { should } from 'chai';
import fetch from 'node-fetch';

should();

const BASE_URL = 'http://localhost:3000';
const BDO_API_URL = `${BASE_URL}/api/bdo`;

// Mock localStorage for Node.js environment
class LocalStorageMock {
    constructor() {
        this.store = {};
    }

    getItem(key) {
        return this.store[key] || null;
    }

    setItem(key, value) {
        this.store[key] = value.toString();
    }

    removeItem(key) {
        delete this.store[key];
    }

    clear() {
        this.store = {};
    }
}

global.localStorage = new LocalStorageMock();
global.fetch = fetch;

// BDO Client implementation
class BDOClient {
    constructor() {
        this.baseUrl = BDO_API_URL;
    }

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
    }

    async getAnswer(uuid) {
        const response = await fetch(`${this.baseUrl}/${uuid}`);

        if (!response.ok) {
            throw new Error('Failed to fetch BDO');
        }

        const result = await response.json();
        return {
            uuid: uuid,
            ...result.data
        };
    }

    async getAnswersForRep(repName, repState, repDistrict) {
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

    storeAnswerLocally(repName, repState, repDistrict, uuid) {
        const repKey = this.getRepKey(repName, repState, repDistrict);
        const storedAnswers = localStorage.getItem(`answers_${repKey}`);

        let answerUUIDs = storedAnswers ? JSON.parse(storedAnswers) : [];

        if (!answerUUIDs.includes(uuid)) {
            answerUUIDs.push(uuid);
            localStorage.setItem(`answers_${repKey}`, JSON.stringify(answerUUIDs));
        }
    }

    getRepKey(repName, repState, repDistrict) {
        return `${repName}_${repState}_${repDistrict}`.replace(/\s+/g, '_').toLowerCase();
    }

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
    }

    async getOrganization(uuid) {
        const response = await fetch(`${this.baseUrl}/${uuid}`);

        if (!response.ok) {
            throw new Error('Failed to fetch organization BDO');
        }

        const result = await response.json();
        return {
            uuid: uuid,
            ...result.data
        };
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

    storeOrganizationLocally(zipcode, uuid) {
        const zipKey = `orgs_${zipcode}`;
        const storedOrgs = localStorage.getItem(zipKey);

        let orgUUIDs = storedOrgs ? JSON.parse(storedOrgs) : [];

        if (!orgUUIDs.includes(uuid)) {
            orgUUIDs.push(uuid);
            localStorage.setItem(zipKey, JSON.stringify(orgUUIDs));
        }
    }
}

// Test suite
const bdoClient = new BDOClient();
const savedAnswers = {};
const savedOrgs = {};

const testRep = {
    name: 'Test Senator',
    state: 'CA',
    district: 'Senate'
};

const testZipcode = '94103';

// Clear localStorage before each test
beforeEach(() => {
    localStorage.clear();
});

// Representative Answer Tests
it('should create a representative answer in BDO', async () => {
    const answerLink = 'https://example.com/answer';
    const submittedBy = 'TestUser';

    const uuid = await bdoClient.createAnswer(
        testRep.name,
        testRep.state,
        testRep.district,
        answerLink,
        submittedBy
    );

    uuid.should.be.a('string');
    uuid.length.should.be.greaterThan(0);
    savedAnswers.uuid1 = uuid;
});

it('should retrieve a representative answer from BDO', async () => {
    const answerLink = 'https://example.com/answer2';
    const submittedBy = 'TestUser2';

    const uuid = await bdoClient.createAnswer(
        testRep.name,
        testRep.state,
        testRep.district,
        answerLink,
        submittedBy
    );

    const answer = await bdoClient.getAnswer(uuid);

    answer.should.have.property('uuid');
    answer.uuid.should.equal(uuid);
    answer.representativeName.should.equal(testRep.name);
    answer.state.should.equal(testRep.state);
    answer.district.should.equal(testRep.district);
    answer.answerLink.should.equal(answerLink);
    answer.submittedBy.should.equal(submittedBy);
    answer.type.should.equal('healthcare-answer');
    answer.should.have.property('submittedAt');
});

it('should store answer UUID locally', () => {
    const uuid = 'test-uuid-123';

    bdoClient.storeAnswerLocally(
        testRep.name,
        testRep.state,
        testRep.district,
        uuid
    );

    const repKey = bdoClient.getRepKey(testRep.name, testRep.state, testRep.district);
    const stored = localStorage.getItem(`answers_${repKey}`);

    stored.should.be.a('string');
    const uuids = JSON.parse(stored);
    uuids.should.include(uuid);
});

it('should retrieve all answers for a representative', async () => {
    const answer1Link = 'https://example.com/answer-a';
    const answer2Link = 'https://example.com/answer-b';

    const uuid1 = await bdoClient.createAnswer(
        testRep.name,
        testRep.state,
        testRep.district,
        answer1Link,
        'User1'
    );

    const uuid2 = await bdoClient.createAnswer(
        testRep.name,
        testRep.state,
        testRep.district,
        answer2Link,
        'User2'
    );

    bdoClient.storeAnswerLocally(testRep.name, testRep.state, testRep.district, uuid1);
    bdoClient.storeAnswerLocally(testRep.name, testRep.state, testRep.district, uuid2);

    const answers = await bdoClient.getAnswersForRep(
        testRep.name,
        testRep.state,
        testRep.district
    );

    answers.should.have.length(2);
    answers[0].answerLink.should.equal(answer1Link);
    answers[1].answerLink.should.equal(answer2Link);
});

it('should return empty array when no answers exist', async () => {
    const answers = await bdoClient.getAnswersForRep(
        'Nonexistent Rep',
        'XX',
        '99'
    );

    answers.should.have.length(0);
});

it('should generate consistent rep keys', () => {
    const key1 = bdoClient.getRepKey('John Doe', 'CA', '12');
    const key2 = bdoClient.getRepKey('John Doe', 'CA', '12');
    const key3 = bdoClient.getRepKey('Jane Smith', 'CA', '12');

    key1.should.equal(key2);
    key1.should.not.equal(key3);
    key1.should.equal('john_doe_ca_12');
});

// Organization Tests
it('should create an organization in BDO', async () => {
    const orgName = 'Test Healthcare Org';
    const orgDescription = 'A test healthcare organization';
    const orgLink = 'https://example.org';
    const submittedBy = 'OrgAdmin';

    const uuid = await bdoClient.createOrganization(
        testZipcode,
        orgName,
        orgDescription,
        orgLink,
        submittedBy
    );

    uuid.should.be.a('string');
    uuid.length.should.be.greaterThan(0);
    savedOrgs.uuid1 = uuid;
});

it('should retrieve an organization from BDO', async () => {
    const orgName = 'Healthcare Coalition';
    const orgDescription = 'Fighting for healthcare rights';
    const orgLink = 'https://healthcarecoalition.org';

    const uuid = await bdoClient.createOrganization(
        testZipcode,
        orgName,
        orgDescription,
        orgLink,
        'Admin'
    );

    const org = await bdoClient.getOrganization(uuid);

    org.should.have.property('uuid');
    org.uuid.should.equal(uuid);
    org.zipcode.should.equal(testZipcode);
    org.organizationName.should.equal(orgName);
    org.description.should.equal(orgDescription);
    org.link.should.equal(orgLink);
    org.type.should.equal('healthcare-organization');
});

it('should store organization UUID locally', () => {
    const uuid = 'org-uuid-456';

    bdoClient.storeOrganizationLocally(testZipcode, uuid);

    const stored = localStorage.getItem(`orgs_${testZipcode}`);
    stored.should.be.a('string');

    const uuids = JSON.parse(stored);
    uuids.should.include(uuid);
});

it('should retrieve all organizations for a zipcode', async () => {
    const org1Name = 'Org One';
    const org2Name = 'Org Two';

    const uuid1 = await bdoClient.createOrganization(
        testZipcode,
        org1Name,
        'Description 1',
        'https://org1.com',
        'User1'
    );

    const uuid2 = await bdoClient.createOrganization(
        testZipcode,
        org2Name,
        'Description 2',
        'https://org2.com',
        'User2'
    );

    bdoClient.storeOrganizationLocally(testZipcode, uuid1);
    bdoClient.storeOrganizationLocally(testZipcode, uuid2);

    const orgs = await bdoClient.getOrganizationsForZipcode(testZipcode);

    orgs.should.have.length(2);
    orgs[0].organizationName.should.equal(org1Name);
    orgs[1].organizationName.should.equal(org2Name);
});

it('should return empty array when no organizations exist', async () => {
    const orgs = await bdoClient.getOrganizationsForZipcode('00000');
    orgs.should.have.length(0);
});

it('should handle organizations without links', async () => {
    const uuid = await bdoClient.createOrganization(
        testZipcode,
        'No Website Org',
        'An org without a website',
        null,
        'User'
    );

    const org = await bdoClient.getOrganization(uuid);

    should().not.exist(org.link);
    org.organizationName.should.equal('No Website Org');
});

// Data Integrity Tests
it('should not duplicate UUIDs in local storage', () => {
    const uuid = 'duplicate-test-uuid';
    const repName = 'Test Rep';
    const repState = 'CA';
    const repDistrict = 'Senate';

    bdoClient.storeAnswerLocally(repName, repState, repDistrict, uuid);
    bdoClient.storeAnswerLocally(repName, repState, repDistrict, uuid);

    const repKey = bdoClient.getRepKey(repName, repState, repDistrict);
    const stored = localStorage.getItem(`answers_${repKey}`);
    const uuids = JSON.parse(stored);

    uuids.filter(id => id === uuid).should.have.length(1);
});

it('should preserve timestamp when storing and retrieving', async () => {
    const beforeTimestamp = Date.now();

    const uuid = await bdoClient.createAnswer(
        'Test Rep',
        'CA',
        'Senate',
        'https://test.com',
        'User'
    );

    const answer = await bdoClient.getAnswer(uuid);
    const afterTimestamp = Date.now();

    answer.submittedAt.should.be.at.least(beforeTimestamp);
    answer.submittedAt.should.be.at.most(afterTimestamp);
});
