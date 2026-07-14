/**
 * CPU worker: brute-force keypairs until one ends with suffix; posts hit to parent.
 * Parent terminates workers when enough hits are collected.
 */
const { parentPort, workerData } = require("worker_threads");
const { Keypair } = require("@solana/web3.js");

const suffix = workerData.suffix;
const reportEvery = workerData.reportEvery ?? 200_000;

let localAttempts = 0;

for (;;) {
  localAttempts++;
  if (localAttempts % reportEvery === 0) {
    parentPort.postMessage({ type: "progress", n: localAttempts });
    localAttempts = 0;
  }

  const kp = Keypair.generate();
  const pub = kp.publicKey.toBase58();
  if (!pub.endsWith(suffix)) continue;

  parentPort.postMessage({
    type: "hit",
    publicKey: pub,
    secretKey: Array.from(kp.secretKey),
  });
}
