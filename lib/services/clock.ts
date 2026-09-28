// Request time for server components: each request renders once, so reading the clock here is the
// "now" of that response. Client components use useNow().
export const nowMs = () => Date.now()
