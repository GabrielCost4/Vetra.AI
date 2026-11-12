import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FaceResponse, RecognizeFaceResponse, RegisterFaceResponse } from '../models/face.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class FaceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/faces`;

  registerFace(
    name: string,
    imageBlob: Blob,
    filename = 'capture.jpg',
  ): Observable<RegisterFaceResponse> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', imageBlob, filename);
    return this.http.post<RegisterFaceResponse>(`${this.apiUrl}/register`, formData);
  }

  recognizeFace(imageBlob: Blob, filename = 'capture.jpg'): Observable<RecognizeFaceResponse> {
    const formData = new FormData();
    formData.append('image', imageBlob, filename);
    return this.http.post<RecognizeFaceResponse>(`${this.apiUrl}/recognize`, formData);
  }

  listFaces(): Observable<FaceResponse[]> {
    return this.http.get<FaceResponse[]>(this.apiUrl);
  }

  deleteFace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
