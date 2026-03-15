import io
import logging
import os
import threading

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

app = FastAPI(title="AI Background Remover API")
IS_VERCEL = bool(os.environ.get("VERCEL"))

# Vercel compatibility: set model home to /tmp
if IS_VERCEL:
    os.environ["U2NET_HOME"] = "/tmp/.u2net"

# CORS — allow the Vite dev server and common origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
}
MAX_FILE_SIZE = 4 * 1024 * 1024 if IS_VERCEL else 20 * 1024 * 1024
DEFAULT_MODEL_NAME = "u2netp" if IS_VERCEL else "isnet-general-use"
DEFAULT_MODE = "best"

SUPPORTED_MODELS = {
    "u2netp": "Serverless-safe lightweight model",
    "birefnet-general-lite": "Ultra-High Precision (Slow)",
    "isnet-general-use": "Pro Quality (Balanced - Default)",
    "u2net": "Legacy Model",
}

if IS_VERCEL:
    QUALITY_MODES = {
        "best": {"max_side": 960, "default_model": DEFAULT_MODEL_NAME},
        "balanced": {"max_side": 768, "default_model": DEFAULT_MODEL_NAME},
        "fast": {"max_side": 512, "default_model": DEFAULT_MODEL_NAME},
    }
else:
    QUALITY_MODES = {
        "best": {"max_side": 1280, "default_model": "isnet-general-use"},
        "balanced": {"max_side": 1024, "default_model": "isnet-general-use"},
        "fast": {"max_side": 768, "default_model": "isnet-general-use"},
    }

CPU_COUNT = os.cpu_count() or 4
INFERENCE_THREADS = 1 if IS_VERCEL else max(1, min(4, CPU_COUNT))

logger = logging.getLogger("uvicorn.error")

def get_execution_providers():
    """Return stable execution providers for ONNX Runtime.

    CoreML can be faster on Apple Silicon, but it is not always stable across
    local/dev environments. Keep CPU as the safe default and allow opting into
    CoreML explicitly when desired.
    """
    import onnxruntime as ort

    available = set(ort.get_available_providers())
    if os.environ.get("ENABLE_COREML", "").lower() in {"1", "true", "yes"} and "CoreMLExecutionProvider" in available:
        return ["CoreMLExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


# ── Pre-load model session at startup ─────────────────────────────────
_session_cache: dict[str, object] = {}
_session_providers: dict[str, list[str]] = {}
_model_ready = threading.Event()  # set once default model is loaded


def create_session(model_name: str):
    """Create one rembg session with tuned ONNX runtime settings."""
    import onnxruntime as ort
    from rembg.sessions import sessions as rembg_sessions

    session_class = rembg_sessions.get(model_name)
    if session_class is None:
        raise ValueError(f"Unsupported model '{model_name}'.")

    preferred_providers = get_execution_providers()
    providers_to_try = [preferred_providers]
    if preferred_providers != ["CPUExecutionProvider"]:
        providers_to_try.append(["CPUExecutionProvider"])

    last_error = None
    for providers in providers_to_try:
        try:
            sess_opts = ort.SessionOptions()
            sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            sess_opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            sess_opts.inter_op_num_threads = 1
            sess_opts.intra_op_num_threads = INFERENCE_THREADS
            return session_class(model_name, sess_opts, providers=providers), providers
        except Exception as exc:  # pragma: no cover - provider fallback path
            last_error = exc

    raise RuntimeError(f"Could not initialize model '{model_name}'.") from last_error


def get_session(model_name: str):
    """Return a cached session, loading it only once per model."""
    if model_name not in _session_cache:
        session, providers = create_session(model_name)
        _session_cache[model_name] = session
        _session_providers[model_name] = providers
    return _session_cache[model_name]


def resolve_model_and_mode(model_name: str | None, mode: str) -> tuple[str, int]:
    """Resolve the request into a validated model and inference size."""
    if mode not in QUALITY_MODES:
        valid_modes = ", ".join(QUALITY_MODES.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported mode '{mode}'. Accepted values: {valid_modes}.",
        )

    profile = QUALITY_MODES[mode]
    resolved_model = model_name or profile["default_model"]
    if resolved_model not in SUPPORTED_MODELS:
        valid_models = ", ".join(SUPPORTED_MODELS.keys())
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported model '{resolved_model}'. Accepted values: {valid_models}.",
        )

    return resolved_model, profile["max_side"]


def open_uploaded_image(contents: bytes):
    """Open the upload once and normalize EXIF orientation."""
    from PIL import Image, ImageOps
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(contents)))
        image.load()
        return image
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail="Could not open the uploaded file as an image.",
        ) from exc


def resize_for_inference(image, max_side: int):
    """Downscale large images before inference while preserving aspect ratio."""
    from PIL import Image
    width, height = image.size
    if max(width, height) <= max_side:
        return image, False

    ratio = max_side / max(width, height)
    resized = image.resize(
        (
            max(1, int(round(width * ratio))),
            max(1, int(round(height * ratio))),
        ),
        Image.Resampling.LANCZOS,
    )
    return resized, True


def clean_alpha_edges(image):
    """Refine alpha edges with a safe SciPy fallback."""
    import numpy as np
    from PIL import Image, ImageFilter

    arr = np.array(image)
    alpha = arr[:, :, 3].astype(np.float32)

    # 1. Threshold: snap near-transparent / near-opaque pixels
    alpha[alpha < 45] = 0
    alpha[alpha > 210] = 255

    try:
        from scipy import ndimage
    except ImportError:
        ndimage = None

    if ndimage is not None and not IS_VERCEL:
        # 2. Morphological operations: close holes then erode background fringe
        binary_mask = (alpha > 128).astype(np.uint8)
        mask_refined = ndimage.binary_closing(binary_mask, iterations=1).astype(np.uint8)
        eroded = ndimage.binary_erosion(mask_refined, iterations=1).astype(np.uint8)

        # 3. Smooth the transition area
        boundary = mask_refined - eroded
        alpha[boundary == 1] = np.clip(alpha[boundary == 1] * 0.3, 0, 255)

    # 4. High-quality smoothing for the mask
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.SMOOTH_MORE)
    alpha = np.array(alpha_img)

    # 5. Final clean-up of artifacts
    alpha[alpha < 20] = 0
    alpha[alpha > 235] = 255

    arr[:, :, 3] = alpha
    return Image.fromarray(arr)


def process_image(
    contents: bytes,
    model_name: str,
    inference_max_side: int,
    alpha_matting: bool,
) -> io.BytesIO:
    """Run the full background-removal pipeline off the event loop."""
    from rembg import remove
    from PIL import Image

    original = open_uploaded_image(contents)
    orig_width, orig_height = original.size

    inference_image, needs_upscale = resize_for_inference(original, inference_max_side)
    session = get_session(model_name)

    result_image = remove(
        inference_image,
        session=session,
        alpha_matting=alpha_matting,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=15,
    )
    result_image = result_image.convert("RGBA")

    if needs_upscale:
        alpha_mask = result_image.getchannel("A").resize(
            (orig_width, orig_height),
            Image.Resampling.LANCZOS,
        )
        output_image = original.convert("RGBA")
        output_image.putalpha(alpha_mask)
    else:
        output_image = result_image

    output_image = clean_alpha_edges(output_image)

    buf = io.BytesIO()
    output_image.save(buf, format="PNG")
    buf.seek(0)
    return buf



@app.on_event("startup")
async def preload_default_model():
    """Kick off model loading in a background thread so startup is non-blocking."""
    if IS_VERCEL:
        return

    def _load():
        try:
            logger.info("[BG] Loading AI model '%s' in background...", DEFAULT_MODEL_NAME)
            get_session(DEFAULT_MODEL_NAME)
            _model_ready.set()
            logger.info("[BG] AI model ready.")
        except Exception as exc:  # pragma: no cover
            logger.error("[BG] Failed to load model: %s", exc)

    threading.Thread(target=_load, daemon=True).start()


@app.get("/")
async def root():
    return {"message": "AI Background Remover API is running"}


@app.get("/config")
async def config():
    return {
        "isVercel": IS_VERCEL,
        "defaultModel": DEFAULT_MODEL_NAME,
        "defaultMode": DEFAULT_MODE,
        "supportedModels": SUPPORTED_MODELS,
        "qualityModes": QUALITY_MODES,
        "maxFileSize": MAX_FILE_SIZE,
        "inferenceThreads": INFERENCE_THREADS,
    }


@app.post("/remove-background")
async def remove_background(
    image: UploadFile = File(...),
    model: str | None = Form(None),
    mode: str = Form(DEFAULT_MODE),
    alpha_matting: bool = Form(False),
):
    # ── Validate content type ──────────────────────────────────────────
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {image.content_type}. Accepted formats: jpg, jpeg, png, webp.",
        )

    # ── Read & validate file size ──────────────────────────────────────
    contents = await image.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(contents) / (1024*1024):.1f} MB). Maximum allowed size is 20 MB.",
        )

    resolved_model, inference_max_side = resolve_model_and_mode(model, mode)

    try:
        buf = await run_in_threadpool(
            process_image,
            contents,
            resolved_model,
            inference_max_side,
            alpha_matting,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Background removal failed: {str(exc)}",
        ) from exc

    # ── Return transparent PNG at full resolution ──────────────────────
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={
            "Content-Disposition": "attachment; filename=removed_bg.png",
            "X-Background-Model": resolved_model,
            "X-Quality-Mode": mode,
            "X-Execution-Provider": ",".join(
                _session_providers.get(resolved_model, get_execution_providers())
            ),
        },
    )
