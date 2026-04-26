import { S3Client, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function GET(request, { params }) {
  try {
    const { filename } = await params;
    const { searchParams } = new URL(request.url);
    const isDownload = searchParams.get("download") === "1";
    const range = request.headers.get("range");

    if (range) {
      // === RANGE REQUEST (untuk video seeking & playback) ===
      // Pertama, ambil metadata file
      const headCommand = new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
      });
      const headResponse = await s3.send(headCommand);
      const fileSize = headResponse.ContentLength;
      const contentType = headResponse.ContentType || "application/octet-stream";

      // Parse range header: "bytes=0-" atau "bytes=0-999999"
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      // Batasi chunk 2MB supaya streaming lancar
      const maxChunk = 2 * 1024 * 1024;
      const end = parts[1]
        ? Math.min(parseInt(parts[1], 10), fileSize - 1)
        : Math.min(start + maxChunk - 1, fileSize - 1);
      const chunkSize = end - start + 1;

      // Ambil range dari R2
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
        Range: `bytes=${start}-${end}`,
      });
      const response = await s3.send(command);

      // Konversi AWS SDK stream ke Web ReadableStream
      const webStream = response.Body.transformToWebStream();

      const headers = new Headers();
      headers.set("Content-Type", contentType);
      headers.set("Content-Length", chunkSize.toString());
      headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      if (isDownload) headers.set("Content-Disposition", `attachment; filename="${filename}"`);

      return new Response(webStream, { status: 206, headers });
    } else {
      // === FULL REQUEST (gambar atau request tanpa range) ===
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: filename,
      });
      const response = await s3.send(command);

      // Konversi AWS SDK stream ke Web ReadableStream
      const webStream = response.Body.transformToWebStream();

      const headers = new Headers();
      headers.set("Content-Type", response.ContentType || "application/octet-stream");
      if (response.ContentLength) {
        headers.set("Content-Length", response.ContentLength.toString());
      }
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
      headers.set("Accept-Ranges", "bytes");
      if (isDownload) headers.set("Content-Disposition", `attachment; filename="${filename}"`);

      return new Response(webStream, { status: 200, headers });
    }
  } catch (error) {
    console.error("Media proxy error:", error);
    return Response.json({ error: "File not found" }, { status: 404 });
  }
}
