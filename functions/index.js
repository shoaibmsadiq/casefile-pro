/* eslint-disable max-len */
/**
 * Backend Cloud Functions for the CaseFile Pro App.
 *
 * This file has been rewritten using the v1 SDK syntax as a workaround
 * for a persistent deployment environment issue.
 *
 * UPDATE: Added logic to automatically make a specific email the first admin.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// The email address of the first administrator.
const FIRST_ADMIN_EMAIL = "shoaibmsadiq@gmail.com";

// --- Function to create a new client with phone and password (now optional) ---
exports.createClientUser = functions.https.onCall(async (data, context) => {
    // 1. Check if the request is made by an admin
    if (!context.auth || context.auth.token.role !== "admin") {
        throw new functions.https.HttpsError(
            "permission-denied",
            "Only admins can create new client accounts.",
        );
    }

    const { name, phone, password } = data;

    // 2. Validate the input - phone and password are now optional
    if (!name || name.trim() === '') {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Client name is required.",
        );
    }
    // Password validation only if provided
    if (password && password.length < 6) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Password must be at least 6 characters long if provided."
        );
    }

    try {
        // 3. Create a dummy email from the phone number for Firebase Auth (if phone exists)
        // Agar phone number nahi hai, toh ek unique dummy email banayenge
        const email = phone && phone.trim() !== '' ? `${phone}@casefile-portal.local` : `${Date.now()}@casefile-portal.local`;

        // 4. Create the user in Firebase Authentication
        const userRecord = await admin.auth().createUser({
            email: email,
            password: password || undefined, // Password optional, agar nahi hai toh undefined pass karen
            displayName: name,
            emailVerified: true, // We trust the admin
        });

        // 5. Save client details in Firestore 'clients' collection
        await admin.firestore().collection("clients").doc(userRecord.uid).set({
            name: name.trim(),
            phone: phone && phone.trim() !== '' ? phone.trim() : null, // Save the phone number if provided
            email: email, // Save the dummy email
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            cases: 0, // Naye client ka cases count 0 se shuru hoga
        });
        
        return {
            result: `Successfully created client account for ${name}.`,
        };
    } catch (error) {
        console.error("Error creating client user:", error);
        if (error.code === 'auth/email-already-exists') {
            throw new functions.https.HttpsError('already-exists', 'This phone number (or a generated email) is already registered as a client.');
        }
        throw new functions.https.HttpsError("internal", "An unexpected error occurred: " + error.message);
    }
});

// --- New Function to find an existing client or create a new one ---
exports.findOrCreateClient = functions.https.onCall(async (data, context) => {
    // Authentication check: Sirf authenticated users hi is function ko call kar saken
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'The function must be called while authenticated.'
        );
    }

    const { name, email, phone } = data;

    if (!name || typeof name !== 'string' || name.trim() === '') {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'The "name" field is required and must be a non-empty string.'
        );
    }

    let clientId;
    let isNewClient = false;
    let clientData = { name: name.trim() }; // Default client data

    try {
        // Client ko name aur phone se dhoondhen
        let clientQuery = db.collection('clients').where('name', '==', name.trim());
        // Agar phone number provide kiya gaya hai, toh usko query mein shamil karen
        if (phone && typeof phone === 'string' && phone.trim() !== '') {
            clientQuery = clientQuery.where('phone', '==', phone.trim());
        }

        const snapshot = await clientQuery.limit(1).get();

        if (!snapshot.empty) {
            // Client mil gaya
            const existingClientDoc = snapshot.docs[0];
            clientId = existingClientDoc.id;
            clientData = existingClientDoc.data();

            // Cases count ko increment karein
            await existingClientDoc.ref.update({
                cases: admin.firestore.FieldValue.increment(1)
            });
            functions.logger.log(`Existing client found and cases incremented for: ${name}`);
        } else {
            // Client nahi mila, naya client create karein
            isNewClient = true;
            const newClientDocRef = await db.collection('clients').add({
                name: name.trim(),
                email: (email && typeof email === 'string' && email.trim() !== '') ? email.trim() : null,
                phone: (phone && typeof phone === 'string' && phone.trim() !== '') ? phone.trim() : null,
                password: null, // Password ko null ya empty string rakhen
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                cases: 1, // Naye client ka pehla case
            });
            clientId = newClientDocRef.id;
            const newClientDoc = await newClientDocRef.get(); // Naya data fetch karein
            clientData = newClientDoc.data();
            functions.logger.log(`New client created: ${name}`);
        }

        return {
            clientId: clientId,
            clientName: clientData.name,
            clientEmail: clientData.email || null,
            clientPhone: clientData.phone || null, // WhatsApp number
            isNew: isNewClient,
            result: isNewClient ? "New client created and linked." : "Existing client linked."
        };

    } catch (error) {
        functions.logger.error("Error in findOrCreateClient:", error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to process client: ' + error.message,
            error.details
        );
    }
});


/**
 * v1 Auth Trigger to set a role for new users.
 * If the user's email matches FIRST_ADMIN_EMAIL, they become an admin.
 * Otherwise, they become a member.
 */
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    functions.logger.log(`New user signup: ${user.email} (UID: ${user.uid})`);

    // Determine the role based on the email address.
    const userRole = (user.email === FIRST_ADMIN_EMAIL) ? "admin" : "member";

    try {
        await admin.auth().setCustomUserClaims(user.uid, {role: userRole});
        functions.logger.log(`Successfully set "${userRole}" role claim for ${user.email}`);

        const userDocRef = db.collection("users").doc(user.uid);
        await userDocRef.set({
            email: user.email,
            role: userRole,
            createdAt: new Date(),
            displayName: user.displayName || user.email,
        });
        functions.logger.log(`Successfully created Firestore user profile for ${user.email}`);
    } catch (error) {
        functions.logger.error(`Failed to set role or profile for user ${user.uid}:`, error);
    }
});

/**
 * v1 Callable Function to grant a user the 'admin' role.
 */
exports.grantAdminRole = functions.https.onCall(async (data, context) => {
    // Check for authentication and admin role
    if (!context.auth || context.auth.token.role !== "admin") {
        throw new functions.https.HttpsError(
            "permission-denied",
            "You must be an admin to perform this action.",
        );
    }

    const email = data.email;
    if (!email) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with an 'email' argument.",
        );
    }

    try {
        const userToMakeAdmin = await admin.auth().getUserByEmail(email);
        await admin.auth().setCustomUserClaims(userToMakeAdmin.uid, {role: "admin"});

        const userDocRef = db.collection("users").doc(userToMakeAdmin.uid);
        await userDocRef.update({role: "admin"});

        functions.logger.log(`Successfully granted "admin" role to ${email} by admin ${context.auth.token.email}`);
        return {result: `Success! ${email} is now an admin.`};
    } catch (error) {
        functions.logger.error(`Error in grantAdminRole for email ${email}:`, error);
        if (error.code === "auth/user-not-found") {
            throw new functions.https.HttpsError(
                "not-found",
                `User with email ${email} was not found.`,
            );
        }
        throw new functions.https.HttpsError(
            "internal",
            "An internal error occurred.",
        );
    }
});
