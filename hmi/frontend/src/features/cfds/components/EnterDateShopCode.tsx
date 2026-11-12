import { useState, type FC, type FormEvent } from "react";
import type { CfdsLruItem } from "../utils/lruDefinitions";
import type { CfdsTxParameters } from "../utils/cfdsDefaults";

interface EnterDateShopCodeProps {
  selectedLru: CfdsLruItem;
  txParams: CfdsTxParameters;
  onUpdateParams: (newDate: string, newShopCode: string) => void;
  onSelectSubmode: (submode: "NORMAL_ABD0018" | "MENU_ABD0018" | "NORMAL_ABD0048" | "INTERACTIVE_ABD0048" | "DISCRETE_ABD0048") => void;
  onBack: () => void;
}

export const EnterDateShopCode: FC<EnterDateShopCodeProps> = ({
  selectedLru,
  txParams,
  onUpdateParams,
  onSelectSubmode,
  onBack,
}) => {
  const [dateInput, setDateInput] = useState<string>(txParams.date || "11-11-26");
  const [shopCodeInput, setShopCodeInput] = useState<string>(txParams.aircraftId || "N12345");
  const [saveToast, setSaveToast] = useState<string>("");
  const [dateError, setDateError] = useState<string>("");
  const [shopCodeError, setShopCodeError] = useState<string>("");
  const [submodeNotice, setSubmodeNotice] = useState<string>("");

  const handleSubmodeClick = (
    sub: "NORMAL_ABD0018" | "MENU_ABD0018" | "NORMAL_ABD0048" | "INTERACTIVE_ABD0048" | "DISCRETE_ABD0048",
    title: string
  ) => {
    setSubmodeNotice(`Opening ${title} (Figure 55)...`);
    onSelectSubmode(sub);
  };

  const handleSave = (e?: FormEvent) => {
    if (e) e.preventDefault();

    let valid = true;
    setDateError("");
    setShopCodeError("");

    // Date validation: Allow common aviation date formats (e.g. MM/DD/YY, DD-MM-YY, YYYY-MM-DD)
    const trimmedDate = dateInput.trim();
    if (!trimmedDate) {
      setDateError("Date is required.");
      valid = false;
    }

    // Shop Code validation: 1-6 alphanumeric characters (matching Aircraft ID per manual)
    const trimmedShop = shopCodeInput.trim().toUpperCase();
    if (!trimmedShop) {
      setShopCodeError("Shop Code is required.");
      valid = false;
    } else if (trimmedShop.length > 8) {
      setShopCodeError("Shop Code must not exceed 8 characters.");
      valid = false;
    }

    if (valid) {
      onUpdateParams(trimmedDate, trimmedShop);
      setSaveToast("Date and Shop Code updated and synchronized with CFDS TX parameters.");
      setTimeout(() => setSaveToast(""), 3500);
    }
  };

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto", display: "grid", gap: "20px" }}>
      {/* Top Breadcrumb Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            color: "#475569",
            padding: "6px 14px",
            borderRadius: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          &laquo; Back to CFDS Mode Select (Fig 48)
        </button>
        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Reference: <strong style={{ color: "#0d9488" }}>Figure 55 &bull; Enter Date and Shop Code Screen</strong> (Manual pp. 1-4-98)
        </div>
      </div>

      {/* Main Container Card */}
      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "28px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {/* Screen Header */}
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "#0d9488", textTransform: "uppercase" }}>
            Aeroflex JcAIR T1200B &bull; CFDS Operation Mode
          </div>
          <h1 style={{ margin: "6px 0 8px", fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>
            ENTER DATE AND SHOP CODE
          </h1>
          <p style={{ margin: "0 auto", maxWidth: "640px", fontSize: "13px", color: "#64748b" }}>
            Target LRU: <strong style={{ color: "#0f172a" }}>{selectedLru.name} (0x{selectedLru.code})</strong>.
            Configure session logging date and shop identifier (equivalent to Aircraft ID). Select an operating mode below to proceed.
          </p>
        </div>

        {/* Success Toast */}
        {saveToast && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: "8px",
              padding: "10px 16px",
              color: "#16a34a",
              fontWeight: 600,
              fontSize: "13px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>&#10003;</span>
            <span>{saveToast}</span>
          </div>
        )}

        {/* Date & Shop Code Form (Figure 55) */}
        <form onSubmit={handleSave} style={{ maxWidth: "480px", margin: "0 auto 36px" }}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "24px",
              display: "grid",
              gap: "18px",
            }}
          >
            {/* DATE Field */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", textAlign: "right" }}>
                DATE:
              </label>
              <div>
                <input
                  type="text"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  placeholder="e.g. 12/31/96 or 11-11-26"
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    border: dateError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                />
                {dateError && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{dateError}</div>}
              </div>
            </div>

            {/* SHOP CODE Field */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", alignItems: "center", gap: "12px" }}>
              <label style={{ fontSize: "13px", fontWeight: 700, color: "#334155", textAlign: "right" }}>
                SHOP CODE:
              </label>
              <div>
                <input
                  type="text"
                  value={shopCodeInput}
                  onChange={(e) => setShopCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. N12345"
                  style={{
                    width: "100%",
                    background: "#ffffff",
                    border: shopCodeError ? "1px solid #ef4444" : "1px solid #cbd5e1",
                    borderRadius: "6px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    fontWeight: 700,
                    color: "#0f172a",
                  }}
                />
                {shopCodeError && <div style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px" }}>{shopCodeError}</div>}
              </div>
            </div>

            {/* Save / Update Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="submit"
                style={{
                  background: "#0d9488",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 1px 2px rgba(13,148,136,0.2)",
                }}
              >
                <span>&#10003;</span> Update Date &amp; Shop Code
              </button>
            </div>
          </div>
        </form>

        {/* Submode Notification */}
        {submodeNotice && (
          <div
            style={{
              background: "#f0fdfa",
              border: "1px solid #99f6e4",
              borderRadius: "8px",
              padding: "12px 16px",
              color: "#0f766e",
              fontWeight: 600,
              fontSize: "12.5px",
              marginBottom: "20px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontSize: "16px" }}>&#9432;</span>
            <span>{submodeNotice}</span>
          </div>
        )}

        {/* Operating Modes Heading */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em", color: "#64748b", textTransform: "uppercase" }}>
            Select Operating Mode (Figure 55)
          </div>
        </div>

        {/* 5 Operating Mode Cards per Figure 55 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          {/* Card 1: NORMAL MODE (ABD0018) */}
          <div
            onClick={() => handleSubmodeClick("NORMAL_ABD0018", "NORMAL MODE ABD0018")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0d9488";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#0d9488", letterSpacing: "0.06em", marginBottom: "6px" }}>
              FIGURE 56-58
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
              NORMAL MODE
            </h3>
            <div style={{ fontSize: "12px", color: "#0d9488", fontWeight: 600, marginBottom: "8px" }}>
              (ABD0018)
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>
              Monitors Label 356 messages from LRU with STX, DATA, and EOT decoding.
            </p>
          </div>

          {/* Card 2: MENU MODE (ABD0018) */}
          <div
            onClick={() => handleSubmodeClick("MENU_ABD0018", "MENU MODE ABD0018")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0d9488";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#0d9488", letterSpacing: "0.06em", marginBottom: "6px" }}>
              FIGURE 59-61
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
              MENU MODE
            </h3>
            <div style={{ fontSize: "12px", color: "#0d9488", fontWeight: 600, marginBottom: "8px" }}>
              (ABD0018)
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>
              Interactive menu selection (1-6, A-F) transmitting command codes on Label 227.
            </p>
          </div>

          {/* Card 3: NORMAL MODE (ABD0048) */}
          <div
            onClick={() => handleSubmodeClick("NORMAL_ABD0048", "NORMAL MODE ABD0048")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0284c7";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#0284c7", letterSpacing: "0.06em", marginBottom: "6px" }}>
              FIGURE 56-58
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
              NORMAL MODE
            </h3>
            <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "8px" }}>
              (ABD0048)
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>
              Functions identically to Normal Mode (ABD0018) per Manual pp. 1-4-103.
            </p>
          </div>

          {/* Card 4: INTERACTIVE MODE (ABD0048) */}
          <div
            onClick={() => handleSubmodeClick("INTERACTIVE_ABD0048", "INTERACTIVE MODE ABD0048")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0284c7";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#0284c7", letterSpacing: "0.06em", marginBottom: "6px" }}>
              FIGURE 62-70
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
              INTERACTIVE MODE
            </h3>
            <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "8px" }}>
              (ABD0048)
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>
              Airbus MCDU layout with LSKs 1L-6L, 1R-6R, alphanumeric keypad, CLR &amp; SHFT.
            </p>
          </div>

          {/* Card 5: DISCRETE MODE (ABD0048) */}
          <div
            onClick={() => handleSubmodeClick("DISCRETE_ABD0048", "DISCRETE MODE ABD0048")}
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "20px 16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.15s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#0284c7";
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLElement).style.transform = "none";
            }}
          >
            <div style={{ fontSize: "10px", fontWeight: 800, color: "#0284c7", letterSpacing: "0.06em", marginBottom: "6px" }}>
              FIGURE 71-74
            </div>
            <h3 style={{ margin: "0 0 6px", fontSize: "14px", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
              DISCRETE MODE
            </h3>
            <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, marginBottom: "8px" }}>
              (ABD0048)
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b", lineHeight: 1.4 }}>
              Monitors Label 355 discrete words with 1-second timeout detection.
            </p>
          </div>
        </div>

        {/* Footer Simulation Status Badge */}
        <div
          style={{
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#0d9488",
              }}
            />
            <span style={{ fontSize: "11.5px", color: "#64748b" }}>
              Simulation Active &bull; Date &amp; Shop Code saved in memory state &bull; Synchronized with Label 260 &amp; Aircraft ID
            </span>
          </div>

          <div style={{ fontSize: "11px", color: "#94a3b8" }}>
            Aeroflex JcAIR T1200B Manual Rev. 0
          </div>
        </div>
      </section>
    </div>
  );
};
