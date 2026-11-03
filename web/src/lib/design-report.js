import { jsPDF } from "jspdf";

const money = (value) => (
  Number.isFinite(value)
    ? `Rs ${Math.round(value).toLocaleString("en-US")}`
    : "Unavailable"
);

function addPriceChart(doc, history) {
  const rows = history
    .filter((row) => Number.isFinite(Number(row.local_equiv)))
    .slice(-30);
  const x = 18;
  const y = 198;
  const width = 174;
  const height = 38;

  doc.setFontSize(10);
  doc.setTextColor(45, 50, 56);
  doc.text("Recent 22K benchmark history (LKR per 8 g)", x, 191);
  doc.setDrawColor(206, 211, 216);
  doc.rect(x, y, width, height);

  if (rows.length < 2) {
    doc.setFontSize(8);
    doc.setTextColor(100, 105, 110);
    doc.text("Not enough dated observations for a trend chart.", x + 4, y + 22);
    return;
  }

  const prices = rows.map((row) => Number(row.local_equiv));
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const span = Math.max(maximum - minimum, 1);
  const plotX = x + 8;
  const plotY = y + 6;
  const plotWidth = width - 16;
  const plotHeight = height - 14;

  doc.setFontSize(7);
  doc.setTextColor(100, 105, 110);
  doc.text(money(maximum), x + 1, y + 5);
  doc.text(money(minimum), x + 1, y + height - 1);
  doc.text(rows[0].date, plotX, y + height - 1);
  doc.text(rows.at(-1).date, x + width - 8, y + height - 1, { align: "right" });
  doc.setDrawColor(163, 126, 67);
  doc.setLineWidth(0.7);

  for (let index = 1; index < rows.length; index += 1) {
    const previousX = plotX + (index - 1) / (rows.length - 1) * plotWidth;
    const currentX = plotX + index / (rows.length - 1) * plotWidth;
    const previousY = plotY + (1 - (prices[index - 1] - minimum) / span) * plotHeight;
    const currentY = plotY + (1 - (prices[index] - minimum) / span) * plotHeight;
    doc.line(previousX, previousY, currentX, currentY);
  }
}

export function createDesignReport({
  previewImage,
  designName,
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
  totalPerPiece,
  budget,
  affordablePieces,
  localEstimatePerPiece,
  localQuoteIsCurrent,
  localQuoteDate,
  localQuotePrice,
  marketHistory = [],
  generatedDate,
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const total = totalPerPiece * quantity;
  const lineHeight = 7;

  doc.setProperties({
    title: `AurumWatch design estimate - ${designName}`,
    subject: "Jewellery gold allocation and market estimate",
    creator: "AurumWatch LK",
  });
  doc.setTextColor(38, 43, 48);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("AurumWatch LK", 14, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(91, 98, 104);
  doc.text("JEWELLERY DESIGN COST REPORT - PRO-FORMA ESTIMATE", 14, 24);
  doc.text(`Generated ${generatedDate}`, 196, 24, { align: "right" });

  if (previewImage) {
    doc.setFillColor(248, 247, 244);
    doc.roundedRect(14, 32, 68, 51, 2, 2, "F");
    doc.addImage(previewImage, "PNG", 17, 35, 62, 45, undefined, "FAST");
  }

  const detailX = 91;
  let detailY = 37;
  const details = [
    ["Design", designName],
    ["Source file", cadFileName || "Illustrative design template"],
    ["Order", `${quantity} ${quantity === 1 ? "piece" : "pieces"} - ${karat}K`],
    ["Gold per piece", `${goldWeightPerPiece.toFixed(3)} g`],
    ["Gold in order", `${goldWeightForOrder.toFixed(3)} g`],
    ["Fine gold in order", `${fineGoldForOrder.toFixed(3)} g`],
  ];
  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(91, 98, 104);
    doc.text(`${label}:`, detailX, detailY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(38, 43, 48);
    doc.text(String(value).slice(0, 46), detailX + 30, detailY);
    detailY += lineHeight;
  });

  doc.setDrawColor(221, 223, 225);
  doc.line(14, 90, 196, 90);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(38, 43, 48);
  doc.text("Gold market reference", 14, 98);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 76, 82);
  doc.text(
    `World gold: US$ ${Number(marketReference.gold_usd_per_oz).toLocaleString("en-US", { maximumFractionDigits: 2 })}/oz (${marketReference.gold_date}, ${marketReference.gold_source})`,
    14,
    105,
  );
  doc.text(
    `USD/LKR: ${Number(marketReference.usd_lkr).toFixed(4)} (${marketReference.fx_date}, ${marketReference.fx_source})`,
    14,
    111,
  );
  doc.text(
    `24K: ${money(marketReference.lkr_per_gram_24k)}/g  |  22K: ${money(marketReference.lkr_per_8g_22k)}/8 g  |  18K: ${money(marketReference.lkr_per_8g_18k)}/8 g`,
    14,
    117,
  );
  doc.text(
    `Alloy density used: ${alloyDensity.toFixed(2)} g/cm3. Gold-only estimate: ${money(marketMetalPerPiece)} per piece.`,
    14,
    123,
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(38, 43, 48);
  doc.text("Cost allocation", 14, 136);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const costRows = [
    ["Gold metal", money(marketMetalPerPiece * quantity)],
    ["Making charges", money(makingCharge * quantity)],
    ["Stone costs", money(stoneCost * quantity)],
    ["Estimated order total", money(total)],
    ["Available budget", money(budget)],
    ["Estimated remaining budget", money(budget - total)],
    ["Budget capacity", `${affordablePieces} ${affordablePieces === 1 ? "piece" : "pieces"}`],
  ];
  costRows.forEach(([label, value], index) => {
    const rowY = 143 + index * 6;
    doc.setTextColor(70, 76, 82);
    doc.text(label, 14, rowY);
    doc.setTextColor(38, 43, 48);
    doc.text(value, 196, rowY, { align: "right" });
  });

  addPriceChart(doc, marketHistory);

  const quoteText = localQuoteIsCurrent
    ? `User-verified shop comparison: ${money(localQuotePrice)} per 8 g on ${localQuoteDate}; estimated order cost ${money(localEstimatePerPiece * quantity)}.`
    : "Pettah retail prices are not available from a dependable live feed. The market benchmark is an estimate, not a shop quote.";
  doc.setFontSize(8);
  doc.setTextColor(70, 76, 82);
  const quoteLines = doc.splitTextToSize(quoteText, 182);
  doc.text(quoteLines, 14, 242);
  const disclaimerY = 242 + quoteLines.length * 4.5 + 2;
  const disclaimer = "Planning estimate only - not an invoice, tax document, casting certificate, or guaranteed offer. The market basis converts a daily gold futures proxy and USD/LKR reference; shop premiums, taxes, fees, alloy variation, casting loss, and workmanship may change the final price. CAD weight depends on supported closed mesh geometry and the selected unit and density.";
  doc.setFontSize(7.5);
  doc.setTextColor(100, 105, 110);
  doc.text(doc.splitTextToSize(disclaimer, 182), 14, disclaimerY);
  return doc;
}
