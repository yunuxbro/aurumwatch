export default function Banner({ risk }) {
  if (!risk || risk.status === "ok") return null;
  return (
    <div className="alert alert-warning" style={{ marginBottom: "0.5rem" }}>
      <span className="led led-amber" style={{ marginTop: "3px" }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 700, marginBottom: "0.2rem", fontSize: "0.85rem" }}>
          Current market data is unavailable
        </p>
        <p style={{ fontSize: "0.8rem", margin: 0, color: "var(--warning)" }}>
          {risk.notes?.length ? risk.notes.join(" ") : "Automatic safety rule enforced."}
        </p>
        <p style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: "var(--text-secondary)" }}>
          <strong>Action:</strong> Check Data health and run the scheduled market refresh. Historical Pettah quotes are not used as current prices.
        </p>
      </div>
    </div>
  );
}
