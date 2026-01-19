const admin = require('firebase-admin');

if (!admin.apps.length) {
    const requiredEnvVars = [
        'FIREBASE_PROJECT_ID',
        'FIREBASE_CLIENT_EMAIL',
        'FIREBASE_PRIVATE_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter(
        (envVar) => !process.env[envVar]
    );

    if (missingEnvVars.length > 0) {
        console.error(
            ` Missing Firebase environment variables: ${missingEnvVars.join(', ')}`
        );
        console.error('Please check your .env file');
        process.exit(1);
    }

    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
        (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
        privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\\\n/g, '\n');
    privateKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });

    console.log('Firebase Admin SDK initialized successfully');
}

const auth = admin.auth();

module.exports = {
    admin,
    auth,
};
