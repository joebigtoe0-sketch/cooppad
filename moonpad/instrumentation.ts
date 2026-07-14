export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCurveIndexer } = await import("@/lib/server/curveIndexer");
    startCurveIndexer();
  }
}
