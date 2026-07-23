const firestore = require("./firestore");

async function recordSale(id, sale) {
  if (!firestore.configured()) {
    throw new Error("Firebase no configurado");
  }
  const documentId = String(id).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
  const existing = await firestore.getDocument("chongseb_sales", documentId);
  if (existing) return { duplicate: true, sale: existing };
  const saved = await firestore.setDocument("chongseb_sales", documentId, {
    ...sale,
    completedAt: new Date(),
  });
  const referralCode = String(sale.referralCode || "");
  if (referralCode) {
    const referral = await firestore.getDocument(
      "chongseb_referrals",
      referralCode,
    );
    if (referral) {
      await firestore.setDocument("chongseb_referrals", referralCode, {
        ownerUserId: referral.ownerUserId,
        visits: Number(referral.visits || 0),
        conversions: Number(referral.conversions || 0) + 1,
        createdAt: referral.createdAt || new Date(),
        updatedAt: new Date(),
      });
    }
  }
  return { duplicate: false, sale: saved };
}

module.exports = { recordSale };
