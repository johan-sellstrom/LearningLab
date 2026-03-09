// Minimal, teachable wrapper around @mattrglobal/bbs-signatures so the lab
// participants can read the API surface in plain TypeScript.
import {
  blsCreateProof,
  blsSign,
  blsVerify,
  blsVerifyProof,
  generateBls12381G2KeyPair,
} from '@mattrglobal/bbs-signatures'

export function strToBytes(s: string): Uint8Array {
  return Uint8Array.from(Buffer.from(s, 'utf-8'))
}

export function toMessageBytes(messages: string[]): Uint8Array[] {
  return messages.map(strToBytes)
}

export function bytesToBase64(data: Uint8Array): string {
  return Buffer.from(data).toString('base64')
}

export function base64ToBytes(data: string): Uint8Array {
  return Uint8Array.from(Buffer.from(data, 'base64'))
}

export async function generateBbsKeypair() {
  // Generates a BLS12-381 keypair that is compatible with BBS+ signatures.
  return generateBls12381G2KeyPair()
}

export async function signMessages(messages: string[], secretKey: Uint8Array, publicKey: Uint8Array) {
  // Signs an ordered list of string messages with BBS+. The order matters
  // because selective disclosure proofs reference positions by index.
  const signature = await blsSign({ keyPair: { secretKey, publicKey }, messages: toMessageBytes(messages) })
  return signature
}

export async function deriveProof(
  signature: Uint8Array,
  publicKey: Uint8Array,
  messages: string[],
  revealed: number[],
  nonce: string = 'nonce'
) {
  // Derives an unlinkable proof that reveals only the indices listed in
  // `revealed`. The nonce binds the proof to a session (prevents replay).
  const proof = await blsCreateProof({
    signature,
    publicKey,
    messages: toMessageBytes(messages),
    nonce: strToBytes(nonce),
    revealed,
  })
  return proof
}

export async function verifySignature(messages: string[], signature: Uint8Array, publicKey: Uint8Array) {
  // Verifies a full BBS+ signature over all messages (no selective disclosure).
  const result = await blsVerify({
    messages: toMessageBytes(messages),
    publicKey,
    signature,
  })
  return result.verified
}

export async function verifyProof(
  proof: Uint8Array,
  publicKey: Uint8Array,
  revealedMessages: string[],
  nonce: string = 'nonce'
) {
  // Verifies a derived proof: checks that the revealed messages and nonce match
  // what the prover committed to, without learning the hidden messages.
  const result = await blsVerifyProof({
    proof,
    publicKey,
    messages: toMessageBytes(revealedMessages),
    nonce: strToBytes(nonce),
  })
  return result.verified
}
