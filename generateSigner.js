// generateSigner.js
import { NobleEd25519Signer } from '@farcaster/hub-nodejs';
import * as ed from '@noble/ed25519';

async function generateKeys() {
  // Generate random private key bytes using @noble/ed25519
  const privateKeyBytes = ed.utils.randomPrivateKey();
  
  // Create a signer with the private key
  const ed25519Signer = new NobleEd25519Signer(privateKeyBytes);

  // Get the public key from the signer
  const publicKeyResult = await ed25519Signer.getSignerKey();
  if (publicKeyResult.isErr()) {
    console.error("Could not extract public key:", publicKeyResult.error);
    return;
  }
  const publicKeyBytes = publicKeyResult.value;

  // Convert the raw byte arrays to hexadecimal strings.
  // Hex strings are easier to copy, paste, and store in .env files.
  const privateKeyHex = Buffer.from(privateKeyBytes).toString('hex');
  const publicKeyHex = Buffer.from(publicKeyBytes).toString('hex');

  console.log("\n✅ Generated Ed25519 Signer Keypair Successfully!");
  console.log("==================================================================");
  console.log("🔴 PRIVATE KEY (HEX) - KEEP THIS SECRET AND SECURE! 🔴");
  console.log("==================================================================");
  console.log(privateKeyHex);
  console.log("==================================================================");
  console.log("\n🟢 PUBLIC KEY (HEX) - Used for on-chain registration 🟢");
  console.log("   (It will need a '0x' prefix when used on-chain)");
  console.log("==================================================================");
  console.log(publicKeyHex); // The '0x' prefix should be added when you use it, not stored with it usually
  console.log("==================================================================");
  console.log("\nACTION REQUIRED:");
  console.log("1. Securely save the PRIVATE KEY HEX. You'll add it to your .env file later as FARCASTER_SIGNER_PRIVATE_KEY.");
  console.log("2. Copy the PUBLIC KEY HEX. You will need to prefix it with '0x' (e.g., 0x" + publicKeyHex + ") for Step B.1.4 (on-chain Signer authorization).");
  console.log("------------------------------------------------------------------\n");
}

generateKeys().catch(err => {
  console.error("\n❌ Error generating keys:", err);
  console.error("Ensure you have run 'npm install @farcaster/hub-nodejs @noble/ed25519' in this project directory.\n");
});