const { reconcilePendingSupportPayments } = require("../services/supportPaymentService");

const DEFAULT_INTERVAL_MINUTES = Number(process.env.SUPPORT_PAYMENT_RECON_INTERVAL_MINUTES) || 30;

const startSupportPaymentReconciler = () => {
  const intervalMinutes = DEFAULT_INTERVAL_MINUTES > 0 ? DEFAULT_INTERVAL_MINUTES : 30;
  const intervalMs = intervalMinutes * 60 * 1000;

  const runReconciliation = async () => {
    try {
      const result = await reconcilePendingSupportPayments();
      if (result.processed > 0) {
        console.info("[SupportPayment] Reconciliation summary", result);
      }
    } catch (error) {
      console.error("[SupportPayment] Reconciliation job error", {
        message: error.message,
        stack: error.stack
      });
    }
  };

  // Initial run after server boot to catch stragglers
  setTimeout(runReconciliation, 5 * 60 * 1000);

  setInterval(runReconciliation, intervalMs);

  console.log(
    `[SupportPayment] Reconciliation job scheduled every ${intervalMinutes} minute(s)`
  );
};

module.exports = {
  startSupportPaymentReconciler
};


