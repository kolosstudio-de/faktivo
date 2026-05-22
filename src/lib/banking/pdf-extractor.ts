/**
 * PDF text extraction utility (Node.js / serverless friendly).
 *
 * Uses `unpdf` — a server-friendly fork of pdfjs without web-worker
 * requirements. Works in Node, Edge runtimes, Cloudflare Workers, etc.
 *
 * Returns concatenated text content of all pages plus the page count.
 *
 * Throws `Error("PDF_EXTRACTION_FAILED")` on any extraction problem so
 * the caller can surface a clean error message to the user.
 */

export interface ExtractedPdf {
  text: string
  pages: number
}

export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  try {
    // unpdf is ESM-only; dynamic import works in Next.js server routes.
    const { extractText, getDocumentProxy } = await import("unpdf")

    // unpdf accepts ArrayBuffer / Uint8Array.
    const data = new Uint8Array(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength,
    )

    // getDocumentProxy → text + page count in one pass.
    const pdf = await getDocumentProxy(data)
    // mergePages: true returns text as a single string.
    const result = await extractText(pdf, { mergePages: true })
    const text: string = (result.text as unknown as string) ?? ""

    return {
      text,
      pages: result.totalPages ?? 0,
    }
  } catch (err) {
    console.error("[pdf-extractor] extraction failed:", err)
    throw new Error("PDF_EXTRACTION_FAILED")
  }
}
