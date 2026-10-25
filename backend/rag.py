
from functools import lru_cache
from pathlib import Path
import hashlib

import chromadb
from sentence_transformers import SentenceTransformer

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "gp_information.txt"
DB_PATH = BASE_DIR / "chroma_db"

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_model():
    return SentenceTransformer(EMBEDDING_MODEL)


@lru_cache(maxsize=1)
def get_collection():
    client = chromadb.PersistentClient(path=str(DB_PATH))

    return client.get_or_create_collection(
        name="gp_knowledge_base",
        metadata={"hnsw:space": "cosine"},
    )


def load_documents():
    text = DATA_FILE.read_text(encoding="utf-8")

    sections = [
        section.strip()
        for section in text.split("\n\n")
        if section.strip()
    ]

    return sections


def index_documents():
    sections = load_documents()

    if not sections:
        raise ValueError("No documents found to index.")

    model = get_model()
    collection = get_collection()

    embeddings = model.encode(
        sections,
        normalize_embeddings=True,
    ).tolist()

    ids = [
        hashlib.sha256(section.encode()).hexdigest()
        for section in sections
    ]

    # Remove previously indexed sections so changed or
    # deleted information does not remain in the database.
    existing = collection.get(include=[])

    if existing["ids"]:
        collection.delete(ids=existing["ids"])

    collection.upsert(
        ids=ids,
        documents=sections,
        embeddings=embeddings,
        metadatas=[
            {
                "source": "gp_information.txt",
                "section": index,
            }
            for index in range(len(sections))
        ],
    )

    return len(sections)


def search_knowledge(question: str, top_k: int = 3):
    collection = get_collection()

    if collection.count() == 0:
        index_documents()

    model = get_model()

    query_embedding = model.encode(
        [question],
        normalize_embeddings=True,
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=min(top_k, collection.count()),
        include=["documents", "metadatas", "distances"],
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]
    distances = results["distances"][0]

    matches = []

    for document, metadata, distance in zip(
        documents, metadatas, distances
    ):
        matches.append({
            "content": document,
            "source": metadata["source"],
            "section": metadata["section"],
            "similarity": round(1 - distance, 4),
        })

    return matches


if __name__ == "__main__":
    count = index_documents()
    print(f"Indexed {count} GP document sections.")
