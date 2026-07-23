const firestore = require("./_lib/firestore");
const { json, method } = require("./_lib/http");

exports.handler = async (event) => {
  const bad = method(event, "GET");
  if (bad) return bad;
  if (!firestore.configured()) {
    return json(503, { error: "Firebase no configurado" });
  }
  try {
    const sales = await firestore.listDocuments("chongseb_sales", 200);
    const donors = sales
      .filter(
        (sale) =>
          sale.serviceKey === "donation" &&
          sale.paymentStatus === "paid" &&
          Number(sale.amountTotal) > 0,
      )
      .sort(
        (a, b) =>
          Date.parse(b.completedAt || 0) - Date.parse(a.completedAt || 0),
      )
      .slice(0, 20)
      .map((sale) => ({
        id: sale.id,
        name:
          sale.publicDonor && sale.donorName
            ? String(sale.donorName).slice(0, 60)
            : "Donador anónimo",
        amount: Number(sale.amountTotal),
        currency: String(sale.currency || "mxn").toUpperCase(),
        completedAt: sale.completedAt,
      }));
    return json(200, { donors });
  } catch {
    return json(502, { error: "No fue posible cargar donadores" });
  }
};
