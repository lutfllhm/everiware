const sharp = require('sharp');
const path = require('path');

async function run() {
  const sfIn = '3415644e-45d4-486c-8fdc-da647b858ef0.jpg';
  const sfOut = '30d6bb25-2e50-4085-8633-8b0dbdbf8ecb.jpg';

  const sfInPath = path.join(__dirname, 'uploads', 'selfie', sfIn);
  const sfOutPath = path.join(__dirname, 'uploads', 'selfie', sfOut);

  try {
    const metaIn = await sharp(sfInPath).metadata();
    console.log('Selfie In Metadata:');
    console.log(metaIn);

    const metaOut = await sharp(sfOutPath).metadata();
    console.log('\nSelfie Out Metadata:');
    console.log(metaOut);
  } catch (err) {
    console.error(err);
  }
}
run();
