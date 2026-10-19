import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { derivePath } from "ed25519-hd-key";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const PATH = "m/44'/501'/0'/0'";

function hex(bytes: Uint8Array) {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

export function generateSolanaWallet() {
  return walletFromMnemonic(generateMnemonic(wordlist, 128));
}

export function walletFromMnemonic(mnemonic: string) {
  const phrase = mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
  if (!validateMnemonic(phrase, wordlist)) throw new Error("That seed phrase is not a valid 12 or 24 word phrase.");
  const seed = mnemonicToSeedSync(phrase);
  const derived = derivePath(PATH, hex(seed));
  const keypair = Keypair.fromSeed(derived.key);
  return {
    address: keypair.publicKey.toBase58(),
    mnemonic: phrase,
    secretKey: bs58.encode(keypair.secretKey),
  };
}

export function walletFromSecret(secret: string) {
  try {
    const keypair = Keypair.fromSecretKey(bs58.decode(secret.trim()));
    return {
      address: keypair.publicKey.toBase58(),
      mnemonic: "",
      secretKey: bs58.encode(keypair.secretKey),
    };
  } catch {
    throw new Error("That is not a Solana private key.");
  }
}
