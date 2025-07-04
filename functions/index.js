// functions/index.js

// Firebase Admin SDK ko import karein, is se hum Firebase services ko server se access kar sakte hain.
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Firebase Admin ko initialize karein
admin.initializeApp();

// Firestore database ka reference hasil karein
const db = admin.firestore();

/**
 * Yeh function har roz subah 9:00 baje Pakistan Time (Asia/Karachi) par chalega.
 * Yeh Firestore database mein check karega ke agle 3 dinon mein kin cases ki sunwai (hearing) hai.
 * Jin cases ki hearing hogi, unke users ko Push Notification aur Email bhejega.
 */
exports.sendHearingReminders = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("Asia/Karachi")
  .onRun(async (context) => {
    console.log("Checking for upcoming hearings...");

    // Reminder kitne din pehle bhejna hai (e.g., 3 din)
    const REMINDER_DAYS_BEFORE = 3;

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + REMINDER_DAYS_BEFORE);
    
    // Date ko 'YYYY-MM-DD' format mein convert karein, jaisa ke form mein save hota hai
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const targetDateString = `${year}-${month}-${day}`;

    console.log(`Targeting hearings for date: ${targetDateString}`);

    // Tamam users ke data ko hasil karein
    const usersSnapshot = await db.collectionGroup("users").get();

    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userEmail = userDoc.data().email; // User ka email hasil karein

      // User ke tamam cases check karein
      // ZAROORI: 'YOUR_APP_ID' ko apni asal App ID se replace karein
      const casesSnapshot = await db.collection(`artifacts/1:387776954987:web:c1bc983a56efdc3539a72e/users/${userId}/cases`).get();
      
      for (const caseDoc of casesSnapshot.docs) {
        const caseData = caseDoc.data();
        const hearingDates = caseData.hearingDates || [];

        // Check karein ke case ki hearing dates mein target date shamil hai ya nahi
        if (hearingDates.includes(targetDateString)) {
          console.log(`Found a hearing for user ${userId} on ${targetDateString} for case: ${caseData.caseTitle}`);
          
          // 1. Push Notification Bhejein
          await sendPushNotification(userId, caseData);

          // 2. Email Reminder Bhejein (Agar Trigger Email extension installed hai)
          await sendEmailReminder(userEmail, caseData, targetDateString);
        }
      }
    }
    return null;
  });

/**
 * User ko Push Notification bhejta hai.
 * @param {string} userId - User ki ID.
 * @param {object} caseData - Case ka data.
 */
async function sendPushNotification(userId, caseData) {
  // User ke save kiye hue device tokens hasil karein
  // ZAROORI: 'YOUR_APP_ID' ko apni asal App ID se replace karein
  const tokensSnapshot = await db.collection(`artifacts/1:387776954987:web:c1bc983a56efdc3539a72e/users/${userId}/fcmTokens`).get();
  const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

  if (tokens.length === 0) {
    console.log(`No device tokens found for user ${userId}.`);
    return;
  }

  const payload = {
    notification: {
      title: "Hearing Reminder!",
      body: `Aapke case "${caseData.caseTitle}" ki sunwai 3 din mein hai.`,
      icon: "https://your-website.com/favicon.ico", // Apni app ka icon yahan dalein
    },
  };

  console.log(`Sending push notification to ${tokens.length} devices for user ${userId}.`);
  await admin.messaging().sendToDevice(tokens, payload);
}

/**
 * User ko Email Reminder bhejta hai.
 * @param {string} userEmail - User ka email address.
 * @param {object} caseData - Case ka data.
 * @param {string} hearingDate - Hearing ki tareekh.
 */
async function sendEmailReminder(userEmail, caseData, hearingDate) {
    if (!userEmail) {
        console.log(`No email found for this user.`);
        return;
    }

    // "Trigger Email" extension ke liye Firestore ke 'mail' collection mein ek document add karein
    // NOTE: Iske liye aapko Firebase Console se "Trigger Email" extension install karna hoga.
    try {
        await db.collection("mail").add({
            to: userEmail,
            message: {
                subject: `Hearing Reminder: ${caseData.caseTitle}`,
                html: `
                    <h1>Hearing Reminder</h1>
                    <p>Assalam-o-Alaikum,</p>
                    <p>Yeh ek yaad dehani hai ke aapke case "<strong>${caseData.caseTitle}</strong>" ki sunwai 3 din mein hai.</p>
                    <p><strong>Case Number:</strong> ${caseData.caseNumber}</p>
                    <p><strong>Adalat:</strong> ${caseData.courtName}</p>
                    <p><strong>Sunwai ki Tareekh:</strong> ${new Date(hearingDate).toDateString()}</p>
                    <br/>
                    <p>Shukriya,<br/>CaseFile Pro</p>
                `,
            },
        });
        console.log(`Email reminder queued for ${userEmail}`);
    } catch (error) {
        console.error("Failed to queue email:", error);
    }
}
