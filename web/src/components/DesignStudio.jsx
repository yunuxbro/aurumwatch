"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { lkr } from "@/lib/format";
import { importCadFile } from "@/lib/cad-import";
import { UNIT_TO_MM } from "@/lib/cad-geometry";
import { daysSinceDate } from "@/lib/date";
import { createDesignReport } from "@/lib/design-report";
import { accountRequest } from "@/lib/account-api";
import ModelViewer from "./ModelViewer";

const DESIGNS = [
  { id: "ring", name: "Gemstone ring", image: "/jewelry/ring.svg", description: "Sculpted band with a raised stone setting." },
  { id: "pendant", name: "Heart pendant", image: "/jewelry/pendant.svg", description: "Polished pendant with a light-catching centre stone." },
  { id: "bangle", name: "Classic bangle", image: "/jewelry/bangle.svg", description: "Rounded bangle with a minimal stone detail." },
];

const KARATS = [18, 22, 24];
const DENSITY_BY_KARAT = { 18: 15.58, 22: 17.65, 24: 19.32 };
const LOCAL_QUOTE_MAX_AGE_DAYS = 7;

function NumberField({
  id, label, value, onChange, min = 0, max, step = 1, suffix, allowEmpty = false,
}) {
  return (
    <label className="studio-field" htmlFor={id}>
      <span>{label}</span>
      <span className="studio-input-wrap">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => {
            const rawValue = event.target.value;
            if (allowEmpty && rawValue === "") {
              onChange("");
              return;
            }
            const numericValue = Number(rawValue);
            onChange(Number.isFinite(numericValue)
              ? Math.max(min, Math.min(max ?? Infinity, numericValue))
              : min);
          }}
        />
        {suffix && <span className="studio-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export default function DesignStudio({
  marketReference,
  marketHistory = [],
  today,
}) {
  const previewRef = useRef(null);
  const [designId, setDesignId] = useState("ring");
  const [karat, setKarat] = useState(22);
  const [quantity, setQuantity] = useState(1);
  const [grossWeight, setGrossWeight] = useState(5);
  const [stoneWeight, setStoneWeight] = useState(0.25);
  const [localQuotePrice, setLocalQuotePrice] = useState("");
  const [localQuoteDate, setLocalQuoteDate] = useState(today);
  const [localQuoteKarat, setLocalQuoteKarat] = useState(22);
  const [localQuoteConfirmed, setLocalQuoteConfirmed] = useState(false);
  const [makingCharge, setMakingCharge] = useState(5000);
  const [stoneCost, setStoneCost] = useState(3500);
  const [budget, setBudget] = useState(1_000_000);
  const [modelUnit, setModelUnit] = useState("mm");
  const [alloyDensity, setAlloyDensity] = useState(DENSITY_BY_KARAT[22]);
  const [cadModel, setCadModel] = useState(null);
  const [cadFile, setCadFile] = useState(null);
  const [cadFileName, setCadFileName] = useState("");
  const [cadImportError, setCadImportError] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [includedPartIds, setIncludedPartIds] = useState(() => new Set());
  const [reportStatus, setReportStatus] = useState("");

  const design = DESIGNS.find((item) => item.id === designId) || DESIGNS[0];
  const selectedParts = useMemo(
    () => cadModel?.parts.filter((part) => part.closed && includedPartIds.has(part.id)) || [],
    [cadModel, includedPartIds],
  );
  const selectedVolumeMm3 = selectedParts.reduce((total, part) => total + part.volumeMm3, 0);
  const hasCadWeight = Boolean(cadModel && !cadModel.isDrawing && selectedParts.length > 0);
  const cadGoldWeightPerPiece = selectedVolumeMm3 / 1000 * alloyDensity;
  const goldWeightPerPiece = hasCadWeight
    ? cadGoldWeightPerPiece
    : Math.max(0, grossWeight - stoneWeight);
  const totalWeightPerPiece = hasCadWeight
    ? goldWeightPerPiece + stoneWeight
    : grossWeight;
  const fineGoldPerPiece = goldWeightPerPiece * karat / 24;
  const goldWeightForOrder = goldWeightPerPiece * quantity;
  const fineGoldForOrder = fineGoldPerPiece * quantity;
  const additionalCostPerPiece = makingCharge + stoneCost;
  const marketIsCurrent = marketReference?.status === "current";
  const marketGoldPerFineGram = marketIsCurrent
    ? marketReference.lkr_per_gram_24k
    : null;
  const marketMetalPerPiece = marketGoldPerFineGram == null
    ? null
    : fineGoldPerPiece * marketGoldPerFineGram;
  const marketEstimatePerPiece = marketMetalPerPiece == null
    ? null
    : marketMetalPerPiece + additionalCostPerPiece;
  const localPrice = Number(localQuotePrice);
  const localQuoteAgeDays = daysSinceDate(localQuoteDate, today);
  const localQuoteIsCurrent = localQuoteConfirmed &&
    Number.isFinite(localPrice) &&
    localPrice > 0 &&
    localQuoteAgeDays != null &&
    localQuoteAgeDays >= 0 &&
    localQuoteAgeDays <= LOCAL_QUOTE_MAX_AGE_DAYS;
  const localMetalPerPiece = localQuoteIsCurrent
    ? goldWeightPerPiece * localPrice / 8 * karat / localQuoteKarat
    : null;
  const localEstimatePerPiece = localMetalPerPiece == null
    ? null
    : localMetalPerPiece + additionalCostPerPiece;
  const marketAffordablePieces = marketEstimatePerPiece > 0
    ? Math.floor(budget / marketEstimatePerPiece)
    : null;
  const localAffordablePieces = localEstimatePerPiece > 0
    ? Math.floor(budget / localEstimatePerPiece)
    : null;
  const partSet = includedPartIds;

  function capturePreview() {
    const source = previewRef.current?.querySelector(".model-viewer canvas, .jewel-art");
    if (!source) throw new Error("The jewelry preview is not ready to capture.");

    const imageWidth = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
    const imageHeight = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
    if (!imageWidth || !imageHeight) {
      throw new Error("The jewelry preview image is not ready yet.");
    }

    const canvas = document.createElement("canvas");
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the jewelry preview for the report.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, imageWidth, imageHeight);
    context.drawImage(source, 0, 0, imageWidth, imageHeight);
    return canvas.toDataURL("image/png");
  }

  async function downloadReport() {
    setReportStatus("");
    if (!marketIsCurrent || !marketReference) {
      setReportStatus("A current market reference is required to create this estimate report.");
      return;
    }

    try {
      const reportDesignName = cadFileName || design.name;
      const report = createDesignReport({
        previewImage: capturePreview(),
        designName: reportDesignName,
        cadFileName,
        quantity,
        karat,
        goldWeightPerPiece,
        goldWeightForOrder,
        fineGoldForOrder,
        alloyDensity,
        marketReference,
        marketMetalPerPiece,
        makingCharge,
        stoneCost,
        totalPerPiece: marketEstimatePerPiece,
        budget,
        affordablePieces: marketAffordablePieces,
        localEstimatePerPiece,
        localQuoteIsCurrent,
        localQuoteDate,
        localQuotePrice: localPrice,
        marketHistory,
        generatedDate: today,
      });
      const slug = (cadFileName || design.name).toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const reportName = `aurumwatch-${slug}-estimate.pdf`;
      const reportBlob = report.output("blob");
      report.save(reportName);
      setReportStatus("PDF report downloaded.");

      const authResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (authResponse.status === 401) {
        setReportStatus("PDF report downloaded. Sign in to save reports to your account.");
        return;
      }
      if (!authResponse.ok) {
        const body = await authResponse.json().catch(() => ({}));
        setReportStatus(`PDF downloaded, but account status could not be checked: ${body.error || authResponse.statusText}`);
        return;
      }
      const form = new FormData();
      form.set("file", reportBlob, reportName);
      form.set("summary", JSON.stringify({
        design: reportDesignName,
        cad_file: cadFileName || null,
        karat,
        quantity,
        gold_weight_g: goldWeightForOrder,
        estimated_total_lkr: marketEstimatePerPiece * quantity,
        budget_lkr: budget,
        gold_date: marketReference.gold_date,
        fx_date: marketReference.fx_date,
      }));
      try {
        await accountRequest("/api/account/reports", { method: "POST", body: form });
        setReportStatus("PDF report downloaded and saved to your private account.");
      } catch (error) {
        setReportStatus(`PDF downloaded, but account storage failed: ${error instanceof Error ? error.message : "request failed"}`);
      }
    } catch (error) {
      console.error("Could not generate the design estimate PDF:", error);
      setReportStatus(error instanceof Error
        ? `PDF report or account save failed: ${error.message}`
        : "PDF report or account save failed.");
    }
  }

  async function saveDesignToAccount() {
    setReportStatus("");
    try {
      const authResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (authResponse.status === 401) {
        setReportStatus("Sign in to save this design to your account.");
        return;
      }
      if (!authResponse.ok) {
        const body = await authResponse.json().catch(() => ({}));
        throw new Error(body.error || "Could not check account sign-in.");
      }
      const form = new FormData();
      form.set("name", cadFileName || design.name);
      form.set("karat", String(karat));
      form.set("gold_weight_g", String(goldWeightPerPiece));
      form.set("budget_lkr", String(budget));
      form.set("notes", `Estimated ${quantity} piece(s); market basis dated ${marketReference?.gold_date || "unavailable"}.`);
      form.set("estimate", JSON.stringify({
        quantity,
        gold_weight_order_g: goldWeightForOrder,
        estimated_total_lkr: marketEstimatePerPiece == null ? null : marketEstimatePerPiece * quantity,
        market_gold_date: marketReference?.gold_date || null,
        market_fx_date: marketReference?.fx_date || null,
      }));
      if (cadFile) {
        if (cadFile.size > 50 * 1024 * 1024) {
          setReportStatus("The CAD file exceeds the 50 MB account storage limit.");
          return;
        }
        form.set("model", cadFile);
      }
      await accountRequest("/api/account/projects", { method: "POST", body: form });
      setReportStatus("Design and estimate saved to your private account.");
    } catch (error) {
      console.error("Could not save the jewelry design to the account:", error);
      setReportStatus(error instanceof Error ? error.message : "Could not save the design to your account.");
    }
  }

  async function importFile(file, unit) {
    setIsImporting(true);
    setCadImportError("");
    try {
      const imported = await importCadFile(file, unit);
      setCadModel(imported);
      setCadFile(file);
      setCadFileName(file.name);
      setIncludedPartIds(new Set(imported.parts.filter((part) => part.closed).map((part) => part.id)));
    } catch (error) {
      console.error("Could not import the selected jewelry design:", error);
      setCadImportError(error instanceof Error ? error.message : "The file could not be imported.");
    } finally {
      setIsImporting(false);
    }
  }

  function updateUnit(event) {
    const nextUnit = event.target.value;
    setModelUnit(nextUnit);
    if (cadFileName) {
      setCadModel(null);
      setCadFile(null);
      setCadFileName("");
      setIncludedPartIds(new Set());
      setCadImportError("Units changed. Re-upload the file so its estimated volume uses the selected units.");
    }
  }

  return (
    <div className="studio-layout">
      <section ref={previewRef} className="card studio-preview" aria-label={`${cadFileName || design.name} design preview`}>
        <div className="studio-preview-head">
          <div>
            <p className="page-kicker">{cadFileName ? "Uploaded CAD preview" : "Design preview"}</p>
            <h2>{cadFileName || design.name}</h2>
          </div>
          <span className="badge badge-gold">{cadFileName ? "Local file" : "Illustrative model"}</span>
        </div>
        <div className={`jewel-stage${cadModel ? " cad-stage" : ""}`}>
          {cadModel ? (
            <ModelViewer key={cadFileName} model={cadModel.root} includedPartIds={partSet} />
          ) : (
            <>
              <div className="jewel-orbit jewel-orbit-one" />
              <div className="jewel-orbit jewel-orbit-two" />
              <Image
                className="jewel-art"
                src={design.image}
                alt={`Illustration of a gold ${design.name.toLowerCase()}`}
                width={480}
                height={360}
                loading="eager"
                style={{ width: "min(94%, 410px)", height: "auto" }}
              />
            </>
          )}
        </div>
        {!cadFileName && <p className="studio-description">{design.description}</p>}
        {!cadFileName && (
          <div className="design-picker" role="group" aria-label="Choose jewelry design">
            {DESIGNS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`design-option${designId === item.id ? " selected" : ""}`}
                aria-pressed={designId === item.id}
                onClick={() => setDesignId(item.id)}
              >
                <span
                  className="design-option-art"
                  style={{ position: "relative", display: "block", width: 54, height: 42 }}
                >
                  <Image src={item.image} alt="" fill sizes="54px" loading="eager" />
                </span>
                <span>{item.name}</span>
              </button>
            ))}
          </div>
        )}
        {cadModel?.parts.length > 0 && (
          <fieldset className="cad-part-list">
            <legend>Include closed model parts as gold</legend>
            {cadModel.parts.map((part) => (
              <label className="cad-part-option" key={part.id}>
                <input
                  type="checkbox"
                  checked={partSet.has(part.id)}
                  disabled={!part.closed}
                  onChange={(event) => {
                    setIncludedPartIds((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(part.id);
                      else next.delete(part.id);
                      return next;
                    });
                  }}
                />
                <span>{part.name}</span>
                <strong>
                  {part.closed
                    ? `${(part.volumeMm3 / 1000).toFixed(5)} cm³`
                    : "Open mesh"}
                </strong>
              </label>
            ))}
          </fieldset>
        )}
        {cadModel?.isDrawing && <p className="studio-source-note">{cadModel.note}</p>}
        {cadModel && !cadModel.isDrawing && cadModel.parts.length === 0 && (
          <p className="studio-source-note">
            This file can be previewed, but it contains no closed mesh parts for volume-based gold estimation.
            Enter a verified weight below or export a closed mesh from your CAD software.
          </p>
        )}
        {cadModel && !cadModel.isDrawing && cadModel.parts.some((part) => !part.closed) && (
          <p className="studio-source-note">
            Open or non-manifold parts are excluded from the gold-volume estimate. Repair them in CAD or enter their verified weight manually.
          </p>
        )}
        <p className="studio-disclaimer">
          {cadFileName
            ? "Files are parsed locally in this browser and are not uploaded. Confirm units, material, alloy density, stone bodies, and final weights with your goldsmith."
            : "Visuals are concept illustrations, not manufacturing drawings. Upload a supported CAD model for a volume-based estimate."}
        </p>
      </section>

      <section className="card panel studio-controls">
        <div className="section-header">
          <div>
            <h2 className="section-title">Build your estimate</h2>
            <p className="section-sub">Upload a design, set your budget, and confirm the pricing assumptions.</p>
          </div>
        </div>

        <div className="studio-control-stack">
          <div className="cad-upload-grid">
            <label className="studio-field" htmlFor="cad-file">
              <span>Jewellery design file</span>
              <input
                id="cad-file"
                type="file"
                accept=".stl,.obj,.3mf,.glb,.gltf,.3dm,.step,.stp,.iges,.igs,.dxf"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importFile(file, modelUnit);
                  event.target.value = "";
                }}
              />
            </label>
            <label className="studio-field" htmlFor="model-unit">
              <span>Units for STL / OBJ / 3MF / 3DM</span>
              <select id="model-unit" value={modelUnit} onChange={updateUnit}>
                <option value="mm">Millimetres</option>
                <option value="cm">Centimetres</option>
                <option value="m">Metres</option>
                <option value="in">Inches</option>
              </select>
            </label>
          </div>
          <p className="cad-format-note">
            Supported: STL, OBJ, 3MF, GLB/glTF, Rhino 3DM meshes, STEP/STP, IGES/IGS, and DXF. Choose the correct file units;
            glTF and STEP/IGES use their format units. DXF is a 2D preview only. Maximum file size: 50 MB.
          </p>
          {isImporting && <p className="cad-import-status" role="status">Reading design locally…</p>}
          {cadImportError && <p className="cad-import-error" role="alert">{cadImportError}</p>}
          {cadFileName && (
            <button type="button" className="cad-clear-button" onClick={() => {
              setCadModel(null);
              setCadFile(null);
              setCadFileName("");
              setIncludedPartIds(new Set());
              setCadImportError("");
            }}>
              Remove uploaded design
            </button>
          )}

          <fieldset className="studio-group">
            <legend>Gold purity</legend>
            <div className="studio-karats">
              {KARATS.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`studio-choice${karat === value ? " selected" : ""}`}
                  aria-pressed={karat === value}
                  onClick={() => {
                    setKarat(value);
                    setAlloyDensity(DENSITY_BY_KARAT[value]);
                  }}
                >
                  {value}K <span>{(value / 24 * 100).toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="studio-field-grid">
            <NumberField id="design-quantity" label="Pieces" value={quantity} min={1} step={1} onChange={(value) => setQuantity(Math.round(value))} />
            {hasCadWeight ? (
              <div className="studio-field cad-derived-weight">
                <span>Model-derived gold / piece</span>
                <strong>{cadGoldWeightPerPiece.toFixed(3)} g</strong>
              </div>
            ) : (
              <NumberField
                id="gross-weight"
                label="Total piece weight"
                value={grossWeight}
                min={0.1}
                step={0.1}
                suffix="g"
                onChange={(value) => {
                  setGrossWeight(value);
                  setStoneWeight((current) => Math.min(current, value));
                }}
              />
            )}
            {hasCadWeight ? (
              <NumberField id="stone-weight" label="Stone / non-gold weight" value={stoneWeight} min={0} step={0.05} suffix="g" onChange={setStoneWeight} />
            ) : (
              <NumberField id="stone-weight" label="Stone / non-gold weight" value={stoneWeight} min={0} max={grossWeight} step={0.05} suffix="g" onChange={setStoneWeight} />
            )}
          </div>

          {hasCadWeight && (
            <NumberField
              id="alloy-density"
              label={`Estimated ${karat}K alloy density`}
              value={alloyDensity}
              min={1}
              max={25}
              step={0.01}
              suffix="g/cm³"
              onChange={setAlloyDensity}
            />
          )}
          {hasCadWeight && (
            <p className="cad-format-note">
              Density defaults are approximations: 18K 15.58, 22K 17.65, and 24K 19.32 g/cm³. Use your alloy supplier&apos;s value for better weight accuracy.
            </p>
          )}

          <fieldset className="studio-group studio-price-group">
            <legend>Daily market estimate</legend>
            {marketIsCurrent ? (
              <>
                <div className="market-reference-grid">
                  <div><span>World gold proxy</span><strong>US$ {marketReference.gold_usd_per_oz.toLocaleString("en-US", { maximumFractionDigits: 2 })} / troy oz</strong><small>{marketReference.gold_date} · {marketReference.gold_source}</small></div>
                  <div><span>USD / LKR</span><strong>{marketReference.usd_lkr.toFixed(2)}</strong><small>{marketReference.fx_date} · {marketReference.fx_source}</small></div>
                  <div><span>24K · LKR / g</span><strong>{lkr(marketReference.lkr_per_gram_24k)}</strong><small>Market benchmark · {marketReference.gold_date}</small></div>
                  <div><span>22K · LKR / 8 g</span><strong>{lkr(marketReference.lkr_per_8g_22k)}</strong><small>Indicative local baseline; excludes shop premiums</small></div>
                  <div><span>18K · LKR / 8 g</span><strong>{lkr(marketReference.lkr_per_8g_18k)}</strong><small>Spot + FX conversion; excludes shop premiums</small></div>
                </div>
              </>
            ) : (
              <p className="cad-import-error" role="status">
                The gold or exchange-rate feed is stale or unavailable. A live market estimate is withheld until both feeds are current.
              </p>
            )}
          </fieldset>

          <fieldset className="studio-group studio-price-group">
            <legend>Local shop comparison (optional)</legend>
            <p className="studio-source-note">
              The automatic baseline uses current world gold and USD/LKR data. It is not a verified Pettah shop price; enter a recent quote only when comparing a specific shop.
            </p>
            <div className="studio-field-grid">
              <NumberField
                id="shop-quote"
                label={`Verified shop quote per 8 g (${localQuoteKarat}K)`}
                value={localQuotePrice}
                min={0}
                step={500}
                allowEmpty
                onChange={(value) => {
                  setLocalQuotePrice(value);
                  setLocalQuoteConfirmed(false);
                }}
              />
              <label className="studio-field" htmlFor="local-quote-karat">
                <span>Quote purity</span>
                <select id="local-quote-karat" value={localQuoteKarat} onChange={(event) => {
                  setLocalQuoteKarat(Number(event.target.value));
                  setLocalQuoteConfirmed(false);
                }}>
                  {[18, 22, 24].map((value) => <option key={value} value={value}>{value}K</option>)}
                </select>
              </label>
              <label className="studio-field" htmlFor="local-quote-date">
                <span>Date verified</span>
                <input id="local-quote-date" type="date" value={localQuoteDate} onChange={(event) => {
                  setLocalQuoteDate(event.target.value);
                  setLocalQuoteConfirmed(false);
                }} />
              </label>
              <NumberField id="making-charge" label="Making charge / piece" value={makingCharge} min={0} step={500} suffix="LKR" onChange={setMakingCharge} />
              <NumberField id="stone-cost" label="Stone cost / piece" value={stoneCost} min={0} step={500} suffix="LKR" onChange={setStoneCost} />
            </div>
            <label className="quote-confirmation">
              <input
                type="checkbox"
                checked={localQuoteConfirmed}
                onChange={(event) => setLocalQuoteConfirmed(event.target.checked)}
              />
              <span>I verified this quote with a shop on the selected date.</span>
            </label>
            {localQuoteConfirmed && localQuoteAgeDays > LOCAL_QUOTE_MAX_AGE_DAYS && (
              <p className="studio-source-note">
                This shop quote is {localQuoteAgeDays} days old and is excluded from current budget estimates. Reconfirm a price from the last 7 days.
              </p>
            )}
          </fieldset>

          <fieldset className="studio-group budget-group">
            <legend>Budget allocation</legend>
            <NumberField id="design-budget" label="Available budget" value={budget} min={0} step={10000} suffix="LKR" onChange={setBudget} />
            <p className="cad-format-note">
              The market estimate allocates gold metal, making, and stone costs separately; affordability is based on the entered budget.
            </p>
          </fieldset>

          <div className="studio-results" aria-live="polite">
            <div className="studio-results-heading">
              <div>
                <p className="page-kicker">Order summary</p>
                <h3>{quantity} {quantity === 1 ? "piece" : "pieces"} · {karat}K gold</h3>
              </div>
              <div className="studio-order-total">
                <span>Market estimate · total</span>
                <strong>{marketEstimatePerPiece == null ? "Unavailable" : lkr(marketEstimatePerPiece * quantity)}</strong>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={downloadReport}
              disabled={!marketIsCurrent}
              style={{ marginTop: ".8rem" }}
            >
              Download PDF report
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={saveDesignToAccount}
              style={{ marginTop: ".8rem", marginLeft: ".5rem" }}
            >
              Save design to account
            </button>
            {reportStatus && <p className="studio-source-note" role="status">{reportStatus}</p>}
            <div className="studio-result-grid">
              <div><span>Gold allocation · order</span><strong>{goldWeightForOrder.toFixed(2)} g</strong></div>
              <div><span>Fine gold · order</span><strong>{fineGoldForOrder.toFixed(2)} g</strong></div>
              <div><span>Gold metal allocation · order</span><strong>{lkr(marketMetalPerPiece == null ? null : marketMetalPerPiece * quantity)}</strong></div>
              <div><span>Making charges · order</span><strong>{lkr(makingCharge * quantity)}</strong></div>
              <div><span>Stone costs · order</span><strong>{lkr(stoneCost * quantity)}</strong></div>
              <div><span>Total weight · per piece</span><strong>{totalWeightPerPiece.toFixed(2)} g</strong></div>
              <div><span>Budget covers · market basis</span><strong>{marketAffordablePieces == null ? "Unavailable" : `${marketAffordablePieces} ${marketAffordablePieces === 1 ? "piece" : "pieces"}`}</strong></div>
              <div><span>Remaining after this order</span><strong>{marketEstimatePerPiece == null ? "Unavailable" : lkr(budget - marketEstimatePerPiece * quantity)}</strong></div>
              <div>
                <span>{localEstimatePerPiece == null ? `Indicative ${karat}K baseline · per 8 g` : "Verified shop comparison · order"}</span>
                <strong>
                  {localEstimatePerPiece == null
                    ? lkr(marketIsCurrent ? marketReference.lkr_per_gram_24k * 8 * karat / 24 : null)
                    : lkr(localEstimatePerPiece * quantity)}
                </strong>
              </div>
              {localEstimatePerPiece != null && (
                <div><span>Budget covers · local quote</span><strong>{localAffordablePieces} {localAffordablePieces === 1 ? "piece" : "pieces"}</strong></div>
              )}
            </div>
          </div>
          <p className="studio-disclaimer">
            The market value is a daily gold-futures and FX proxy, not a Pettah retail offer. CAD volume only yields reliable metal weight for closed, correctly scaled models; density, alloy, stones, casting loss, workmanship, taxes, and shop pricing change final weights and costs.
          </p>
        </div>
      </section>
    </div>
  );
}
