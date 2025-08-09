// Minimal process env typing workaround
// (Can be replaced by proper @types/node if resolved in workspace)
declare const process: { env: Record<string, string | undefined> }
