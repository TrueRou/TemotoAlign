#!/usr/bin/env node

const requiredGlobals = [
    'Blob',
    'File',
    'ReadableStream',
]

const missing = requiredGlobals.filter(name => !(name in globalThis))

if (missing.length > 0) {
    console.error(`Missing globals: ${missing.join(', ')}`)
    process.exit(1)
}

console.log('Capability smoke check passed')
