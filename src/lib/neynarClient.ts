// This file serves as an alias to satisfy imports expecting 'neynarClient'
import * as neynarExports from './neynar';

// Re-export all named exports
export * from './neynar';

// Re-export the client instance as the default export, if needed by other files
// NOTE: Your neynar.ts uses a getter, so files should import a specific function.
// If your imports look like: import neynarClient from '@/lib/neynarClient';
// then you may need a dedicated default export in neynar.ts itself. 
// For now, let's assume the consuming file needs the client function:

export default neynarExports.getNeynarClient; // Exports the getter function as default