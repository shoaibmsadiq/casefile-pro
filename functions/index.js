// This is the final, production-ready code for sending task reminders.
// It runs every 15 minutes, checks for upcoming tasks, and sends notifications.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const moment = require("moment-timezone");
const logger = require("firebase-functions/logger");

admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth(); // Initialize Auth service

// This function will run every 15 minutes.
exports.checkTaskReminders = onSchedule({
    schedule: "every 15 minutes",
    timeZone: "Asia/Karachi",
    // It's good practice to set a timeout and memory limit
    timeoutSeconds: 540,
    memory: "256MiB",
  }, async (context) => {
    logger.info("Checking for task reminders...");

    const now = moment();
    
    // Get all cases across all users using a collection group query
    const casesSnapshot = await db.collectionGroup("cases").get();
    
    for (const caseDoc of casesSnapshot.docs) {
      const caseData = caseDoc.data();
      
      // Safely get the userId from the document's path
      const pathParts = caseDoc.ref.path.split('/');
      // Expected path: artifacts/{appId}/users/{userId}/cases/{caseId}
      if (pathParts.length < 5) continue;
      const userId = pathParts[3];

      if (!caseData || !userId) continue;
      
      const tasksSnapshot = await caseDoc.ref.collection("tasks").get();

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();

        if (task.status === "Pending" && task.notify && task.dueDate && task.dueTime) {
          const dueDateTime = moment.tz(`${task.dueDate} ${task.dueTime}`, "Asia/Karachi");
          
          // Check if the due time is within the next 15 minutes
          if (dueDateTime.isAfter(now) && dueDateTime.isBefore(now.clone().add(15, 'minutes'))) {
            logger.info(`Found task to notify: "${task.title}" for case "${caseData.caseTitle}"`);
            
            try {
                // Get user's email directly from Firebase Auth
                const userRecord = await auth.getUser(userId);
                const userEmail = userRecord.email;

                const lawyerInfo = { email: userEmail, id: userId };
                const clientInfo = { email: caseData.clientEmail, whatsapp: caseData.clientWhatsapp };

                // Send notifications
                await sendPushNotification(lawyerInfo, task, caseData);
                if (lawyerInfo.email) {
                    await sendEmailReminder(lawyerInfo.email, task, caseData, "Lawyer");
                }
                if (clientInfo.email) {
                    await sendEmailReminder(clientInfo.email, task, caseData, "Client");
                }
            } catch (error) {
                logger.error(`Error fetching user data for UID: ${userId}`, error);
            }
          }
        }
      }
    }
    logger.info("Task reminder check complete.");
    return null;
  });

async function sendPushNotification(userInfo, task, caseData) {
  const tokensSnapshot = await db.collection(`artifacts/default-app-id/users/${userInfo.id}/fcmTokens`).get();
  if (tokensSnapshot.empty) {
    logger.warn(`No FCM tokens found for user ${userInfo.id}.`);
    return;
  }
  
  const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

  const payload = {
    notification: {
      title: `Task Reminder: ${task.title}`,
      body: `A task for case "${caseData.caseTitle}" is due soon.`,
      icon: "https://malikawanlaw.netlify.app/favicon.ico",
    },
  };

  logger.info(`Sending push notification to ${tokens.length} device(s) for user ${userInfo.id}.`);
  await admin.messaging().sendToDevice(tokens, payload);
}

async function sendEmailReminder(recipientEmail, task, caseData, recipientType) {
    if (!recipientEmail) {
        logger.warn(`No email address provided for ${recipientType}.`);
        return;
    }

    try {
        await db.collection("mail").add({
            to: recipientEmail,
            message: {
                subject: `Reminder: ${task.title} - Case: ${caseData.caseTitle}`,
                html: `
                    <h1>Task Reminder</h1>
                    <p>Assalam-o-Alaikum,</p>
                    <p>This is a reminder for the following task associated with the case "<strong>${caseData.caseTitle}</strong>":</p>
                    <hr>
                    <p><strong>Task:</strong> ${task.title}</p>
                    <p><strong>Due Date:</strong> ${moment(task.dueDate).format('LL')}</p>
                    <p><strong>Due Time:</strong> ${moment(task.dueTime, 'HH:mm').format('h:mm A')}</p>
                    <hr>
                    <br/>
                    <p>Thank you for using CaseFile Pro.</p>
                `,
            },
        });
        logger.info(`Email reminder queued for ${recipientType} at ${recipientEmail}`);
    } catch (error) {
        logger.error("Failed to queue email:", error);
    }
}
