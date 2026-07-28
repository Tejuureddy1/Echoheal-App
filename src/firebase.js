import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTsuRfjBrjuJPc-y-EXOCHcLNhuw1RszM",
  authDomain: "echoheal-pharma-collection.firebaseapp.com",
  projectId: "echoheal-pharma-collection",
  storageBucket: "echoheal-pharma-collection.firebasestorage.app",
  messagingSenderId: "1021574173266",
  appId: "1:1021574173266:web:8a42e683bbacbbd515058b",
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
