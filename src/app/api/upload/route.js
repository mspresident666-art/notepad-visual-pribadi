import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request) {
  try {
    const { filename, contentType } = await request.json();

    if (!filename || !contentType) {
      return Response.json({ error: "Filename dan ContentType diperlukan" }, { status: 400 });
    }

    const ext = filename.split(".").pop();
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: contentType,
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = `/api/media/${uniqueFileName}`;

    return Response.json({ signedUrl, url: publicUrl });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Gagal membuat link upload: " + error.message }, { status: 500 });
  }
}
