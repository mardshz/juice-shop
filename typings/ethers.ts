/*
 * Temporary minimal typings for the `ethers` package to satisfy TypeScript compilation.
 * This file is included in the TS build by adding "typings/**.ts" to tsconfig.include.
 *
 * These typings intentionally keep everything as `any` to avoid having to pull in
 * the full `ethers` types in this codebase.
 */

declare module 'ethers' {
  export const HDNodeWallet: any
  export const WebSocketProvider: any
  export const Contract: any
}
