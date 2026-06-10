const sharp = require('sharp');
const path = require('path');

async function extractFaceRegion(imagePath, bbox = null) {
  try {
    let pipeline = sharp(imagePath).rotate(); // Auto-orient image based on EXIF metadata

    if (bbox) {
      const metadata = await sharp(imagePath).metadata();
      let imgW = metadata.width;
      let imgH = metadata.height;
      if (metadata.orientation && metadata.orientation >= 5 && metadata.orientation <= 8) {
        imgW = metadata.height;
        imgH = metadata.width;
      }

      console.log(`Original: ${metadata.width}x${metadata.height}, Rotated: ${imgW}x${imgH}`);

      const left = Math.max(0, Math.round(bbox.x));
      const top = Math.max(0, Math.round(bbox.y));
      const width = Math.min(imgW - left, Math.round(bbox.width));
      const height = Math.min(imgH - top, Math.round(bbox.height));

      console.log(`Extracting: left=${left}, top=${top}, width=${width}, height=${height}`);

      if (width > 0 && height > 0) {
        pipeline = pipeline.extract({
          left: left,
          top: top,
          width: width,
          height: height,
        });
      }
    }

    const { data } = await pipeline
      .resize(64, 64, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return data;
  } catch (err) {
    console.error('[FaceVerification] extractFaceRegion error:', err.message);
    return null;
  }
}

async function run() {
  const sf = '30d6bb25-2e50-4085-8633-8b0dbdbf8ecb.jpg';
  const sfPath = path.join(__dirname, 'uploads', 'selfie', sf);

  // Coba dengan bbox out-of-bounds yang sebelumnya menyebabkan crash
  // Anggap bbox dari ML Kit dalam sistem koordinat portrait 720x1280
  const mockBbox = { x: 100, y: 400, width: 350, height: 600 }; // y+height = 1000, melebihi 720 jika landscape

  const buf = await extractFaceRegion(sfPath, mockBbox);
  console.log(`Buffer extracted: ${buf ? 'SUCCESS' : 'FAILED'} (length: ${buf ? buf.length : 0})`);
}

run();
