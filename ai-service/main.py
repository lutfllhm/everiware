import logging
import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import insightface
from insightface.app import FaceAnalysis

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("ai-service")

app = FastAPI(title="Everiware AI Service", description="Microservice for High-Accuracy Face Verification using InsightFace")

# Initialize InsightFace model
# buffalo_l is a comprehensive model containing RetinaFace (detection) and ArcFace (embedding)
# Using CPUExecutionProvider for standard deployments without GPU requirements
logger.info("Initializing InsightFace FaceAnalysis model (buffalo_l)...")
try:
    detector = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    # ctx_id=0 signifies CPU, det_size is the resolution size for face detector
    detector.prepare(ctx_id=0, det_size=(640, 640))
    logger.info("InsightFace FaceAnalysis model loaded and prepared successfully.")
except Exception as e:
    logger.error(f"Failed to initialize InsightFace: {e}")
    raise e

@app.post("/verify")
async def verify(selfie: UploadFile = File(...), reference: UploadFile = File(...)):
    try:
        logger.info(f"Received verification request: selfie='{selfie.filename}', reference='{reference.filename}'")

        # 1. Read and decode selfie image
        selfie_bytes = await selfie.read()
        nparr_selfie = np.frombuffer(selfie_bytes, np.uint8)
        img_selfie = cv2.imdecode(nparr_selfie, cv2.IMREAD_COLOR)

        # 2. Read and decode reference image
        ref_bytes = await reference.read()
        nparr_ref = np.frombuffer(ref_bytes, np.uint8)
        img_ref = cv2.imdecode(nparr_ref, cv2.IMREAD_COLOR)

        if img_selfie is None:
            logger.warning("Failed to decode selfie image.")
            raise HTTPException(status_code=400, detail="Format gambar selfie tidak valid")
        if img_ref is None:
            logger.warning("Failed to decode reference image.")
            raise HTTPException(status_code=400, detail="Format gambar referensi tidak valid")

        # 3. Detect faces and extract embeddings
        faces_selfie = detector.get(img_selfie)
        faces_ref = detector.get(img_ref)

        if not faces_selfie:
            logger.info("No face detected in check-in selfie.")
            return {
                "match": False,
                "similarity": 0.0,
                "message": "Wajah tidak terdeteksi pada foto selfie absensi. Silakan coba lagi dengan pencahayaan yang cukup."
            }
        
        if not faces_ref:
            logger.info("No face detected in reference photo.")
            return {
                "match": False,
                "similarity": 0.0,
                "message": "Wajah tidak terdeteksi pada foto profil referensi Anda. Silakan daftarkan ulang foto wajah Anda."
            }

        # 4. Extract embedding vector (InsightFace returns a list of faces sorted by size/score)
        # We compare the primary face (index 0) from both pictures
        feat_selfie = faces_selfie[0].normed_embedding
        feat_ref = faces_ref[0].normed_embedding

        # 5. Calculate Cosine Similarity
        # Since embeddings are already normalized (L2 norm = 1.0), the dot product equals the cosine similarity.
        similarity = float(np.dot(feat_selfie, feat_ref))

        # Recommended Cosine Similarity threshold for ArcFace (buffalo_l model) is typically 0.40 - 0.45.
        # 0.40 matches very well across various lighting and minor head angle deviations.
        threshold = 0.40
        match = similarity >= threshold

        logger.info(f"Verification completed. Cosine similarity: {similarity:.4f} (threshold: {threshold}) -> match={match}")

        return {
            "match": match,
            "similarity": similarity,
            "message": "Wajah terverifikasi" if match else "Wajah tidak cocok dengan akun kamu. Pastikan Anda melakukan absensi sendiri."
        }

    except Exception as e:
        logger.error(f"Inference error during verification: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "match": False,
                "similarity": 0.0,
                "message": f"Terjadi kesalahan sistem kecerdasan buatan (AI): {str(e)}"
            }
        )

@app.post("/detect")
async def detect(photo: UploadFile = File(...)):
    try:
        logger.info(f"Received face detection request: photo='{photo.filename}'")

        # 1. Read and decode photo image
        photo_bytes = await photo.read()
        nparr_photo = np.frombuffer(photo_bytes, np.uint8)
        img_photo = cv2.imdecode(nparr_photo, cv2.IMREAD_COLOR)

        if img_photo is None:
            logger.warning("Failed to decode photo image.")
            return {
                "success": False,
                "message": "Format gambar tidak valid atau rusak."
            }

        # 2. Detect faces
        faces = detector.get(img_photo)

        if not faces:
            logger.info("No face detected in registration photo.")
            return {
                "success": False,
                "message": "Wajah tidak terdeteksi pada foto. Silakan posisikan wajah Anda tegak menghadap kamera dengan pencahayaan yang cukup."
            }

        if len(faces) > 1:
            logger.info(f"Multiple faces ({len(faces)}) detected in registration photo.")
            return {
                "success": False,
                "message": "Terdeteksi lebih dari satu wajah. Pastikan hanya ada Anda sendirian di dalam foto."
            }

        logger.info("Face detected and validated successfully.")
        return {
            "success": True,
            "message": "Wajah berhasil terdeteksi dan valid."
        }

    except Exception as e:
        logger.error(f"Inference error during detection: {e}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "message": f"Terjadi kesalahan sistem kecerdasan buatan (AI): {str(e)}"
            }
        )

@app.get("/health")
def health():
    return {"status": "healthy", "model": "buffalo_l"}

