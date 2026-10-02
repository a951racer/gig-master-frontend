// Shared mapping of band-related API errors to user-friendly messages, so the
// several places that create/rename bands show consistent copy.

const BAND_NAME_TAKEN =
  'Band names must be unique. Please choose a different name.'

// Resolve a friendly message from an axios error for band create/rename.
// Special-cases the global unique-name guard (409 DUPLICATE_BAND_NAME); falls
// back to the API message, then the provided default.
export function bandErrorMessage(err, fallback = 'Something went wrong.') {
  const code = err?.response?.data?.error?.code
  if (code === 'DUPLICATE_BAND_NAME') return BAND_NAME_TAKEN
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message ||
    fallback
  )
}
