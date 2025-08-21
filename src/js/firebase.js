import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function saveSubjectInfo(data) {
  try {
    await addDoc(collection(db, "subjects"), data);
  } catch (e) {
    console.error("保存失败:", e);
  }
}

export async function saveExperimentData(data) {
  try {
    await addDoc(collection(db, "experiment_data"), data);
  } catch (e) {
    console.error("实验数据保存失败:", e);
  }
}