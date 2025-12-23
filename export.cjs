const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = require("./credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

function normalize(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString();
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    const obj = {};
    for (const k in value) obj[k] = normalize(value[k]);
    return obj;
  }
  return value;
}

async function exportDoc(docRef, path = "") {
  const snap = await docRef.get();
  if (!snap.exists) return null;

  const node = {
    id: snap.id,
    ...normalize(snap.data()),
  };

  const subcols = await docRef.listCollections();

  for (const subcol of subcols) {
    console.log(`Found subcollection: ${path}/${subcol.id}`);
    const subSnap = await subcol.get();
    node[subcol.id] = [];

    for (const subDoc of subSnap.docs) {
      const child = await exportDoc(
        subDoc.ref,
        `${path}/${subcol.id}/${subDoc.id}`
      );
      if (child) node[subcol.id].push(child);
    }
  }

  return node;
}

async function exportRootCollection(name) {
  const snap = await db.collection(name).get();
  const out = [];

  for (const doc of snap.docs) {
    const data = await exportDoc(doc.ref, name);
    if (data) out.push(data);
  }

  return out;
}

(async () => {
  console.log("Starting FULL recursive export...");
  const data = await exportRootCollection("rooms");

  fs.writeFileSync(
    "rooms_recursive_export.json",
    JSON.stringify(data, null, 2)
  );

  console.log("Export completed.");
})();
