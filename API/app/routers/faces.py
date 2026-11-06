from fastapi import APIRouter

router = APIRouter(
    prefix="/api/faces",
    tags=["Faces"]
)

@router.post("/register") 
async def register_face():
    return {"message":"Face cadastrada!"}

@router.post("/recognize")
async def recognize_face():
    return {"message": "Reconhecimento facial"}