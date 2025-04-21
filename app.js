// app.js - Library Verification Service
import express from 'express';
import session from 'express-session';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import ejs from 'ejs';
import path from 'path';
import dotenv from "dotenv";
import winston from 'winston';
import { CredentialVerification } from "./verification/credentialVerification.mjs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();
const publicKey = JSON.parse(process.env.PUBLIC_KEY);
const issuanceService = new CredentialVerification();
issuanceService.initialize(publicKey)
    .then(() => {
        console.log('Initialization complete');
    })
    .catch(err => {
        console.error('Initialization error:', err);
        process.exit(1);
    });

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} [${info.level.toUpperCase()}] - ${info.message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'library_verifier.log' })
    ]
});

// Create Express app
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key-for-session', // Change this in production
    resave: false,
    saveUninitialized: true
}));

// Setup view engine
app.set('view engine', 'html');
app.engine('html', ejs.renderFile);
app.set('views', path.join(__dirname, 'views'));

// Configuration
const CLIENT_ID = 'lib-verification-service-123';  // Hardcoded client ID
const PRESENTATION_CALLBACK_URI = 'trinwallet://presentation-callback';

// In-memory store for verification requests (in a real app, use a database)
const verificationRequests = {};

// Routes
app.get('/', (req, res) => {
    /**
     * Display the main page with the verification options.
     */
    logger.info("Main verification page accessed");
    return res.render('index.html');
});

app.get('/verify', (req, res) => {
    /**
     * Handle verification request and generate a request to send to the wallet.
     */
    logger.info("Verification process initiated");

    // Get the verification type from the form
    const verificationType = req.query.type || 'book_issuance';

    // Generate a unique request ID
    const requestId = uuidv4();

    // Store verification request details
    verificationRequests[requestId] = {
        type: verificationType,
        status: 'pending',
        created_at: Date.now(),
        credential_data: null
    };

    // Log the creation of verification request
    logger.info(`Created verification request with ID: ${requestId}`);
    logger.info(`Verification type: ${verificationType}`);

    // Create request URI that will be sent to the wallet
    const requestUri = `https://${req.get('host')}/presentation-request/${requestId}`;

    // Create deep link to wallet app
    const walletLink = `${PRESENTATION_CALLBACK_URI}?request_uri=${requestUri}&client_id=${CLIENT_ID}`;

    logger.info(`Generated wallet deep link: ${walletLink}`);

    // Store request ID in session for later use
    req.session.current_request_id = requestId;

    // Return page with deep link (could be a QR code in a real implementation)
    return res.render('verify.html', { wallet_link: walletLink, request_id: requestId });
});

app.get('/presentation-request/:request_id', (req, res) => {
    /**
     * Endpoint that the wallet calls to get the specific presentation request details.
     */
    const requestId = req.params.request_id;
    if (!verificationRequests[requestId]) {
        logger.error(`Invalid request ID: ${requestId}`);
        return res.status(404).json({ error: 'Invalid request ID' });
    }

    logger.info(`Wallet requested presentation details for request ID: ${requestId}`);

    // In a real implementation, you would generate a proper presentation request
    // based on eIDAS 2.0 specifications
    const presentationRequestData = {
        request_id: requestId,
        type: verificationRequests[requestId].type,
        required_credentials: ['library_membership'],
        client_id: CLIENT_ID,
        callback_url: `https://${req.get('host')}/submit-presentation/${requestId}`
    };

    logger.info(`Sending presentation request details: ${JSON.stringify(presentationRequestData)}`);

    return res.json(presentationRequestData);
});

app.post('/submit-presentation/:request_id', async (req, res) => {
    /**
     * Endpoint for the wallet to submit the verifiable presentation.
     */
    const requestId = req.params.request_id;
    if (!verificationRequests[requestId]) {
        logger.error(`Invalid request ID: ${requestId}`);
        return res.status(404).json({ error: 'Invalid request ID' });
    }

    logger.info(`Received presentation submission for request ID: ${requestId}`);
    // Extract credential data from the request
    const credentialData = req.body;
    logger.info(`Received credential data: ${JSON.stringify(credentialData)}`);

    // Process the verification (in a real app, you would validate the credential)
    // For now, we'll simply mark it as 'verified' if it contains some expected data
    let verificationSuccess = false;

    try {
        if (credentialData && 'credential' in credentialData) {
            // Attempt to verify the credential. Verification returns credential details or false
            const validationResult = await issuanceService.verifyCredential(credentialData.credential);
            if (validationResult !== false && typeof validationResult === 'object' && validationResult !== null) {
                verificationRequests[requestId].status = 'verified';
                // Store the credential data
                verificationRequests[requestId].credential_data = validationResult;
                verificationSuccess = true;
                logger.info(`Verification successful for request ID: ${requestId}`);
            } else {
                verificationRequests[requestId].status = 'failed';
                logger.info(`Verification failed: invalid credential for request ID: ${requestId}`);
            }
        } else {
            verificationRequests[requestId].status = 'failed';
            logger.info(`Verification failed: missing credential data for request ID: ${requestId}`);
        }
    } catch (error) {
        verificationRequests[requestId].status = 'error';
        verificationSuccess = false;
        logger.error(`Verification error for request ID: ${requestId}: ${error.message}`);
    }

    // Return success or failure
    return res.status(verificationSuccess ? 200 : 400).json({
        status: verificationSuccess ? 'success' : 'failed',
        message: verificationSuccess ? 'Credential verified successfully' : 'Credential verification failed',
        redirect_url: `https://${req.get('host')}/result/${requestId}`
    });
});

app.get('/check-status/:request_id', (req, res) => {
    /**
     * Endpoint for the frontend to check the verification status.
     */
    const requestId = req.params.request_id;
    if (!verificationRequests[requestId]) {
        return res.json({ status: 'invalid' });
    }

    const status = verificationRequests[requestId].status;
    logger.info(`Status check for request ID ${requestId}: ${status}`);

    return res.json({ status });
});

app.get('/result/:request_id', (req, res) => {
    /**
     * Show the verification result page.
     */
    const requestId = req.params.request_id;
    if (!verificationRequests[requestId]) {
        logger.error(`Invalid request ID for results page: ${requestId}`);
        return res.status(404).send("Invalid request");
    }

    const verification = verificationRequests[requestId];
    logger.info(`Displaying results page for request ID: ${requestId}`);

    return res.render('result.html', {
        status: verification.status,
        request_id: requestId,
        verification_type: verification.type,
        credential_data: verification.credential_data
    });
});

app.get('/view_logs', (req, res) => {
    /**
     * View application logs.
     */
    try {
        // Get the last 100 log lines (if you're logging to a file)
        let logContent = "Log viewing is only available when logging to a file.";
        const logFile = 'library_verifier.log';

        if (fs.existsSync(logFile)) {
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n');
            const last100Lines = lines.slice(Math.max(lines.length - 100, 0));
            logContent = last100Lines.join('\n');
        }
    } catch (e) {
        logContent = `Error reading logs: ${e.message}`;
    }

    return res.render('logs.html', { logs: logContent });
});

// This route simulates a successful presentation (for testing without a wallet)
app.get('/simulate-presentation/:request_id', (req, res) => {
    /**
     * Simulate a successful presentation from the wallet (for testing only).
     */
    const requestId = req.params.request_id;
    if (!verificationRequests[requestId]) {
        return res.status(404).send("Invalid request ID");
    }

    // Create a sample credential
    const mockCredential = {
        request_id: requestId,
        credential: {
            id: 'cred-lib-123',
            type: 'LibraryMembership',
            issuer: 'Trinity College Library',
            issuanceDate: '2024-09-01T10:30:45Z',
            expirationDate: '2025-09-01T10:30:45Z',
            credentialSubject: {
                id: 'user123',
                name: 'Jane Smith',
                membershipId: 'TCL-2024-7890',
                status: 'active',
                borrowingPrivilege: 'extended',
                maxBooksAllowed: 10
            }
        }
    };

    // Update the request status
    verificationRequests[requestId].status = 'verified';
    verificationRequests[requestId].credential_data = mockCredential;

    logger.info(`Simulated successful presentation for request ID: ${requestId}`);

    // Redirect to the result page
    return res.redirect(`/result/${requestId}`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    // Add file handler to also log to a file
    logger.info("Library Verification Service starting up...");
    console.log(`Server running on port ${PORT}`);
});

export default app;