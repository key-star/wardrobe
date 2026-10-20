import 'fake-indexeddb/auto'
import { Blob as NodeBlob } from 'node:buffer'

// jsdom's Blob has no arrayBuffer() and does not survive structured cloning,
// so use Node's native Blob in tests to match browser behaviour.
globalThis.Blob = NodeBlob as unknown as typeof Blob
