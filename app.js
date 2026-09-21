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
  apiKey: "DEIN_API_KEY",
  authDomain: "DEIN_PROJEKT.firebaseapp.com",
  projectId: "DEIN_PROJEKT",
  storageBucket: "DEIN_PROJEKT.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID",
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
}

function allDaysInRange(startIso, endIso) {
  const days = [];
  const start = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function personName(personId) {
  const person = trip?.people?.find((p) => p.id === personId);
  return person ? person.name : "?";
}

// ---------------------------------------------------------------------------
// 5) Setup: neue Reise anlegen
// ---------------------------------------------------------------------------
setupSaveBtn.addEventListener("click", async () => {
  const name = setupName.value.trim();
  const p1 = setupPerson1.value.trim();
  const p2 = setupPerson2.value.trim();
  const start = setupStart.value;
  const end = setupEnd.value;

  if (!name || !p1 || !p2 || !start || !end) {
    alert("Bitte alle Felder ausfüllen.");
    return;
  }

  await setDoc(tripRef, {
    name,
    people: [
      { id: "p1", name: p1 },
      { id: "p2", name: p2 },
    ],
    startDate: start,
    endDate: end,
  });
});

// ---------------------------------------------------------------------------
// 6) Ausgabe erfassen
// ---------------------------------------------------------------------------
fMultiDay.addEventListener("change", () => {
  fEndDateWrap.hidden = !fMultiDay.checked;
  if (!fMultiDay.checked) fEndDate.value = "";
});

expenseForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const amount = parseFloat(fAmount.value);
  const startDate = fStartDate.value;
  const endDate = fMultiDay.checked && fEndDate.value ? fEndDate.value : startDate;

  if (!amount || amount <= 0 || !startDate) {
    alert("Bitte Betrag und Datum prüfen.");
    return;
  }
  if (endDate < startDate) {
    alert("Das Enddatum darf nicht vor dem Startdatum liegen.");
    return;
  }

  await addDoc(expensesRef, {
    description: fDescription.value.trim(),
    amount,
    paidBy: fPaidBy.value,
    category: fCategory.value,
    startDate,
    endDate,
    createdAt: serverTimestamp(),
  });

  expenseForm.reset();
  fEndDateWrap.hidden = true;
});

async function deleteExpense(expenseId) {
  if (!confirm("Diese Ausgabe wirklich löschen?")) return;
  await deleteDoc(doc(db, "trips", tripId, "expenses", expenseId));
}

// ---------------------------------------------------------------------------
// 7) Rendering
// ---------------------------------------------------------------------------
function renderTripSetup() {
  const hasTrip = !!trip;
  setupCard.hidden = hasTrip;
  tripView.hidden = !hasTrip;
  if (!hasTrip) return;

  tripTitle.textContent = trip.name || "Reisekasse";

  fPaidBy.innerHTML = "";
  (trip.people || []).forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    fPaidBy.appendChild(opt);
  });
}

function renderStats() {
  const total = expenses.reduce((sum, ex) => sum + ex.amount, 0);
  statTotal.textContent = fmtMoney(total);

  if (trip?.startDate) {
    const today = new Date().toISOString().slice(0, 10);
    const lastDay = expenses.length
      ? expenses.reduce((max, ex) => (ex.endDate > max ? ex.endDate : max), trip.startDate)
      : today;
    const referenceDay = lastDay < today ? lastDay : today;
    const tripDaysSoFar = daysBetweenInclusive(trip.startDate, referenceDay);
    statDays.textContent = tripDaysSoFar;
    statAvg.textContent = fmtMoney(total / tripDaysSoFar);
  } else {
    statDays.textContent = "–";
    statAvg.textContent = "–";
  }
}

function renderSplit() {
  if (!trip?.people?.length) {
    splitContent.textContent = "–";
    return;
  }

  const paidPerPerson = {};
  trip.people.forEach((p) => (paidPerPerson[p.id] = 0));
  let total = 0;

  expenses.forEach((ex) => {
    paidPerPerson[ex.paidBy] = (paidPerPerson[ex.paidBy] || 0) + ex.amount;
    total += ex.amount;
  });

  const fairShare = total / trip.people.length;

  const lines = trip.people.map((p) => {
    const paid = paidPerPerson[p.id] || 0;
    const diff = paid - fairShare;
    return { name: p.name, paid, diff };
  });

  const creditor = lines.reduce((a, b) => (b.diff > a.diff ? b : a), lines[0]);
  const debtor = lines.reduce((a, b) => (b.diff < a.diff ? b : a), lines[0]);

  let settlement = "Alles ausgeglichen.";
  if (creditor && debtor && creditor.name !== debtor.name && Math.abs(creditor.diff) > 0.01) {
    const amountOwed = Math.min(Math.abs(debtor.diff), creditor.diff);
    settlement = `${debtor.name} schuldet ${creditor.name} ${fmtMoney(amountOwed)}`;
  }

  splitContent.innerHTML = `
    <ul style="list-style:none;padding:0;margin:0 0 10px 0;">
      ${lines
        .map(
          (l) =>
            `<li style="display:flex;justify-content:space-between;padding:4px 0;">
              <span>${l.name} hat bezahlt</span>
              <strong>${fmtMoney(l.paid)}</strong>
            </li>`
        )
        .join("")}
    </ul>
    <p style="margin:0;font-weight:700;color:var(--primary-dark);">${settlement}</p>
  `;
}

function renderDayList() {
  if (!expenses.length) {
    dayList.innerHTML = '<p class="hint">Noch keine Ausgaben eingetragen.</p>';
    return;
  }

  // Jede Ausgabe auf ihre Tage aufteilen (anteilig bei mehrtägigen Posten)
  const byDay = {};
  expenses.forEach((ex) => {
    const days = allDaysInRange(ex.startDate, ex.endDate);
    const perDayAmount = ex.amount / days.length;
    days.forEach((day, idx) => {
      if (!byDay[day]) byDay[day] = [];
      byDay[day].push({
        ...ex,
        dayAmount: perDayAmount,
        dayIndex: idx + 1,
        dayCount: days.length,
      });
    });
  });

  const sortedDays = Object.keys(byDay).sort().reverse();

  dayList.innerHTML = sortedDays
    .map((day) => {
      const items = byDay[day];
      const dayTotal = items.reduce((sum, i) => sum + i.dayAmount, 0);
      const rows = items
        .map((i) => {
          const multiDayHint = i.dayCount > 1 ? ` · ${i.category}, Tag ${i.dayIndex}/${i.dayCount}` : ` · ${i.category}`;
          return `
            <div class="expense-row">
              <div class="expense-main">
                <span class="expense-desc">${escapeHtml(i.description || "(ohne Beschreibung)")}</span>
                <span class="expense-meta">${personName(i.paidBy)}${multiDayHint}</span>
              </div>
              <span class="expense-amount">${fmtMoney(i.dayAmount)}</span>
              <button class="expense-delete" data-id="${i.id}" title="Löschen">✕</button>
            </div>
          `;
        })
        .join("");

      return `
        <div class="day-group">
          <h3>${fmtDateShort(day)} · ${fmtMoney(dayTotal)}</h3>
          ${rows}
        </div>
      `;
    })
    .join("");

  dayList.querySelectorAll(".expense-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteExpense(btn.dataset.id));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function renderAll() {
  renderTripSetup();
  if (!trip) return;
  renderStats();
  renderSplit();
  renderDayList();
}

// ---------------------------------------------------------------------------
// 8) Echtzeit-Listener
// ---------------------------------------------------------------------------
onSnapshot(
  tripRef,
  (snap) => {
    trip = snap.exists() ? snap.data() : null;
    connStatus.textContent = "Verbunden · Trip-ID: " + tripId;
    renderAll();
  },
  (err) => {
    connStatus.textContent = "Verbindung fehlgeschlagen: " + err.message;
  }
);

onSnapshot(
  expensesRef,
  (snap) => {
    expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAll();
  },
  (err) => {
    connStatus.textContent = "Verbindung fehlgeschlagen: " + err.message;
  }
);

// ---------------------------------------------------------------------------
// 9) Link teilen
// ---------------------------------------------------------------------------
shareBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    shareBtn.textContent = "✓ Link kopiert";
    setTimeout(() => (shareBtn.textContent = "🔗 Link teilen"), 1500);
  } catch {
    prompt("Link zum Teilen:", window.location.href);
  }
});
