// Reisekasse — geteilte Ausgaben-App
//
// Trägt Ausgaben in Firestore ein und hält alle Geräte per onSnapshot live
// synchron. Die Reise wird über eine Trip-ID in der URL (?trip=xyz) geteilt.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection,
  addDoc, deleteDoc, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------------------------------------------------------------------------
// 1) Firebase-Konfiguration
//
// Trage hier die Werte aus deiner Firebase-Konsole ein:
// Projekteinstellungen -> Allgemein -> "Meine Apps" -> Web-App -> SDK-Konfig.
// Diese Werte sind bei Firebase-Web-Apps bewusst öffentlich/clientseitig
// (kein Geheimnis) — abgesichert wird über Firestore Security Rules, nicht
// durch Geheimhaltung dieser Config. Siehe README.md.
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyDSjx2B6XV660raBlExjKEN18UBE6ulh8k",
  authDomain: "reisekasse-6a7e2.firebaseapp.com",
  projectId: "reisekasse-6a7e2",
  storageBucket: "reisekasse-6a7e2.firebasestorage.app",
  messagingSenderId: "369606500038",
  appId: "1:369606500038:web:22af92cb2e924ff18041c7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ---------------------------------------------------------------------------
// 2) Trip-ID aus der URL lesen (oder eine neue erzeugen und in die URL setzen)
// ---------------------------------------------------------------------------
const url = new URL(window.location.href);
let tripId = url.searchParams.get("trip");
if (!tripId) {
  tripId = crypto.randomUUID().slice(0, 8);
  url.searchParams.set("trip", tripId);
  window.history.replaceState({}, "", url);
}

const tripRef = doc(db, "trips", tripId);
const expensesRef = collection(db, "trips", tripId, "expenses");

// ---------------------------------------------------------------------------
// 3) DOM-Referenzen
// ---------------------------------------------------------------------------
const el = (id) => document.getElementById(id);

const setupCard = el("setupCard");
const tripView = el("tripView");
const tripTitle = el("tripTitle");
const shareBtn = el("shareBtn");
const connStatus = el("connStatus");

const setupName = el("setupName");
const setupPerson1 = el("setupPerson1");
const setupPerson2 = el("setupPerson2");
const setupStart = el("setupStart");
const setupEnd = el("setupEnd");
const setupSaveBtn = el("setupSaveBtn");

const statTotal = el("statTotal");
const statAvg = el("statAvg");
const statDays = el("statDays");
const splitContent = el("splitContent");

const expenseForm = el("expenseForm");
const fAmount = el("fAmount");
const fCategory = el("fCategory");
const fDescription = el("fDescription");
const fPaidBy = el("fPaidBy");
const fStartDate = el("fStartDate");
const fMultiDay = el("fMultiDay");
const fEndDateWrap = el("fEndDateWrap");
const fEndDate = el("fEndDate");

const dayList = el("dayList");

let trip = null;
let expenses = [];

// ---------------------------------------------------------------------------
// 4) Helper
// ---------------------------------------------------------------------------
const fmtMoney = (n) =>
  new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n || 0);

const fmtDateShort = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
};

function daysBetweenInclusive(startIso, endIso) {
  const start = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return Math.max(diff + 1, 1);
