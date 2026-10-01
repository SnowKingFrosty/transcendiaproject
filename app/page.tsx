"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase, type Delivery } from "@/lib/supabase";

const dealerZoneMapping: Record<string, string> = {
  Chrysler: "1",
  Toyota: "2",
  Hyundai: "3",
  Honda: "4",
  Mazda: "5",
  "Acura/Subaru": "6",
  Chevy: "7",
  "Westside Volkswagen": "8",
  "Land Rover/Genesis": "9",
  Infiniti: "10",
};

const zoneOptions = [
  { value: "1", label: "Zone 1 (Chrys)" },
  { value: "2", label: "Zone 2 (Toyota)" },
  { value: "3", label: "Zone 3 (Hyundai)" },
  { value: "4", label: "Zone 4 (Honda)" },
  { value: "5", label: "Zone 5 (Mazda)" },
  { value: "6", label: "Zone 6 (Acura/Subaru)" },
  { value: "7", label: "Zone 7 (Chevy)" },
  { value: "8", label: "Zone 8 (Westside VW)" },
  { value: "9", label: "Zone 9 (Land Rover/Genesis)" },
  { value: "10", label: "Zone 10 (Infiniti)" },
];

const dealerStores = Object.keys(dealerZoneMapping);

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

type UserRole = "none" | "driver" | "dealer";
type EntryType = "delivery" | "pickup";
type ScopeMode = "store" | "global";

type CardData = Delivery & { isArchived: boolean };

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [userRole, setUserRole] = useState<UserRole>("none");
  const [driverZone, setDriverZone] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("store");
  const [entryType, setEntryType] = useState<EntryType>("delivery");
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // Modals
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showDealerModal, setShowDealerModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Active action targets
  const [activeDeleteId, setActiveDeleteId] = useState<string | null>(null);
  const [activeCancelId, setActiveCancelId] = useState<string | null>(null);
  const [activeArchiveId, setActiveArchiveId] = useState<string | null>(null);
  const [activeCompletionId, setActiveCompletionId] = useState<string | null>(null);
  const [activeCompletionData, setActiveCompletionData] = useState<Delivery | null>(null);

  // Form state
  const [invoiceNum, setInvoiceNum] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [selectedZone, setSelectedZone] = useState("1");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState("");

  // Login form state
  const [driverUser, setDriverUser] = useState("");
  const [driverPass, setDriverPass] = useState("");
  const [driverZoneInput, setDriverZoneInput] = useState("");
  const [dealerSelect, setDealerSelect] = useState("");
  const [dealerPass, setDealerPass] = useState("");
  const [deletePin, setDeletePin] = useState("");

  // Archive search
  const [archiveSearch, setArchiveSearch] = useState("");

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const isDrawingRef = useRef(false);

  // Completion photo input
  const completionPhotoRef = useRef<HTMLInputElement>(null);
  const invoicePhotoRef = useRef<HTMLInputElement>(null);

  // Realtime subscription
  useEffect(() => {
    setMounted(true);
    const channel = supabase
      .channel("deliveries-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deliveries" },
        () => fetchDeliveries()
      )
      .subscribe();

    fetchDeliveries();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDeliveries = useCallback(async () => {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Error fetching deliveries:", error);
      return;
    }
    setDeliveries((data as Delivery[]) || []);
  }, []);

  const showSuccessPopup = (msg: string) => {
    setSuccessMsg(msg);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const handleDriverLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const username = driverUser.trim().toLowerCase();
    const password = driverPass.trim().toLowerCase();
    const matchedStore = dealerStores.find(
      (s) => s.toLowerCase() === password
    );
    if (username === "partsdriver" && matchedStore) {
      setDriverZone(driverZoneInput);
      setUserRole("driver");
      setShowDriverModal(false);
      setDriverUser("");
      setDriverPass("");
      setDriverZoneInput("");
      showSuccessPopup(`Driver login verified (Zone ${driverZoneInput}).`);
    } else {
      alert("Invalid driver credentials.");
    }
  };

  const handleDealerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const store = dealerSelect;
    const pass = dealerPass.trim();
    if (store && pass === "parts") {
      setSelectedStore(store);
      setScopeMode("store");
      setUserRole("dealer");
      setShowAddForm(true);
      setShowDealerModal(false);
      const zone = dealerZoneMapping[store];
      if (zone) setSelectedZone(zone);
      setDealerSelect("");
      setDealerPass("");
      showSuccessPopup(`Logged in to ${store} store.`);
    } else {
      alert("Please select a store and ensure valid credentials!");
    }
  };

  const handleLogout = () => {
    setUserRole("none");
    setDriverZone(null);
    setSelectedStore(null);
    setScopeMode("store");
    setShowAddForm(false);
    showSuccessPopup("Logged out successfully.");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      clearFileSelection();
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setUploadedImageUrl(url);
      setPreviewSrc(url);
    };
    reader.readAsDataURL(file);
  };

  const clearFileSelection = () => {
    if (invoicePhotoRef.current) invoicePhotoRef.current.value = "";
    setUploadedImageUrl(null);
    setPreviewSrc("");
  };

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    const invoice = entryType === "pickup" ? "N/A" : invoiceNum.trim();
    const customer = customerName.trim();
    const zone = selectedZone;
    const store = selectedStore || "General";
    const nowHour = new Date().getHours();
    const status = nowHour < 12 ? "am" : "pm";

    const { error } = await supabase.from("deliveries").insert({
      invoice,
      customer,
      zone,
      store,
      status,
      entry_type: entryType,
      image_url: uploadedImageUrl,
      signature_url: null,
      completion_timestamp: null,
      completion_epoch: null,
      canceled_epoch: null,
      status_type: "active",
      force_archive: false,
    });

    if (error) {
      console.error("Error saving entry:", error);
      alert("Failed to save entry to cloud database.");
      return;
    }

    setInvoiceNum("");
    setCustomerName("");
    clearFileSelection();
    setEntryType("delivery");
    if (selectedStore && dealerZoneMapping[selectedStore]) {
      setSelectedZone(dealerZoneMapping[selectedStore]);
    }
    showSuccessPopup(
      `${entryType === "pickup" ? "Pickup" : "Delivery"} added successfully (Zone ${zone}).`
    );
  };

  const handleCancelDelivery = async () => {
    if (!activeCancelId) return;
    const { error } = await supabase
      .from("deliveries")
      .update({
        status_type: "canceled",
        canceled_epoch: Date.now(),
      })
      .eq("id", activeCancelId);
    if (error) {
      console.error("Error canceling delivery:", error);
      alert("Failed to cancel delivery.");
    } else {
      showSuccessPopup("Delivery canceled successfully.");
    }
    setShowCancelModal(false);
    setActiveCancelId(null);
  };

  const handleArchiveItem = async () => {
    if (!activeArchiveId) return;
    const { error } = await supabase
      .from("deliveries")
      .update({ force_archive: true })
      .eq("id", activeArchiveId);
    if (error) {
      console.error("Error archiving item:", error);
      alert("Failed to archive item.");
    } else {
      showSuccessPopup("Item archived successfully.");
    }
    setShowArchiveModal(false);
    setActiveArchiveId(null);
  };

  const handleDeleteArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePin.trim() !== "luther") {
      alert("Incorrect PIN!");
      return;
    }
    if (!activeDeleteId) return;
    const { error } = await supabase
      .from("deliveries")
      .delete()
      .eq("id", activeDeleteId);
    if (error) {
      console.error("Error deleting document:", error);
      alert("Failed to delete document from database.");
    } else {
      showSuccessPopup("Archived file deleted successfully.");
    }
    setDeletePin("");
    setShowDeleteModal(false);
    setActiveDeleteId(null);
  };

  const handleMarkLate = async (id: string) => {
    const { error } = await supabase
      .from("deliveries")
      .update({ status_type: "late" })
      .eq("id", id);
    if (error) console.error("Error marking late:", error);
  };

  const handleMarkCompleted = (id: string, data: Delivery) => {
    if (userRole === "driver" && driverZone) {
      if (String(data.zone) !== String(driverZone)) {
        alert(
          `Access Denied: This item belongs to Zone ${data.zone}, but you are assigned to Zone ${driverZone}.`
        );
        return;
      }
    }
    setActiveCompletionId(id);
    setActiveCompletionData(data);
    setShowPhotoPrompt(true);
  };

  const handlePhotoPromptNo = () => {
    setShowPhotoPrompt(false);
    setShowSignature(true);
    setTimeout(initSignatureCanvas, 50);
  };

  const handlePhotoPromptYes = () => {
    setShowPhotoPrompt(false);
    if (completionPhotoRef.current) {
      completionPhotoRef.current.value = "";
      completionPhotoRef.current.click();
    }
  };

  const handleCompletionPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setActiveCompletionData((prev) =>
          prev ? { ...prev, image_url: url } : prev
        );
        setShowSignature(true);
        setTimeout(initSignatureCanvas, 50);
      };
      reader.readAsDataURL(file);
    } else {
      setShowSignature(true);
      setTimeout(initSignatureCanvas, 50);
    }
  };

  const handleSaveSignature = async () => {
    if (!activeCompletionId) return;
    let signatureDataUrl: string | null = null;
    if (hasDrawn && canvasRef.current) {
      signatureDataUrl = canvasRef.current.toDataURL("image/png");
    }
    setShowSignature(false);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const epochTime = now.getTime();

    const { error } = await supabase
      .from("deliveries")
      .update({
        completion_timestamp: timeString,
        completion_epoch: epochTime,
        image_url: activeCompletionData?.image_url || null,
        signature_url: signatureDataUrl,
        status_type: "active",
      })
      .eq("id", activeCompletionId);

    if (error) {
      console.error("Error completing item:", error);
      alert("Failed to update status.");
    } else {
      showSuccessPopup("Item marked as completed successfully.");
    }

    setActiveCompletionId(null);
    setActiveCompletionData(null);
  };

  // Signature canvas functions
  const initSignatureCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    canvas.width = rect?.width || 350;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  // Compute card data with archiving logic
  const nowEpoch = Date.now();
  const currentHour = new Date().getHours();

  const computeCards = (): CardData[] => {
    return deliveries
      .filter((d) => {
        let isArchived = false;
        const isForcedArchive =
          d.status_type === "canceled" && d.force_archive === true;
        if (
          isForcedArchive ||
          (d.completion_epoch &&
            nowEpoch - d.completion_epoch >= TWELVE_HOURS_MS) ||
          (d.canceled_epoch &&
            nowEpoch - d.canceled_epoch >= TWELVE_HOURS_MS)
        ) {
          isArchived = true;
        }

        if (!isArchived) {
          if (userRole === "driver" && driverZone) {
            if (String(d.zone) !== String(driverZone)) return false;
          } else if (userRole === "dealer" && selectedStore) {
            if (scopeMode === "store" && d.store !== selectedStore) return false;
          }
        }
        return true;
      })
      .map((d) => {
        let isArchived = false;
        const isForcedArchive =
          d.status_type === "canceled" && d.force_archive === true;
        if (
          isForcedArchive ||
          (d.completion_epoch &&
            nowEpoch - d.completion_epoch >= TWELVE_HOURS_MS) ||
          (d.canceled_epoch &&
            nowEpoch - d.canceled_epoch >= TWELVE_HOURS_MS)
        ) {
          isArchived = true;
        }
        return { ...d, isArchived };
      });
  };

  const cards = computeCards();

  const getCardColumn = (d: CardData): string => {
    if (d.isArchived) return "archive";
    if (d.completion_timestamp) return "completed";
    if (d.status_type === "canceled") return "canceled";
    const isAmLate =
      currentHour >= 12 &&
      d.status === "am" &&
      !d.completion_timestamp &&
      d.status_type !== "canceled";
    const isPmLate =
      currentHour >= 15 &&
      d.status === "pm" &&
      !d.completion_timestamp &&
      d.status_type !== "canceled";
    if (d.status_type === "late" || isAmLate || isPmLate) return "late";
    return d.status;
  };

  const lists: Record<string, CardData[]> = {
    am: [],
    pm: [],
    completed: [],
    archive: [],
    late: [],
    canceled: [],
  };

  cards.forEach((c) => {
    const col = getCardColumn(c);
    if (lists[col]) lists[col].push(c);
  });

  const showAmColumn = currentHour < 12;
  const showLateColumn = lists.late.length > 0;
  const showCanceledColumn = lists.canceled.length > 0;

  const filteredArchive = lists.archive.filter((c) => {
    if (!archiveSearch.trim()) return true;
    const q = archiveSearch.trim().toLowerCase();
    const invoiceText = (c.invoice || "").toLowerCase();
    const epochToUse = c.completion_epoch || c.canceled_epoch;
    const dateStr = epochToUse
      ? new Date(epochToUse).toLocaleDateString().toLowerCase()
      : "";
    const fullDateStr = epochToUse
      ? new Date(epochToUse)
          .toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
          .toLowerCase()
      : "";
    const customerText = (c.customer || "").toLowerCase();
    return (
      invoiceText.includes(q) ||
      dateStr.includes(q) ||
      fullDateStr.includes(q) ||
      customerText.includes(q)
    );
  });

  if (!mounted) return null;

  const isDriver = userRole === "driver";
  const isDealer = userRole === "dealer";
  const bodyClass = isDriver
    ? "driver-logged-in"
    : isDealer
      ? "dealer-logged-in"
      : "";

  return (
    <div className={bodyClass}>
      {userRole === "none" && (
        <div id="auth-gate-screen">
          <div className="gate-card">
            <div className="gate-title-wrapper">
              <svg className="brand-logo" viewBox="0 0 24 24">
                <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
              </svg>
              <h1 className="gradient-title">Transcendia</h1>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-base)",
                color: "var(--text-muted)",
              }}
            >
              Please log in to access the delivery tracking system.
            </p>
            <div className="gate-buttons">
              <button
                onClick={() => setShowDriverModal(true)}
                className="btn-driver-login"
                style={{ justifyContent: "center", padding: "0.75rem" }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                Driver Login
              </button>
              <button
                onClick={() => setShowDealerModal(true)}
                className="btn-dealer-login"
                style={{ justifyContent: "center", padding: "0.75rem" }}
              >
                <svg viewBox="0 0 24 24" style={{ width: 16, height: 16 }}>
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0-2-.9-2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                </svg>
                Dealer Login
              </button>
            </div>
          </div>
        </div>
      )}

      {userRole !== "none" && (
        <div className="page-wrapper">
          <header className="portal-header-card">
            <div className="portal-title-area">
              <svg className="brand-logo" viewBox="0 0 24 24">
                <path d="M12 2C12 7.5 16.5 12 22 12C16.5 12 12 16.5 12 22C12 16.5 7.5 12 2 12C7.5 12 12 7.5 12 2Z" />
              </svg>
              <h1 className="gradient-title">Transcendia</h1>
            </div>
            <div className="header-actions">
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <div className="user-status-badge">
                  <svg viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  {isDriver
                    ? `Driver (Zone ${driverZone})`
                    : `Dealer: ${selectedStore}`}
                </div>
                <button className="btn-logout" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            </div>
          </header>

          {isDealer && (
            <div className="dealer-scope-bar">
              <div className="dealer-store-badge">
                {selectedStore}{" "}
                <span className="zone-pill">
                  {dealerZoneMapping[selectedStore || ""] || "N/A"}
                </span>
              </div>
              <div className="scope-toggle-group">
                <button
                  type="button"
                  className={`scope-toggle-btn ${scopeMode === "store" ? "active" : ""}`}
                  onClick={() => setScopeMode("store")}
                >
                  Dealer Mode
                </button>
                <button
                  type="button"
                  className={`scope-toggle-btn ${scopeMode === "global" ? "active" : ""}`}
                  onClick={() => setScopeMode("global")}
                >
                  Global Mode
                </button>
              </div>
            </div>
          )}

          {showAddForm && (
            <section className="dashboard-card">
              <h2>Add New Item</h2>
              <form className="form-grid" onSubmit={handleAddDelivery}>
                <div className="form-group full-width">
                  <label>Entry Type</label>
                  <div className="type-selector-group">
                    <button
                      type="button"
                      className={`type-toggle-btn ${entryType === "delivery" ? "active-delivery" : ""}`}
                      onClick={() => setEntryType("delivery")}
                    >
                      Delivery
                    </button>
                    <button
                      type="button"
                      className={`type-toggle-btn ${entryType === "pickup" ? "active-pickup" : ""}`}
                      onClick={() => setEntryType("pickup")}
                    >
                      Pickup
                    </button>
                  </div>
                </div>
                {entryType === "delivery" && (
                  <div className="form-group">
                    <label htmlFor="invoice-num">Invoice / Reference #</label>
                    <input
                      type="text"
                      id="invoice-num"
                      placeholder="..."
                      value={invoiceNum}
                      onChange={(e) => setInvoiceNum(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="customer-name">Shop / Customer Name</label>
                  <input
                    type="text"
                    id="customer-name"
                    placeholder="..."
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="delivery-zone-select">Delivery Zone (1-10)</label>
                  <select
                    id="delivery-zone-select"
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    required
                  >
                    {zoneOptions.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group full-width">
                  <label htmlFor="invoice-photo">Invoice Photo / Document</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="file"
                      id="invoice-photo"
                      accept="image/*"
                      capture="environment"
                      ref={invoicePhotoRef}
                      onChange={handleFileUpload}
                    />
                  </div>
                  <div className="file-upload-preview">
                    {previewSrc && (
                      <img
                        className="preview-thumbnail show"
                        src={previewSrc}
                        alt="Invoice Preview"
                      />
                    )}
                    {previewSrc && (
                      <button
                        type="button"
                        className="btn-remove-file show"
                        onClick={clearFileSelection}
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
                <button type="submit" className="btn-primary">
                  Add Item
                </button>
              </form>
            </section>
          )}

          <div className="dashboard-container">
            {showAmColumn && (
              <div className="delivery-column">
                <div className="column-header am-header">
                  <span>To Do</span>
                  <span className="badge">{lists.am.length}</span>
                </div>
                <div className="card-list">
                  {lists.am.map((d) => (
                    <DeliveryCard
                      key={d.id}
                      data={d}
                      isDriver={isDriver}
                      isDealer={isDealer}
                      currentHour={currentHour}
                      onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                      onMarkLate={() => handleMarkLate(d.id)}
                      onCancel={() => {
                        setActiveCancelId(d.id);
                        setShowCancelModal(true);
                      }}
                      onArchiveNow={() => {
                        setActiveArchiveId(d.id);
                        setShowArchiveModal(true);
                      }}
                      onDelete={() => {
                        setActiveDeleteId(d.id);
                        setShowDeleteModal(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            {!showAmColumn && (
              <div className="delivery-column">
                <div className="column-header pm-header">
                  <span>To Do</span>
                  <span className="badge">{lists.pm.length}</span>
                </div>
                <div className="card-list">
                  {lists.pm.map((d) => (
                    <DeliveryCard
                      key={d.id}
                      data={d}
                      isDriver={isDriver}
                      isDealer={isDealer}
                      currentHour={currentHour}
                      onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                      onMarkLate={() => handleMarkLate(d.id)}
                      onCancel={() => {
                        setActiveCancelId(d.id);
                        setShowCancelModal(true);
                      }}
                      onArchiveNow={() => {
                        setActiveArchiveId(d.id);
                        setShowArchiveModal(true);
                      }}
                      onDelete={() => {
                        setActiveDeleteId(d.id);
                        setShowDeleteModal(true);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="delivery-column">
              <div className="column-header completed-header">
                <span>Completed Items</span>
                <span className="badge">{lists.completed.length}</span>
              </div>
              <div className="card-list">
                {lists.completed.map((d) => (
                  <DeliveryCard
                    key={d.id}
                    data={d}
                    isDriver={isDriver}
                    isDealer={isDealer}
                    currentHour={currentHour}
                    onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                    onMarkLate={() => handleMarkLate(d.id)}
                    onCancel={() => {
                      setActiveCancelId(d.id);
                      setShowCancelModal(true);
                    }}
                    onArchiveNow={() => {
                      setActiveArchiveId(d.id);
                      setShowArchiveModal(true);
                    }}
                    onDelete={() => {
                      setActiveDeleteId(d.id);
                      setShowDeleteModal(true);
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="delivery-column">
              <div className="column-header archive-header">
                <div className="header-title-group">
                  <svg className="header-icon" viewBox="0 0 24 24">
                    <path d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.15.55L3.46 5.23C3.17 5.57 3 6.01 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.49-.17-.93-.46-1.27zM12 17.5L6.5 12H10v-3h4v3h3.5L12 17.5zM5.12 5l.81-1h12l.81 1H5.12z" />
                  </svg>
                  <span>Archive Grid</span>
                </div>
                <span className="badge">{lists.archive.length}</span>
              </div>
              <div className="archive-search-box">
                <input
                  type="text"
                  className="archive-search-input"
                  placeholder="Search invoice # or date..."
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value)}
                />
              </div>
              <div className="card-list">
                {filteredArchive.map((d) => (
                  <DeliveryCard
                    key={d.id}
                    data={d}
                    isDriver={isDriver}
                    isDealer={isDealer}
                    currentHour={currentHour}
                    onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                    onMarkLate={() => handleMarkLate(d.id)}
                    onCancel={() => {
                      setActiveCancelId(d.id);
                      setShowCancelModal(true);
                    }}
                    onArchiveNow={() => {
                      setActiveArchiveId(d.id);
                      setShowArchiveModal(true);
                    }}
                    onDelete={() => {
                      setActiveDeleteId(d.id);
                      setShowDeleteModal(true);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {(showLateColumn || showCanceledColumn) && (
            <div className="dashboard-container" style={{ marginTop: "0.5rem" }}>
              {showLateColumn && (
                <div className="delivery-column">
                  <div className="column-header caution-header">
                    <div className="header-title-group">
                      <svg className="header-icon" viewBox="0 0 24 24">
                        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                      </svg>
                      <span>Late Deliveries</span>
                    </div>
                    <span className="badge">{lists.late.length}</span>
                  </div>
                  <div className="card-list">
                    {lists.late.map((d) => (
                      <DeliveryCard
                        key={d.id}
                        data={d}
                        isDriver={isDriver}
                        isDealer={isDealer}
                        currentHour={currentHour}
                        onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                        onMarkLate={() => handleMarkLate(d.id)}
                        onCancel={() => {
                          setActiveCancelId(d.id);
                          setShowCancelModal(true);
                        }}
                        onArchiveNow={() => {
                          setActiveArchiveId(d.id);
                          setShowArchiveModal(true);
                        }}
                        onDelete={() => {
                          setActiveDeleteId(d.id);
                          setShowDeleteModal(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {showCanceledColumn && (
                <div className="delivery-column">
                  <div className="column-header canceled-header">
                    <div className="header-title-group">
                      <svg className="header-icon" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                      <span>Canceled Deliveries</span>
                    </div>
                    <span className="badge">{lists.canceled.length}</span>
                  </div>
                  <div className="card-list">
                    {lists.canceled.map((d) => (
                      <DeliveryCard
                        key={d.id}
                        data={d}
                        isDriver={isDriver}
                        isDealer={isDealer}
                        currentHour={currentHour}
                        onMarkCompleted={() => handleMarkCompleted(d.id, d)}
                        onMarkLate={() => handleMarkLate(d.id)}
                        onCancel={() => {
                          setActiveCancelId(d.id);
                          setShowCancelModal(true);
                        }}
                        onArchiveNow={() => {
                          setActiveArchiveId(d.id);
                          setShowArchiveModal(true);
                        }}
                        onDelete={() => {
                          setActiveDeleteId(d.id);
                          setShowDeleteModal(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Driver Login Modal */}
      {showDriverModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowDriverModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Driver Portal Login</h2>
              <button className="close-modal" onClick={() => setShowDriverModal(false)}>
                &times;
              </button>
            </div>
            <form className="login-stack" onSubmit={handleDriverLogin}>
              <div className="form-group">
                <label htmlFor="driver-user">Driver ID / Username</label>
                <input
                  type="text"
                  id="driver-user"
                  placeholder="..."
                  value={driverUser}
                  onChange={(e) => setDriverUser(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="driver-pass">Password</label>
                <input
                  type="password"
                  id="driver-pass"
                  placeholder="..."
                  value={driverPass}
                  onChange={(e) => setDriverPass(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="driver-assigned-zone">Assigned Delivery Zone (1-10)</label>
                <input
                  type="number"
                  id="driver-assigned-zone"
                  min={1}
                  max={10}
                  placeholder="..."
                  value={driverZoneInput}
                  onChange={(e) => setDriverZoneInput(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Login</button>
            </form>
          </div>
        </div>
      )}

      {/* Dealer Login Modal */}
      {showDealerModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowDealerModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Dealer Access Login</h2>
              <button className="close-modal" onClick={() => setShowDealerModal(false)}>
                &times;
              </button>
            </div>
            <form className="login-stack" onSubmit={handleDealerLogin}>
              <div className="form-group">
                <label htmlFor="dealer-select">Select Dealership Store</label>
                <select
                  id="dealer-select"
                  value={dealerSelect}
                  onChange={(e) => setDealerSelect(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    -- Choose Store --
                  </option>
                  {dealerStores.map((s) => (
                    <option key={s} value={s}>
                      {s} (Zone {dealerZoneMapping[s]})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="dealer-pass">Password</label>
                <input
                  type="password"
                  id="dealer-pass"
                  placeholder="..."
                  value={dealerPass}
                  onChange={(e) => setDealerPass(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary">Access Portal</button>
            </form>
          </div>
        </div>
      )}

      {/* Delete PIN Modal */}
      {showDeleteModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setActiveDeleteId(null); } }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Delete Confirmation</h2>
              <button className="close-modal" onClick={() => { setShowDeleteModal(false); setActiveDeleteId(null); }}>
                &times;
              </button>
            </div>
            <form className="login-stack" onSubmit={handleDeleteArchive}>
              <div className="form-group">
                <label htmlFor="delete-pin-input">Enter PIN to Delete</label>
                <input
                  type="password"
                  id="delete-pin-input"
                  placeholder="..."
                  value={deletePin}
                  onChange={(e) => setDeletePin(e.target.value)}
                  required
                />
              </div>
              <div className="dialog-buttons">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => { setShowDeleteModal(false); setActiveDeleteId(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-danger-action">Delete File</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirm Modal */}
      {showCancelModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) { setShowCancelModal(false); setActiveCancelId(null); } }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Confirm Cancellation</h2>
            </div>
            <p style={{ margin: 0, fontSize: "var(--font-size-base)", color: "var(--text-muted)" }}>
              Are you sure you want to cancel this delivery?
            </p>
            <div className="dialog-buttons">
              <button
                className="btn-secondary-action"
                onClick={() => { setShowCancelModal(false); setActiveCancelId(null); }}
              >
                No
              </button>
              <button className="btn-warning" onClick={handleCancelDelivery}>
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirm Modal */}
      {showArchiveModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) { setShowArchiveModal(false); setActiveArchiveId(null); } }}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Confirm Archiving</h2>
            </div>
            <p style={{ margin: 0, fontSize: "var(--font-size-base)", color: "var(--text-muted)" }}>
              Are you sure you want to archive this canceled item immediately?
            </p>
            <div className="dialog-buttons">
              <button
                className="btn-secondary-action"
                onClick={() => { setShowArchiveModal(false); setActiveArchiveId(null); }}
              >
                No
              </button>
              <button className="btn-archive-action" onClick={handleArchiveItem}>
                Yes, Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Prompt Modal */}
      {showPhotoPrompt && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Completion Confirmation</h2>
            </div>
            <p style={{ margin: 0, fontSize: "var(--font-size-base)", color: "var(--text-muted)" }}>
              Would you like to add a confirmation photo?
            </p>
            <div className="dialog-buttons">
              <button className="btn-secondary-action" onClick={handlePhotoPromptNo}>
                No
              </button>
              <button className="btn-primary" onClick={handlePhotoPromptYes}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignature && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Customer / Receiver Signature</h2>
              <button
                className="close-modal"
                onClick={() => { setShowSignature(false); setActiveCompletionId(null); }}
              >
                &times;
              </button>
            </div>
            <div className="signature-container">
              <label style={{ fontSize: "calc(var(--font-size-base) * 0.9)", color: "var(--text-muted)" }}>
                Please sign below to confirm receipt:
              </label>
              <div className="signature-pad-wrapper">
                <canvas
                  id="signature-canvas"
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={(e) => { e.preventDefault(); startDrawing(e); }}
                  onTouchMove={(e) => { e.preventDefault(); draw(e); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopDrawing(); }}
                />
              </div>
              <div className="signature-actions">
                <button type="button" className="btn-clear-sig" onClick={initSignatureCanvas}>
                  Clear Signature
                </button>
              </div>
            </div>
            <div className="dialog-buttons" style={{ marginTop: "0.5rem" }}>
              <button
                className="btn-secondary-action"
                onClick={() => { setShowSignature(false); setActiveCompletionId(null); }}
              >
                Cancel
              </button>
              <button className="btn-primary" onClick={handleSaveSignature}>
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        type="file"
        ref={completionPhotoRef}
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={handleCompletionPhoto}
      />

      {/* Success Popup */}
      {showSuccess && (
        <div className="success-popup-overlay active">
          <div className="success-popup-card">
            <div className="success-icon-large">
              <svg viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
            <h3 className="success-popup-title">Success</h3>
            <p className="success-popup-message">{successMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DeliveryCard({
  data,
  isDriver,
  isDealer,
  currentHour,
  onMarkCompleted,
  onMarkLate,
  onCancel,
  onArchiveNow,
  onDelete,
}: {
  data: CardData;
  isDriver: boolean;
  isDealer: boolean;
  currentHour: number;
  onMarkCompleted: () => void;
  onMarkLate: () => void;
  onCancel: () => void;
  onArchiveNow: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPickup = data.entry_type === "pickup";
  const isCanceled = data.status_type === "canceled" && !data.isArchived;
  const isAmLate =
    currentHour >= 12 &&
    data.status === "am" &&
    !data.completion_timestamp &&
    !data.isArchived &&
    data.status_type !== "canceled";
  const isPmLate =
    currentHour >= 15 &&
    data.status === "pm" &&
    !data.completion_timestamp &&
    !data.isArchived &&
    data.status_type !== "canceled";
  const isRunningLate =
    (data.status_type === "late" || isAmLate || isPmLate) && !data.isArchived;

  let cardClass = "delivery-card";
  if (data.isArchived) cardClass += " is-archived";
  else if (isCanceled) cardClass += " is-canceled";
  else if (isRunningLate) cardClass += " is-running-late";
  else cardClass += isPickup ? " is-pickup" : " is-delivery";
  if (expanded) cardClass += " expanded";

  const entryTypeText = isPickup ? "Pickup" : "Delivery";
  const epochToUse = data.completion_epoch || data.canceled_epoch;

  let actionButtons: React.ReactNode = null;
  if (data.isArchived) {
    actionButtons = (
      <button className="btn-danger-action" style={{ marginTop: "0.3rem" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
        Delete File
      </button>
    );
  } else if (!data.completion_timestamp && !isCanceled) {
    const buttons: React.ReactNode[] = [];
    if (
      isDriver &&
      ((currentHour >= 12 && data.status === "am") ||
        (currentHour >= 15 && data.status === "pm")) &&
      data.status_type !== "late"
    ) {
      buttons.push(
        <button key="late" className="btn-warning" style={{ marginTop: "0.3rem" }} onClick={(e) => { e.stopPropagation(); onMarkLate(); }}>
          Mark Late
        </button>
      );
    }
    if (isDealer) {
      buttons.push(
        <button key="cancel" className="btn-warning" style={{ marginTop: "0.3rem" }} onClick={(e) => { e.stopPropagation(); onCancel(); }}>
          Cancel Delivery
        </button>
      );
    }
    actionButtons = buttons.length > 0 ? <>{buttons}</> : null;
  } else if (isCanceled && isDealer) {
    actionButtons = (
      <button className="btn-archive-action" style={{ marginTop: "0.3rem" }} onClick={(e) => { e.stopPropagation(); onArchiveNow(); }}>
        Archive Now
      </button>
    );
  }

  let statusPill: React.ReactNode = null;
  if (isCanceled) {
    statusPill = (
      <span className="canceled-badge-inline">
        <svg viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
        canceled
      </span>
    );
  } else if (isRunningLate && !data.completion_timestamp) {
    statusPill = (
      <span className="running-late-badge-inline">
        <svg viewBox="0 0 24 24">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
        late
      </span>
    );
  }

  const typePillClass = data.isArchived ? "archive" : isPickup ? "pickup" : "delivery";

  let timestampHtml: React.ReactNode = null;
  if (data.isArchived) {
    const fullDateStr = epochToUse
      ? new Date(epochToUse).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
      : "N/A";
    const archiveLabel =
      data.canceled_epoch && !data.completion_epoch
        ? "Canceled / Archived"
        : "Archived / Completed";
    timestampHtml = (
      <p className="archive-timestamp-badge">
        {archiveLabel}: {fullDateStr}
      </p>
    );
  } else if (data.completion_timestamp) {
    timestampHtml = (
      <p className="timestamp-badge">Completed at: {data.completion_timestamp}</p>
    );
  } else if (data.canceled_epoch) {
    const cancelTimeStr = new Date(data.canceled_epoch).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    timestampHtml = (
      <p className="archive-timestamp-badge" style={{ color: "#fde047" }}>
        Canceled at: {cancelTimeStr}
      </p>
    );
  }

  return (
    <div className={cardClass}>
      <div
        className="delivery-summary-row"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="delivery-summary-info">
          <h3>{data.customer}</h3>
          <span className={`type-badge-pill ${typePillClass}`}>
            {data.isArchived ? "Archived" : entryTypeText}
          </span>
          {!isPickup && data.invoice !== "N/A" && (
            <span className="invoice-tag">#{data.invoice}</span>
          )}
          {statusPill}
        </div>
      </div>
      <div className="delivery-details">
        <p>
          Type: <strong>{entryTypeText}</strong> | Window: {data.status.toUpperCase()} Shift
        </p>
        {data.zone && <p>Zone: {data.zone}</p>}
        {data.store && (
          <p>
            Dealership Store: <strong>{data.store}</strong>
          </p>
        )}
        {timestampHtml}
        {data.image_url && (
          <div style={{ marginTop: "0.4rem" }}>
            <p style={{ fontSize: "calc(var(--font-size-base)*0.9)", color: "var(--text-muted)" }}>
              Attachment / Document:
            </p>
            <img
              src={data.image_url}
              className="card-invoice-thumb"
              alt="Attachment"
            />
          </div>
        )}
        {data.signature_url && (
          <>
            <p style={{ marginTop: "0.4rem", fontSize: "calc(var(--font-size-base)*0.9)", color: "var(--text-muted)" }}>
              Receiver Signature:
            </p>
            <img
              src={data.signature_url}
              className="card-signature-thumb"
              alt="Receiver Signature"
            />
          </>
        )}
        <div className="card-actions-row">
          {!data.completion_timestamp && !data.isArchived && !isCanceled && isDriver && (
            <button className="btn-success-action" onClick={(e) => { e.stopPropagation(); onMarkCompleted(); }}>
              Mark Completed
            </button>
          )}
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
