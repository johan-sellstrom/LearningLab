export declare function strToBytes(s: string): Uint8Array;
export declare function toMessageBytes(messages: string[]): Uint8Array[];
export declare function bytesToBase64(data: Uint8Array): string;
export declare function base64ToBytes(data: string): Uint8Array;
export declare function generateBbsKeypair(): Promise<Required<import("@mattrglobal/bbs-signatures").BlsKeyPair>>;
export declare function signMessages(messages: string[], secretKey: Uint8Array, publicKey: Uint8Array): Promise<Uint8Array<ArrayBufferLike>>;
export declare function deriveProof(signature: Uint8Array, publicKey: Uint8Array, messages: string[], revealed: number[], nonce?: string): Promise<Uint8Array<ArrayBufferLike>>;
export declare function verifySignature(messages: string[], signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
export declare function verifyProof(proof: Uint8Array, publicKey: Uint8Array, revealedMessages: string[], nonce?: string): Promise<boolean>;
