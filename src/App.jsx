import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Stamp, Store, CheckCircle2, Clock, XCircle, Building2, LogOut,
  Upload, Users, ClipboardList, FileSpreadsheet, MessageCircle,
  Plus, Trash2, Settings, RefreshCw, ChevronRight, AlertCircle
} from "lucide-react";
import * as XLSX from "xlsx";
import { getData, setData } from "./firebase.js";

const STORAGE_KEY = "echoheal-app-data";

const STATUS = {
  pending: { label: "Pending", color: "#8B8578", bg: "#F2F0EB" },
  store_closed: { label: "Store Closed", color: "#9A5B3F", bg: "#F5E9E1" },
  owner_unavailable: { label: "Owner Not Available", color: "#9A5B3F", bg: "#F5E9E1" },
  next_week: { label: "Next Week", color: "#7A6A2F", bg: "#F5F0DC" },
  partial_payment: { label: "Partial Payment", color: "#2F6B5E", bg: "#E1EFEA" },
  paid: { label: "Invoice Paid", color: "#1F5C4E", bg: "#DCEFE8" },
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const seedData = () => ({
  masterPassword: "echoheal123",
  reps: [
    { id: "r1", name: "Srinivas", password: "srinivas123", areas: ["Ameerpet", "Erragadda"] },
    { id: "r2", name: "Santhosh", password: "santhosh123", areas: ["Balanagar", "Chintal"] },
    { id: "r3", name: "Mahender", password: "mahender123", areas: ["Gachibowli", "Kondapur"] },
    { id: "r4", name: "Rep 4", password: "rep4123", areas: [] },
  ],
  invoices: [
    { id: "inv-seed-1", storeCode: "AMP-014", storeName: "Sri Sai Medicals", area: "Ameerpet", invoiceNo: "EHP-2201", amount: 12400, salesRep: "Kiran", invoiceDate: todayStr(), assignedRepId: "r1", status: "pending", partialAmount: 0, statusUpdatedAt: null, note: "" },
    { id: "inv-seed-2", storeCode: "GBW-007", storeName: "Apollo Care Pharmacy", area: "Gachibowli", invoiceNo: "EHP-2202", amount: 8600, salesRep: "Ravi", invoiceDate: todayStr(), assignedRepId: "r3", status: "pending", partialAmount: 0, statusUpdatedAt: null, note: "" },
    { id: "inv-seed-3", storeCode: "BLN-021", storeName: "Balanagar Drug House", area: "Balanagar", invoiceNo: "EHP-2203", amount: 5200, salesRep: "Kiran", invoiceDate: todayStr(), assignedRepId: "r2", status: "pending", partialAmount: 0, statusUpdatedAt: null, note: "" },
  ],
});

function findRepForArea(reps, area) {
  const a = (area || "").trim().toLowerCase();
  if (!a) return null;
  const rep = reps.find((r) => r.areas.some((x) => x.trim().toLowerCase() === a));
  return rep ? rep.id : null;
}

function fmtINR(n) {
  const num = Number(n) || 0;
  return "₹" + num.toLocaleString("en-IN");
}

function StampBadge({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
      style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.color}33` }}
    >
      {status === "paid" && <CheckCircle2 size={13} />}
      {status === "pending" && <Clock size={13} />}
      {(status === "store_closed" || status === "owner_unavailable") && <XCircle size={13} />}
      {s.label}
    </span>
  );
}

export default function App() {
  const [data, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [session, setSession] = useState(null); // { role: 'master'|'rep', repId? }
  const [loginSel, setLoginSel] = useState(null);
  const [pwInput, setPwInput] = useState("");
  const [loginErr, setLoginErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const stored = await getData(STORAGE_KEY);
        setAppData(stored ? JSON.parse(stored) : seedData());
      } catch {
        setAppData(seedData());
      }
      setLoading(false);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setAppData(next);
    try {
      await setData(STORAGE_KEY, JSON.stringify(next));
      setSaveError("");
    } catch {
      setSaveError("Could not save — your last change may not persist.");
    }
  }, []);

  const resetDemo = () => {
    if (confirm("Reset all data back to the sample demo data? This clears real entries.")) {
      persist(seedData());
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F5F0] text-[#3A3630]">
        <div className="flex items-center gap-3 font-mono text-sm">
          <RefreshCw className="animate-spin" size={18} /> Loading ledger…
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        data={data}
        loginSel={loginSel}
        setLoginSel={setLoginSel}
        pwInput={pwInput}
        setPwInput={setPwInput}
        loginErr={loginErr}
        setLoginErr={setLoginErr}
        onLogin={(s) => {
          setSession(s);
          setPwInput("");
          setLoginErr("");
          setLoginSel(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#2B2820]">
      <TopBar
        session={session}
        data={data}
        onLogout={() => setSession(null)}
        saveError={saveError}
      />
      {session.role === "master" ? (
        <MasterDashboard data={data} persist={persist} onResetDemo={resetDemo} />
      ) : (
        <RepDashboard data={data} persist={persist} repId={session.repId} />
      )}
    </div>
  );
}

function LoginScreen({ data, loginSel, setLoginSel, pwInput, setPwInput, loginErr, setLoginErr, onLogin }) {
  const users = [
    { id: "master", name: "Master User", sub: "Uploads & assigns invoices", role: "master" },
    ...data.reps.map((r) => ({ id: r.id, name: r.name, sub: r.areas.length ? r.areas.join(", ") : "No areas assigned", role: "rep" })),
  ];

  const submit = (e) => {
    e.preventDefault();
    if (!loginSel) return;
    if (loginSel.role === "master") {
      if (pwInput === data.masterPassword) onLogin({ role: "master" });
      else setLoginErr("Incorrect password.");
    } else {
      const rep = data.reps.find((r) => r.id === loginSel.id);
      if (rep && pwInput === rep.password) onLogin({ role: "rep", repId: rep.id });
      else setLoginErr("Incorrect password.");
    }
  };

  return (
    <div className="min-h-screen bg-[#1B2A2A] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#2F6B5E] mb-4">
            <Stamp className="text-[#F7F5F0]" size={26} />
          </div>
          <h1 className="text-2xl font-semibold text-[#F7F5F0] tracking-tight" style={{ fontFamily: "Georgia, serif" }}>
            Echoheal Pharma
          </h1>
          <p className="text-[#9CA89F] text-sm mt-1 font-mono">Collection Ledger</p>
        </div>

        <div className="bg-[#F7F5F0] rounded-2xl shadow-2xl p-6">
          {!loginSel ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-[#8B8578] font-mono mb-3">Select your login</p>
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setLoginSel(u); setLoginErr(""); }}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-[#E4E0D6] hover:border-[#2F6B5E] hover:bg-[#E1EFEA] transition-colors text-left"
                >
                  <div>
                    <div className="font-semibold text-[#2B2820]">{u.name}</div>
                    <div className="text-xs text-[#8B8578] font-mono">{u.sub}</div>
                  </div>
                  <ChevronRight size={18} className="text-[#8B8578]" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button type="button" onClick={() => setLoginSel(null)} className="text-xs font-mono text-[#8B8578] hover:text-[#2B2820]">
                ← back
              </button>
              <div>
                <div className="font-semibold text-lg">{loginSel.name}</div>
                <div className="text-xs text-[#8B8578] font-mono">{loginSel.sub}</div>
              </div>
              <input
                autoFocus
                type="password"
                placeholder="Password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(e); }}
                className="w-full px-4 py-3 rounded-xl border border-[#E4E0D6] focus:outline-none focus:ring-2 focus:ring-[#2F6B5E] font-mono"
              />
              {loginErr && <div className="text-sm text-[#B23B3B] flex items-center gap-1.5"><AlertCircle size={14} />{loginErr}</div>}
              <button type="button" onClick={submit} className="w-full py-3 rounded-xl bg-[#2F6B5E] text-white font-semibold hover:bg-[#28584D] transition-colors">
                Log in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TopBar({ session, data, onLogout, saveError }) {
  const name = session.role === "master" ? "Master User" : data.reps.find((r) => r.id === session.repId)?.name;
  return (
    <div className="sticky top-0 z-10 bg-[#1B2A2A] text-[#F7F5F0] px-4 sm:px-6 py-3 flex items-center justify-between shadow-md">
      <div className="flex items-center gap-2">
        <Stamp size={18} className="text-[#7FC9B4]" />
        <span className="font-semibold tracking-tight" style={{ fontFamily: "Georgia, serif" }}>Echoheal</span>
        <span className="hidden sm:inline text-[#9CA89F] font-mono text-xs">/ {session.role === "master" ? "Master" : "Collection Rep"}</span>
      </div>
      <div className="flex items-center gap-3">
        {saveError && <span className="hidden sm:inline text-xs text-[#E8A33D] font-mono">{saveError}</span>}
        <span className="text-sm font-medium">{name}</span>
        <button onClick={onLogout} className="flex items-center gap-1 text-xs font-mono text-[#9CA89F] hover:text-white">
          <LogOut size={14} /> Log out
        </button>
      </div>
    </div>
  );
}

// ---------------- MASTER DASHBOARD ----------------

function MasterDashboard({ data, persist, onResetDemo }) {
  const [tab, setTab] = useState("overview");
  const tabs = [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "add", label: "Add Invoices", icon: Upload },
    { id: "reps", label: "Reps & Areas", icon: Users },
    { id: "invoices", label: "All Invoices", icon: Store },
    { id: "stores", label: "Store Master", icon: Building2 },
    { id: "export", label: "Export & Share", icon: FileSpreadsheet },
  ];

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-[#2F6B5E] text-white" : "bg-white text-[#5C574C] border border-[#E4E0D6] hover:border-[#2F6B5E]"
            }`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview data={data} />}
      {tab === "add" && <AddInvoices data={data} persist={persist} />}
      {tab === "reps" && <RepsAndAreas data={data} persist={persist} onResetDemo={onResetDemo} />}
      {tab === "invoices" && <AllInvoices data={data} persist={persist} />}
      {tab === "stores" && <StoreMaster data={data} />}
      {tab === "export" && <ExportShare data={data} />}
    </div>
  );
}

function Overview({ data }) {
  const pending = data.invoices.filter((i) => i.status !== "paid");
  const paidToday = data.invoices.filter((i) => i.status === "paid" && i.statusUpdatedAt?.slice(0, 10) === todayStr());
  const outstanding = pending.reduce((s, i) => s + (i.amount - (i.partialAmount || 0)), 0);
  const unassigned = data.invoices.filter((i) => !i.assignedRepId && i.status !== "paid");

  const repStats = data.reps.map((r) => {
    const own = data.invoices.filter((i) => i.assignedRepId === r.id);
    return {
      ...r,
      total: own.length,
      pending: own.filter((i) => i.status !== "paid").length,
      paid: own.filter((i) => i.status === "paid").length,
      };
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Pending invoices" value={pending.length} />
        <StatCard label="Outstanding amount" value={fmtINR(outstanding)} />
        <StatCard label="Paid today" value={paidToday.length} accent />
        <StatCard label="Unassigned" value={unassigned.length} warn={unassigned.length > 0} />
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E0D6] p-5">
        <h3 className="font-semibold mb-4">Collection reps</h3>
        <div className="space-y-3">
          {repStats.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-[#F0EEE7] pb-3 last:border-0 last:pb-0">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[#8B8578] font-mono">{r.areas.join(", ") || "no areas assigned"}</div>
              </div>
              <div className="flex gap-4 text-xs font-mono text-[#5C574C]">
                <span>{r.pending} pending</span>
                <span className="text-[#1F5C4E]">{r.paid} paid</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent, warn }) {
  return (
    <div className="bg-white rounded-xl border border-[#E4E0D6] p-4">
      <div className="text-xs font-mono uppercase tracking-wide text-[#8B8578]">{label}</div>
      <div className={`text-2xl font-semibold mt-1 ${warn ? "text-[#B23B3B]" : accent ? "text-[#1F5C4E]" : "text-[#2B2820]"}`}>{value}</div>
    </div>
  );
}

function AddInvoices({ data, persist }) {
  const blank = { storeCode: "", storeName: "", area: "", invoiceNo: "", amount: "", salesRep: "", invoiceDate: todayStr() };
  const [form, setForm] = useState(blank);
  const [bulkText, setBulkText] = useState("");
  const [msg, setMsg] = useState("");

  const addOne = (e) => {
    e.preventDefault();
    if (!form.storeCode || !form.storeName || !form.amount) {
      setMsg("Store code, store name and amount are required.");
      return;
    }
    const assignedRepId = findRepForArea(data.reps, form.area);
    const invoice = {
      id: "inv-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      storeCode: form.storeCode.trim(),
      storeName: form.storeName.trim(),
      area: form.area.trim(),
      invoiceNo: form.invoiceNo.trim(),
      amount: Number(form.amount) || 0,
      salesRep: form.salesRep.trim(),
      invoiceDate: form.invoiceDate,
      assignedRepId,
      status: "pending",
      partialAmount: 0,
      statusUpdatedAt: null,
      note: "",
    };
    persist({ ...data, invoices: [...data.invoices, invoice] });
    setForm(blank);
    setMsg(assignedRepId ? "Invoice added and auto-assigned." : "Invoice added — no rep matches this area yet, it's unassigned.");
  };

  const addBulk = () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const newInvoices = lines.map((line) => {
      const [storeCode, storeName, area, invoiceNo, amount, salesRep, date] = line.split(",").map((s) => (s || "").trim());
      return {
        id: "inv-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        storeCode: storeCode || "",
        storeName: storeName || "",
        area: area || "",
        invoiceNo: invoiceNo || "",
        amount: Number(amount) || 0,
        salesRep: salesRep || "",
        invoiceDate: date || todayStr(),
        assignedRepId: findRepForArea(data.reps, area),
        status: "pending",
        partialAmount: 0,
        statusUpdatedAt: null,
        note: "",
      };
    });
    persist({ ...data, invoices: [...data.invoices, ...newInvoices] });
    setBulkText("");
    setMsg(`Added ${newInvoices.length} invoices from bulk paste.`);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-[#E4E0D6] p-5">
        <h3 className="font-semibold mb-4">Add a single invoice</h3>
        <div className="space-y-3">
          <Field label="Store code *" value={form.storeCode} onChange={(v) => setForm({ ...form, storeCode: v })} />
          <Field label="Store name *" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} />
          <Field label="Area" value={form.area} onChange={(v) => setForm({ ...form, area: v })} placeholder="e.g. Ameerpet" />
          <Field label="Invoice number" value={form.invoiceNo} onChange={(v) => setForm({ ...form, invoiceNo: v })} />
          <Field label="Invoice amount *" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} type="number" />
          <Field label="Sales rep" value={form.salesRep} onChange={(v) => setForm({ ...form, salesRep: v })} />
          <Field label="Invoice date" value={form.invoiceDate} onChange={(v) => setForm({ ...form, invoiceDate: v })} type="date" />
          <button type="button" onClick={addOne} className="w-full py-2.5 rounded-lg bg-[#2F6B5E] text-white font-medium hover:bg-[#28584D] flex items-center justify-center gap-2">
            <Plus size={16} /> Add invoice
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E0D6] p-5">
        <h3 className="font-semibold mb-2">Bulk add (paste rows)</h3>
        <p className="text-xs text-[#8B8578] font-mono mb-3">One per line: storeCode, storeName, area, invoiceNo, amount, salesRep, date</p>
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={10}
          placeholder="AMP-014, Sri Sai Medicals, Ameerpet, EHP-2201, 12400, Kiran, 2026-07-28"
          className="w-full px-3 py-2 rounded-lg border border-[#E4E0D6] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B5E]"
        />
        <button onClick={addBulk} className="mt-3 w-full py-2.5 rounded-lg bg-[#2B2820] text-white font-medium hover:bg-[#1B1912] flex items-center justify-center gap-2">
          <Upload size={16} /> Upload all rows
        </button>
      </div>

      {msg && <div className="md:col-span-2 text-sm text-[#1F5C4E] bg-[#DCEFE8] rounded-lg px-4 py-3">{msg}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-wide text-[#8B8578]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-3 py-2 rounded-lg border border-[#E4E0D6] focus:outline-none focus:ring-2 focus:ring-[#2F6B5E]"
      />
    </label>
  );
}

function RepsAndAreas({ data, persist, onResetDemo }) {
  const updateRep = (id, patch) => {
    persist({ ...data, reps: data.reps.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  };
  const removeRep = (id) => {
    if (!confirm("Remove this rep? Their assigned invoices will become unassigned.")) return;
    persist({
      ...data,
      reps: data.reps.filter((r) => r.id !== id),
      invoices: data.invoices.map((i) => (i.assignedRepId === id ? { ...i, assignedRepId: null } : i)),
    });
  };
  const addRep = () => {
    const name = prompt("Rep name?");
    if (!name) return;
    const password = prompt("Password for this rep?") || "changeme123";
    persist({ ...data, reps: [...data.reps, { id: "r-" + Date.now(), name, password, areas: [] }] });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">Collection reps & their areas</h3>
        <div className="flex gap-2">
          <button onClick={addRep} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2F6B5E] text-white text-sm font-medium">
            <Plus size={15} /> Add rep
          </button>
          <button onClick={onResetDemo} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E4E0D6] text-sm font-medium text-[#8B8578]">
            <RefreshCw size={14} /> Reset demo data
          </button>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {data.reps.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl border border-[#E4E0D6] p-4 space-y-2">
            <div className="flex justify-between items-start">
              <input
                value={r.name}
                onChange={(e) => updateRep(r.id, { name: e.target.value })}
                className="font-semibold text-lg bg-transparent border-b border-transparent focus:border-[#2F6B5E] focus:outline-none w-2/3"
              />
              <button onClick={() => removeRep(r.id)} className="text-[#B23B3B] hover:bg-[#F5E9E1] p-1.5 rounded-lg">
                <Trash2 size={15} />
              </button>
            </div>
            <label className="block text-xs font-mono uppercase text-[#8B8578]">Areas (comma separated)</label>
            <input
              value={r.areas.join(", ")}
              onChange={(e) => updateRep(r.id, { areas: e.target.value.split(",").map((a) => a.trim()).filter(Boolean) })}
              placeholder="e.g. Ameerpet, Erragadda"
              className="w-full px-3 py-2 rounded-lg border border-[#E4E0D6] text-sm focus:outline-none focus:ring-2 focus:ring-[#2F6B5E]"
            />
            <label className="block text-xs font-mono uppercase text-[#8B8578] pt-1">Password</label>
            <input
              value={r.password}
              onChange={(e) => updateRep(r.id, { password: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#E4E0D6] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#2F6B5E]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function AllInvoices({ data, persist }) {
  const [filterRep, setFilterRep] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const reassign = (invId, repId) => {
    persist({ ...data, invoices: data.invoices.map((i) => (i.id === invId ? { ...i, assignedRepId: repId || null } : i)) });
  };

  const filtered = data.invoices.filter(
    (i) => (filterRep === "all" || i.assignedRepId === filterRep || (filterRep === "unassigned" && !i.assignedRepId)) &&
      (filterStatus === "all" || i.status === filterStatus)
  );

  return (
    <div className="bg-white rounded-2xl border border-[#E4E0D6] overflow-hidden">
      <div className="flex flex-wrap gap-3 p-4 border-b border-[#E4E0D6]">
        <select value={filterRep} onChange={(e) => setFilterRep(e.target.value)} className="px-3 py-1.5 rounded-lg border border-[#E4E0D6] text-sm">
          <option value="all">All reps</option>
          <option value="unassigned">Unassigned</option>
          {data.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-1.5 rounded-lg border border-[#E4E0D6] text-sm">
          <option value="all">All statuses</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <span className="ml-auto text-xs font-mono text-[#8B8578] self-center">{filtered.length} invoices</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-mono uppercase text-[#8B8578] border-b border-[#E4E0D6]">
              <th className="px-4 py-2">Store</th>
              <th className="px-4 py-2">Area</th>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Assigned to</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => (
      <tr key={i.id} className="border-b border-[#F0EEE7] last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{i.storeName}</div>
                  <div className="text-xs text-[#8B8578] font-mono">{i.storeCode}</div>
                </td>
                <td className="px-4 py-2.5">{i.area}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{i.invoiceNo}<br/><span className="text-[#8B8578]">{i.invoiceDate}</span></td>
                <td className="px-4 py-2.5 font-mono">{fmtINR(i.amount)}</td>
                <td className="px-4 py-2.5">
                  <select value={i.assignedRepId || ""} onChange={(e) => reassign(i.id, e.target.value)} className="px-2 py-1 rounded-lg border border-[#E4E0D6] text-xs">
                    <option value="">Unassigned</option>
                    {data.reps.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5"><StampBadge status={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-6 text-center text-sm text-[#8B8578]">No invoices match these filters.</div>}
      </div>
    </div>
  );
}

function StoreMaster({ data }) {
  const stores = useMemo(() => {
    const map = {};
    data.invoices.forEach((i) => {
      if (!map[i.storeCode]) map[i.storeCode] = { storeCode: i.storeCode, storeName: i.storeName, area: i.area, pending: 0, outstanding: 0, invoices: [] };
      map[i.storeCode].invoices.push(i);
      if (i.status !== "paid") {
        map[i.storeCode].pending += 1;
        map[i.storeCode].outstanding += i.amount - (i.partialAmount || 0);
      }
    });
    return Object.values(map).sort((a, b) => b.outstanding - a.outstanding);
  }, [data.invoices]);

  return (
    <div className="space-y-4">
      {stores.map((s) => (
        <div key={s.storeCode} className="bg-white rounded-2xl border border-[#E4E0D6] p-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-semibold">{s.storeName}</div>
              <div className="text-xs text-[#8B8578] font-mono">{s.storeCode} · {s.area}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono uppercase text-[#8B8578]">Outstanding</div>
              <div className="font-semibold text-[#B23B3B]">{fmtINR(s.outstanding)}</div>
            </div>
          </div>
          <div className="text-xs text-[#8B8578] font-mono mb-2">{s.pending} invoice(s) pending of {s.invoices.length} total</div>
          <div className="flex flex-wrap gap-2">
            {s.invoices.map((i) => (
              <span key={i.id} className="text-xs px-2 py-1 rounded-lg bg-[#F7F5F0] font-mono">{i.invoiceNo || "—"}: {fmtINR(i.amount)} <StampBadgeInline status={i.status} /></span>
            ))}
          </div>
        </div>
      ))}
      {stores.length === 0 && <div className="text-center text-sm text-[#8B8578] py-10">No invoices uploaded yet.</div>}
    </div>
  );
}

function StampBadgeInline({ status }) {
  const s = STATUS[status] || STATUS.pending;
  return <span className="ml-1" style={{ color: s.color }}>· {s.label}</span>;
}

function ExportShare({ data }) {
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [waText, setWaText] = useState("");

  const inRange = (d) => d >= from && d <= to;

  const exportExcel = () => {
    const invs = data.invoices.filter((i) => inRange(i.invoiceDate));
    const repName = (id) => data.reps.find((r) => r.id === id)?.name || "Unassigned";
    const invoiceRows = invs.map((i) => ({
      "Store Code": i.storeCode, "Store Name": i.storeName, Area: i.area, "Invoice No": i.invoiceNo,
      Amount: i.amount, "Partial Paid": i.partialAmount || 0, Outstanding: i.amount - (i.partialAmount || 0),
      "Sales Rep": i.salesRep, "Collection Rep": repName(i.assignedRepId), Status: STATUS[i.status]?.label || i.status,
      "Invoice Date": i.invoiceDate, "Last Updated": i.statusUpdatedAt || "",
    }));
    const storeMap = {};
    invs.forEach((i) => {
      if (!storeMap[i.storeCode]) storeMap[i.storeCode] = { "Store Code": i.storeCode, "Store Name": i.storeName, Area: i.area, "Pending Invoices": 0, "Total Outstanding": 0 };
      if (i.status !== "paid") {
        storeMap[i.storeCode]["Pending Invoices"] += 1;
        storeMap[i.storeCode]["Total Outstanding"] += i.amount - (i.partialAmount || 0);
      }
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), "Invoices");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.values(storeMap)), "Store Summary");
    XLSX.writeFile(wb, `echoheal-collections-${from}_to_${to}.xlsx`);
  };

  const generateWhatsApp = () => {
    const invs = data.invoices.filter((i) => inRange(i.invoiceDate));
    let text = `*Echoheal Pharma – Collection Update*\n${from} to ${to}\n\n`;
    data.reps.forEach((r) => {
      const own = invs.filter((i) => i.assignedRepId === r.id);
      if (!own.length) return;
      text += `*${r.name}*\n`;
      Object.entries(STATUS).forEach(([k, v]) => {
        const count = own.filter((i) => i.status === k).length;
        if (count) text += `  ${v.label}: ${count}\n`;
      });
      const outstanding = own.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amount - (i.partialAmount || 0)), 0);
      text += `  Outstanding: ${fmtINR(outstanding)}\n\n`;
    });
    setWaText(text);
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white rounded-2xl border border-[#E4E0D6] p-5 space-y-4">
        <h3 className="font-semibold">Export to Excel</h3>
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="text-xs font-mono uppercase text-[#8B8578]">From</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E4E0D6]" />
          </label>
          <label className="flex-1">
            <span className="text-xs font-mono uppercase text-[#8B8578]">To</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E4E0D6]" />
          </label>
        </div>
        <button onClick={exportExcel} className="w-full py-2.5 rounded-lg bg-[#2F6B5E] text-white font-medium hover:bg-[#28584D] flex items-center justify-center gap-2">
          <FileSpreadsheet size={16} /> Download Excel file
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E4E0D6] p-5 space-y-4">
        <h3 className="font-semibold">End-of-day WhatsApp summary</h3>
        <button onClick={generateWhatsApp} className="w-full py-2.5 rounded-lg bg-[#2B2820] text-white font-medium hover:bg-[#1B1912] flex items-center justify-center gap-2">
          <MessageCircle size={16} /> Generate summary
        </button>
        {waText && (
          <>
            <textarea readOnly value={waText} rows={8} className="w-full px-3 py-2 rounded-lg border border-[#E4E0D6] font-mono text-xs" />
            <a
              href={`https://wa.me/?text=${encodeURIComponent(waText)}`}
              target="_blank" rel="noopener noreferrer"
              className="block text-center w-full py-2.5 rounded-lg border border-[#2F6B5E] text-[#2F6B5E] font-medium hover:bg-[#E1EFEA]"
            >
              Open in WhatsApp
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------- REP DASHBOARD ----------------

function RepDashboard({ data, persist, repId }) {
  const rep = data.reps.find((r) => r.id === repId);
  const [showPaid, setShowPaid] = useState(false);
  const [partialFor, setPartialFor] = useState(null);
  const [partialAmt, setPartialAmt] = useState("");

  const own = data.invoices.filter((i) => i.assignedRepId === repId);
  const visible = own.filter((i) => (showPaid ? true : i.status !== "paid"));
  const outstanding = own.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amount - (i.partialAmount || 0)), 0);

  const setStatus = (invId, status, extra = {}) => {
    persist({
      ...data,
      invoices: data.invoices.map((i) => (i.id === invId ? { ...i, status, statusUpdatedAt: new Date().toISOString(), ...extra } : i)),
    });
  };

  const submitPartial = () => {
    const amt = Number(partialAmt);
    if (!amt || amt <= 0) return;
    setStatus(partialFor, "partial_payment", { partialAmount: amt });
    setPartialFor(null);
    setPartialAmt("");
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Assigned" value={own.length} />
        <StatCard label="Pending" value={own.filter((i) => i.status !== "paid").length} warn={own.some((i) => i.status !== "paid")} />
        <StatCard label="Outstanding" value={fmtINR(outstanding)} />
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold">Your visits — {rep?.areas.join(", ") || "no area assigned"}</h3>
        <label className="flex items-center gap-2 text-xs font-mono text-[#8B8578]">
          <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} /> show paid
        </label>
      </div>

      <div className="space-y-3">
        {visible.map((i) => (
          <div key={i.id} className="bg-white rounded-2xl border border-[#E4E0D6] p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold">{i.storeName}</div>
                <div className="text-xs text-[#8B8578] font-mono">{i.storeCode} · {i.area}</div>
              </div>
              <StampBadge status={i.status} />
            </div>
            <div className="text-sm font-mono text-[#5C574C] mb-3">
              Invoice {i.invoiceNo || "—"} · {fmtINR(i.amount)}
              {i.partialAmount > 0 && <span className="text-[#2F6B5E]"> ({fmtINR(i.partialAmount)} received, {fmtINR(i.amount - i.partialAmount)} due)</span>}
            </div>

            {partialFor === i.id ? (
              <div className="flex gap-2">
                <input
                  autoFocus type="number" placeholder="Amount received"
                  value={partialAmt} onChange={(e) => setPartialAmt(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#E4E0D6]"
                />
                <button onClick={submitPartial} className="px-4 py-2 rounded-lg bg-[#2F6B5E] text-white text-sm font-medium">Save</button>
                <button onClick={() => setPartialFor(null)} className="px-3 py-2 rounded-lg border border-[#E4E0D6] text-sm">Cancel</button>
              </div>
            ) : (
              i.status !== "paid" && (
                <div className="flex flex-wrap gap-2">
                  <ActionBtn onClick={() => setStatus(i.id, "paid")} label="Invoice Paid" primary />
                  <ActionBtn onClick={() => { setPartialFor(i.id); setPartialAmt(""); }} label="Partial Payment" />
                  <ActionBtn onClick={() => setStatus(i.id, "store_closed")} label="Store Closed" />
                  <ActionBtn onClick={() => setStatus(i.id, "owner_unavailable")} label="Owner Not Available" />
                  <ActionBtn onClick={() => setStatus(i.id, "next_week")} label="Next Week" />
                </div>
              )
            )}
          </div>
        ))}
        {visible.length === 0 && <div className="text-center text-sm text-[#8B8578] py-10">Nothing pending here — nice work.</div>}
      </div>
    </div>
  );
}

function ActionBtn({ onClick, label, primary }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        primary ? "bg-[#2F6B5E] text-white hover:bg-[#28584D]" : "bg-[#F7F5F0] text-[#5C574C] hover:bg-[#E4E0D6]"
      }`}
    >
      {label}
    </button>
  );
}
