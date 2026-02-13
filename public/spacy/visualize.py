import importlib
import io
import json
import zipfile

from pyodide.http import pyfetch  # pyright: ignore[reportMissingImports]

PACKAGES_URL_PREFIX = "__SPACY_PACKAGES_BASE_URL__"
if PACKAGES_URL_PREFIX == "__SPACY_PACKAGES_BASE_URL__":
    PACKAGES_URL_PREFIX = "/spacy/packages"
SITE_PACKAGES_PATH = "/lib/python3.10/site-packages"

SPACY_MODEL_NAME = "en_core_web_sm"
SPACY_MODEL_VERSION = "3.4.0"
SPACY_MODEL_WHEEL_FILE = f"{SPACY_MODEL_NAME}-{SPACY_MODEL_VERSION}-py3-none-any.whl"

SPACY_CORE_WHEEL_FILES = [
    "blis-0.7.8-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "cymem-2.0.6-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "murmurhash-1.0.7-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "preshed-3.0.6-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "srsly-2.4.3-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "thinc-8.1.0-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "spacy-3.4.0-cp310-cp310-emscripten_3_1_14_wasm32.whl",
]

SPACY_RUNTIME_WHEEL_FILES = [
    "numpy-1.22.4-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "typing_extensions-4.2.0-py3-none-any.whl",
    "pydantic-1.9.1-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "pyparsing-3.0.9-py3-none-any.whl",
    "packaging-21.3-py3-none-any.whl",
    "setuptools-62.6.0-py3-none-any.whl",
    "MarkupSafe-2.1.1-cp310-cp310-emscripten_3_1_14_wasm32.whl",
    "Jinja2-3.1.2-py3-none-any.whl",
    "catalogue-2.0.10-py3-none-any.whl",
    "wasabi-0.10.1-py3-none-any.whl",
    "click-8.3.1-py3-none-any.whl",
    "typer-0.4.2-py3-none-any.whl",
    "smart_open-6.4.0-py3-none-any.whl",
    "pathlib_abc-0.1.1-py3-none-any.whl",
    "pathy-0.11.0-py3-none-any.whl",
    "langcodes-3.5.1-py3-none-any.whl",
    "spacy_legacy-3.0.12-py2.py3-none-any.whl",
    "spacy_loggers-1.0.5-py3-none-any.whl",
    "tqdm-4.64.0-py2.py3-none-any.whl",
]

SPACY_WHEEL_FILES = SPACY_RUNTIME_WHEEL_FILES + SPACY_CORE_WHEEL_FILES + [SPACY_MODEL_WHEEL_FILE]
SPACY_WHEEL_URLS = [f"{PACKAGES_URL_PREFIX}/{wheel_file}" for wheel_file in SPACY_WHEEL_FILES]

_NLP = None
_WHEELS_INSTALLED = False


def _stub_requests_module():
    import sys
    import types

    # spaCy imports CLI modules that require requests/urllib3;
    # in Pyodide we only need core NLP runtime.
    sys.modules.setdefault("requests", types.ModuleType("requests"))


async def _install_local_wheels_once():
    global _WHEELS_INSTALLED
    if _WHEELS_INSTALLED:
        return

    for wheel_url in SPACY_WHEEL_URLS:
        response = await pyfetch(wheel_url)
        if not response.ok:
            raise RuntimeError(
                f"failed_to_fetch_wheel: {wheel_url} status={response.status}"
            )
        wheel_bytes = await response.bytes()
        with zipfile.ZipFile(io.BytesIO(wheel_bytes), "r") as wheel_archive:
            wheel_archive.extractall(SITE_PACKAGES_PATH)

    importlib.invalidate_caches()
    _WHEELS_INSTALLED = True


def _get_nlp():
    global _NLP
    if _NLP is None:
        _stub_requests_module()
        import spacy  # pyright: ignore[reportMissingImports]

        try:
            _NLP = spacy.load(
                SPACY_MODEL_NAME,
                exclude=["ner", "lemmatizer", "textcat", "entity_linker", "entity_ruler"],
            )
        except Exception:
            _NLP = spacy.load(SPACY_MODEL_NAME)
    return _NLP


def analyze(text):
    nlp = _get_nlp()
    doc = nlp(text)

    sent_id_of = {}
    sent_id = 0
    for sent in doc.sents:
        for token in sent:
            sent_id_of[int(token.i)] = sent_id
        sent_id += 1

    tokens = []
    for token in doc:
        tokens.append(
            {
                "i": int(token.i),
                "start": int(token.idx),
                "end": int(token.idx + len(token.text)),
                "text": token.text,
                "pos": token.pos_,
                "tag": token.tag_,
                "dep": token.dep_,
                "head": int(token.head.i),
                "sent": int(sent_id_of.get(int(token.i), 0)),
                "is_root": bool(token.dep_ == "ROOT"),
            }
        )

    return json.dumps({"text": text, "tokens": tokens})


await _install_local_wheels_once()
