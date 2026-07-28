import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export async function getData(key) {
  const ref = doc(db, "echoheal", key);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().value : null;
}

export async function setData(key, value) {
  const ref = doc(db, "echoheal", key);
  await setDoc(ref, { value });
  return true;
}
