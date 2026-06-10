const { verifyFace } = require('./src/utils/faceVerification');
const path = require('path');
const fs = require('fs');

async function run() {
  const av = 'a4aa57bf-6e70-4c62-897e-2413af96de59.jpg';
  const sfIn = '3415644e-45d4-486c-8fdc-da647b858ef0.jpg';
  const sfOut = '30d6bb25-2e50-4085-8633-8b0dbdbf8ecb.jpg';

  const avPath = path.join(__dirname, 'uploads', 'avatar', av);
  const sfInPath = path.join(__dirname, 'uploads', 'selfie', sfIn);
  const sfOutPath = path.join(__dirname, 'uploads', 'selfie', sfOut);

  console.log(`Avatar: ${av} (exists: ${fs.existsSync(avPath)})`);
  console.log(`Selfie In: ${sfIn} (exists: ${fs.existsSync(sfInPath)})`);
  console.log(`Selfie Out: ${sfOut} (exists: ${fs.existsSync(sfOutPath)})`);

  try {
    const resIn = await verifyFace(sfIn, av, null);
    console.log('\nResult for Check-In:');
    console.log(resIn);

    const resOut = await verifyFace(sfOut, av, null);
    console.log('\nResult for Check-Out:');
    console.log(resOut);
  } catch (err) {
    console.error(err);
  }
}
run();
