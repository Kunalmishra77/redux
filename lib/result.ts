// Coding standards § Errors: `code` is a stable machine string; `message` is written for the
// person reading it. Never surface a raw database error.
export type Result<T> = { ok: true; data: T } | { ok: false; code: string; message: string }
