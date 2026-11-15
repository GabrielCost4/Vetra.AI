export interface FaceResponse {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface RegisterFaceResponse {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  message: string;
}

export interface RecognizeFaceResponse {
  matched: boolean;
  id: string | null;
  name: string | null;
  distance: number | null;
  confidence: number | null;
  message: string;
}
