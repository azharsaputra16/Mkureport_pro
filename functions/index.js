const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");

initializeApp();

const db = getFirestore();
const projectId = process.env.GCLOUD_PROJECT;
const functionRegion = "us-central1";
const webAppUrl = `https://${projectId}.web.app/`;
const tokenCollectionGroup = "notificationTokens";
const maxTokensPerBatch = 500;

const notificationSources = [
    { collection: "announcements", title: "Pengumuman Baru", body: data => data.judul },
    { collection: "tasks", title: "Tugas Baru", body: data => data.judul },
    { collection: "reports", title: "Laporan Kegiatan Baru", body: data => data.judul },
    { collection: "agenda", title: "Agenda Baru", body: data => data.judul },
    { collection: "info_random", title: "Momen Baru", body: data => data.caption || data.userName }
];

async function sendPushToRegisteredDevices(notification) {
    const tokenSnapshots = await db.collectionGroup(tokenCollectionGroup).get();
    const recipientTokens = tokenSnapshots.docs
        .filter(tokenDocument => {
            const ownerUid = tokenDocument.ref.parent.parent?.id;
            return ownerUid && ownerUid !== notification.authorUid;
        })
        .map(tokenDocument => ({ document: tokenDocument, token: tokenDocument.get("token") }))
        .filter(entry => typeof entry.token === "string" && entry.token.length > 0);

    for (let offset = 0; offset < recipientTokens.length; offset += maxTokensPerBatch) {
        const batch = recipientTokens.slice(offset, offset + maxTokensPerBatch);
        const result = await getMessaging().sendEachForMulticast({
            tokens: batch.map(entry => entry.token),
            notification: {
                title: notification.title.slice(0, 100),
                body: notification.body.slice(0, 240)
            },
            data: {
                title: notification.title.slice(0, 100),
                body: notification.body.slice(0, 240),
                url: "/"
            },
            webpush: {
                notification: {
                    icon: `${webAppUrl}assets/mku-logo.png`,
                    badge: `${webAppUrl}assets/mku-logo.png`
                },
                fcmOptions: { link: webAppUrl }
            }
        });

        const staleTokenDeletes = [];
        result.responses.forEach((response, index) => {
            if (!response.success && [
                "messaging/registration-token-not-registered",
                "messaging/invalid-registration-token"
            ].includes(response.error?.code)) {
                staleTokenDeletes.push(batch[index].document.ref.delete());
            }
        });
        await Promise.all(staleTokenDeletes);
        logger.info("Push batch processed", {
            source: notification.collection,
            sent: result.successCount,
            failed: result.failureCount
        });
    }
}

function createNotificationHandler(source) {
    return onDocumentCreated({
        document: `${source.collection}/{documentId}`,
        region: functionRegion
    }, async event => {
        const snapshot = event.data;
        if (!snapshot) return;

        const data = snapshot.data();
        const authorUid = data.dibuatOleh || data.uid || data.userId || "";
        const body = String(source.body(data) || "Ada konten baru di MKU Report.").trim();
        if (!body) return;

        await sendPushToRegisteredDevices({
            collection: source.collection,
            authorUid,
            title: source.title,
            body
        });
    });
}

for (const source of notificationSources) {
    exports[`notify${source.collection.replace(/(^|_)([a-z])/g, (_, separator, letter) => letter.toUpperCase())}`] =
        createNotificationHandler(source);
}
