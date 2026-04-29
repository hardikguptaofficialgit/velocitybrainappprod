from __future__ import annotations

"""
Multimodal Processing Service for Velocity Brain.

This service processes and understands content from multiple modalities
including images, audio, video, and documents with advanced AI analysis.
"""

import json
import logging
import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union, BinaryIO, Tuple
from dataclasses import dataclass
from pathlib import Path
import tempfile
import os

try:
    import cv2
    import numpy as np
    from PIL import Image
    import whisper
    import pytesseract
    VISION_AVAILABLE = True
except ImportError:
    VISION_AVAILABLE = False
    cv2 = None
    np = None
    Image = None
    whisper = None
    pytesseract = None

from src.core.db import get_conn
from src.core.logging_config import get_logger
from src.core.config import settings


@dataclass
class MediaContent:
    """Processed content from multimodal input."""
    content_type: str  # 'text', 'image', 'audio', 'video'
    original_filename: str
    file_size: int
    extracted_text: str
    metadata: Dict[str, Any]
    entities: List[Dict[str, Any]]
    confidence: float
    processed_at: datetime


@dataclass
class ImageAnalysis:
    """Results from image analysis."""
    description: str
    objects_detected: List[Dict[str, Any]]
    text_extracted: str
    faces_detected: List[Dict[str, Any]]
    scene_analysis: str
    confidence: float


@dataclass
class AudioTranscription:
    """Results from audio transcription."""
    transcribed_text: str
    language_detected: str
    confidence: float
    duration_seconds: float
    speaker_count: int
    segments: List[Dict[str, Any]]


@dataclass
class VideoAnalysis:
    """Results from video analysis."""
    duration: float
    fps: float
    resolution: Tuple[int, int]
    frames_analyzed: int
    key_frames: List[Dict[str, Any]]
    audio_transcription: Optional[AudioTranscription]
    scene_changes: List[Dict[str, Any]]
    summary: str


class MultimodalProcessor:
    """Advanced multimodal content processing and analysis."""
    
    def __init__(self):
        self.logger = get_logger('multimodal_processor')
        self._initialize_models()
        
    def _initialize_models(self):
        """Initialize multimodal processing models."""
        if not VISION_AVAILABLE:
            self.logger.warning("Vision processing libraries not available. Some features will be limited.")
            return
        
        try:
            # Initialize Whisper model for audio transcription
            if whisper:
                self.whisper_model = whisper.load_model("base")
                self.logger.info("Loaded Whisper model for audio transcription")
            
            # Initialize OCR
            if pytesseract:
                self.logger.info("OCR capabilities available")
            
        except Exception as exc:
            self.logger.error(f"Failed to initialize multimodal models: {exc}")
    
    def process_image(self, image_data: bytes, filename: str) -> ImageAnalysis:
        """
        Process image using computer vision techniques.
        
        Extracts text, objects, faces, and scene information.
        """
        if not VISION_AVAILABLE:
            return ImageAnalysis(
                description="Image processing not available",
                objects_detected=[],
                text_extracted="",
                faces_detected=[],
                scene_analysis="",
                confidence=0.0
            )
        
        try:
            # Convert bytes to numpy array
            nparr = np.frombuffer(image_data, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if image is None:
                return ImageAnalysis(
                    description="Invalid image format",
                    objects_detected=[],
                    text_extracted="",
                    faces_detected=[],
                    scene_analysis="",
                    confidence=0.0
                )
            
            # Extract text using OCR
            text_extracted = self._extract_text_from_image(image)
            
            # Object detection (using basic techniques)
            objects_detected = self._detect_objects(image)
            
            # Face detection
            faces_detected = self._detect_faces(image)
            
            # Scene analysis
            scene_analysis = self._analyze_scene(image)
            
            # Calculate confidence based on extraction success
            confidence = self._calculate_image_confidence(
                text_extracted, objects_detected, faces_detected
            )
            
            return ImageAnalysis(
                description=f"Image contains {len(objects_detected)} objects and {len(faces_detected)} faces",
                objects_detected=objects_detected,
                text_extracted=text_extracted,
                faces_detected=faces_detected,
                scene_analysis=scene_analysis,
                confidence=confidence
            )
            
        except Exception as exc:
            self.logger.error(f"Image processing failed: {exc}")
            return ImageAnalysis(
                description=f"Processing error: {str(exc)}",
                objects_detected=[],
                text_extracted="",
                faces_detected=[],
                scene_analysis="",
                confidence=0.0
            )
    
    def _extract_text_from_image(self, image: np.ndarray) -> str:
        """Extract text from image using OCR."""
        if not pytesseract:
            return ""
        
        try:
            # Preprocess image for better OCR
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply thresholding
            _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Remove noise
            kernel = np.ones((1,1), np.uint8)
            processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=1)
            
            # OCR
            text = pytesseract.image_to_string(processed, config='--psm 6')
            
            return text.strip()
            
        except Exception as exc:
            self.logger.error(f"Text extraction failed: {exc}")
            return ""
    
    def _detect_objects(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect objects in image using basic computer vision."""
        objects = []
        
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Edge detection
            edges = cv2.Canny(gray, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            for i, contour in enumerate(contours):
                # Filter small contours
                area = cv2.contourArea(contour)
                if area < 1000:  # Filter small objects
                    continue
                
                # Get bounding box
                x, y, w, h = cv2.boundingRect(contour)
                
                # Simple object classification based on aspect ratio
                aspect_ratio = w / h
                if aspect_ratio > 2:
                    object_type = "wide_object"
                elif aspect_ratio < 0.5:
                    object_type = "tall_object"
                elif area > 10000:
                    object_type = "large_object"
                else:
                    object_type = "medium_object"
                
                objects.append({
                    'id': i,
                    'type': object_type,
                    'bounding_box': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                    'area': float(area),
                    'confidence': min(area / 50000, 1.0)  # Normalize confidence
                })
            
            return objects
            
        except Exception as exc:
            self.logger.error(f"Object detection failed: {exc}")
            return []
    
    def _detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detect faces in image."""
        if not VISION_AVAILABLE:
            return []
        
        try:
            # Load face cascade
            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            faces = face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30)
            )
            
            face_data = []
            for (x, y, w, h) in faces:
                face_data.append({
                    'bounding_box': {'x': int(x), 'y': int(y), 'width': int(w), 'height': int(h)},
                    'center': {'x': int(x + w/2), 'y': int(y + h/2)},
                    'size': int(w * h),
                    'confidence': min((w * h) / 10000, 1.0)
                })
            
            return face_data
            
        except Exception as exc:
            self.logger.error(f"Face detection failed: {exc}")
            return []
    
    def _analyze_scene(self, image: np.ndarray) -> str:
        """Analyze scene characteristics."""
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Calculate basic statistics
            brightness = np.mean(gray)
            contrast = np.std(gray)
            
            # Scene classification based on statistics
            if brightness > 200:
                scene_type = "bright_scene"
            elif brightness < 50:
                scene_type = "dark_scene"
            elif contrast > 100:
                scene_type = "high_contrast_scene"
            elif contrast < 30:
                scene_type = "low_contrast_scene"
            else:
                scene_type = "normal_scene"
            
            # Detect if image is mostly text
            edges = cv2.Canny(gray, 50, 150)
            edge_density = np.sum(edges > 0) / edges.size
            
            if edge_density > 0.1:
                scene_type += "_with_text"
            
            return scene_type
            
        except Exception as exc:
            self.logger.error(f"Scene analysis failed: {exc}")
            return "unknown_scene"
    
    def _calculate_image_confidence(self, text: str, objects: List, faces: List) -> float:
        """Calculate overall confidence for image analysis."""
        confidence_factors = []
        
        # Text extraction confidence
        if text.strip():
            confidence_factors.append(0.8)  # Good confidence if text extracted
        
        # Object detection confidence
        if objects:
            avg_object_confidence = np.mean([obj['confidence'] for obj in objects])
            confidence_factors.append(avg_object_confidence)
        
        # Face detection confidence
        if faces:
            avg_face_confidence = np.mean([face['confidence'] for face in faces])
            confidence_factors.append(avg_face_confidence)
        
        return np.mean(confidence_factors) if confidence_factors else 0.0
    
    def process_audio(self, audio_data: bytes, filename: str) -> AudioTranscription:
        """
        Process audio using speech-to-text transcription.
        
        Transcribes audio content and detects language and speakers.
        """
        if not VISION_AVAILABLE or not whisper:
            return AudioTranscription(
                transcribed_text="Audio processing not available",
                language_detected="unknown",
                confidence=0.0,
                duration_seconds=0.0,
                speaker_count=0,
                segments=[]
            )
        
        try:
            # Save audio to temporary file
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
                temp_file.write(audio_data)
                temp_file_path = temp_file.name
            
            # Transcribe using Whisper
            result = self.whisper_model.transcribe(
                temp_file_path,
                fp16=False,
                language=None,  # Auto-detect language
                task="transcribe"
            )
            
            # Clean up temporary file
            os.unlink(temp_file_path)
            
            # Calculate duration (approximate)
            duration = len(audio_data) / (16000 * 2)  # Assuming 16kHz, 16-bit audio
            
            # Extract segments
            segments = []
            for segment in result.get('segments', []):
                segments.append({
                    'start': segment['start'],
                    'end': segment['end'],
                    'text': segment['text'],
                    'confidence': 0.8  # Whisper doesn't provide per-segment confidence
                })
            
            return AudioTranscription(
                transcribed_text=result['text'],
                language_detected=result.get('language', 'unknown'),
                confidence=0.8,  # Whisper generally has good accuracy
                duration_seconds=duration,
                speaker_count=1,  # Whisper doesn't detect multiple speakers in base model
                segments=segments
            )
            
        except Exception as exc:
            self.logger.error(f"Audio transcription failed: {exc}")
            return AudioTranscription(
                transcribed_text=f"Transcription error: {str(exc)}",
                language_detected="unknown",
                confidence=0.0,
                duration_seconds=0.0,
                speaker_count=0,
                segments=[]
            )
    
    def process_video(self, video_data: bytes, filename: str) -> VideoAnalysis:
        """
        Process video for content analysis.
        
        Extracts frames, analyzes key scenes, and combines with audio transcription.
        """
        if not VISION_AVAILABLE:
            return VideoAnalysis(
                duration=0.0,
                fps=0.0,
                resolution=(0, 0),
                frames_analyzed=0,
                key_frames=[],
                audio_transcription=None,
                scene_changes=[],
                summary="Video processing not available"
            )
        
        try:
            # Save video to temporary file
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                temp_file.write(video_data)
                temp_file_path = temp_file.name
            
            # Open video
            cap = cv2.VideoCapture(temp_file_path)
            
            if not cap.isOpened():
                os.unlink(temp_file_path)
                return VideoAnalysis(
                    duration=0.0,
                    fps=0.0,
                    resolution=(0, 0),
                    frames_analyzed=0,
                    key_frames=[],
                    audio_transcription=None,
                    scene_changes=[],
                    summary="Could not open video file"
                )
            
            # Get video properties
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps if fps > 0 else 0
            
            # Sample frames for analysis
            frames_analyzed = min(100, total_frames)  # Analyze up to 100 frames
            key_frames = []
            scene_changes = []
            
            frame_count = 0
            prev_frame = None
            
            while frame_count < frames_analyzed:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Sample every 30th frame for key frame analysis
                if frame_count % 30 == 0:
                    # Simple scene change detection
                    if prev_frame is not None:
                        diff = cv2.absdiff(prev_frame, frame)
                        diff_mean = np.mean(diff)
                        
                        if diff_mean > 20:  # Threshold for scene change
                            scene_changes.append({
                                'frame_number': frame_count,
                                'timestamp': frame_count / fps,
                                'change_intensity': float(diff_mean)
                            })
                    
                    key_frames.append({
                        'frame_number': frame_count,
                        'timestamp': frame_count / fps,
                        'description': f"Key frame at {frame_count/fps:.2f}s"
                    })
                
                prev_frame = frame
                frame_count += 1
            
            cap.release()
            os.unlink(temp_file_path)
            
            # Extract audio if available (simplified)
            audio_transcription = None
            if filename.lower().endswith(('.mp4', '.avi', '.mov')):
                # This would require separate audio extraction
                audio_transcription = AudioTranscription(
                    transcribed_text="Audio extraction from video not implemented",
                    language_detected="unknown",
                    confidence=0.0,
                    duration_seconds=duration,
                    speaker_count=0,
                    segments=[]
                )
            
            # Generate summary
            summary = f"Video analyzed: {frames_analyzed} frames, {len(key_frames)} key frames, {len(scene_changes)} scene changes"
            
            return VideoAnalysis(
                duration=duration,
                fps=fps,
                resolution=(width, height),
                frames_analyzed=frames_analyzed,
                key_frames=key_frames,
                audio_transcription=audio_transcription,
                scene_changes=scene_changes,
                summary=summary
            )
            
        except Exception as exc:
            self.logger.error(f"Video processing failed: {exc}")
            return VideoAnalysis(
                duration=0.0,
                fps=0.0,
                resolution=(0, 0),
                frames_analyzed=0,
                key_frames=[],
                audio_transcription=None,
                scene_changes=[],
                summary=f"Processing error: {str(exc)}"
            )
    
    def store_multimodal_content(self, content: MediaContent, entity_id: int) -> None:
        """Store processed multimodal content in database."""
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Store in timeline events
                    cur.execute("""
                        INSERT INTO timeline_events 
                            (entity_id, event_ts, source_type, source_ref, event_md, event_payload)
                        VALUES (%s, NOW(), %s, %s, %s, %s, %s)
                    """, (
                        entity_id,
                        f"multimodal_{content.content_type}",
                        content.original_filename,
                        f"Processed {content.content_type} content",
                        content.extracted_text[:500],
                        json.dumps({
                            'content_type': content.content_type,
                            'file_size': content.file_size,
                            'confidence': content.confidence,
                            'objects_detected': getattr(content, 'objects_detected', []),
                            'faces_detected': getattr(content, 'faces_detected', []),
                            'metadata': content.metadata
                        }, default=str)
                    ))
                    
                    # Update entity with multimodal content
                    if content.extracted_text:
                        # Append to compiled truth
                        cur.execute("""
                            UPDATE entities 
                            SET compiled_truth_md = compiled_truth_md || %s,
                                updated_at = NOW()
                            WHERE id = %s
                        """, (
                            f"\n\nMultimodal content from {content.content_type}:\n{content.extracted_text}",
                            entity_id
                        ))
                    
                    conn.commit()
                    
            self.logger.info(f"Stored multimodal content: {content.content_type} for entity {entity_id}")
            
        except Exception as exc:
            self.logger.error(f"Failed to store multimodal content: {exc}")
    
    def extract_entities_from_multimodal(self, content: MediaContent) -> List[Dict[str, Any]]:
        """Extract entities from multimodal content."""
        entities = []
        
        # Extract entities from text content
        if content.extracted_text:
            text_entities = self._extract_text_entities(content.extracted_text)
            entities.extend(text_entities)
        
        # Extract entities from image analysis
        if content.content_type == 'image' and hasattr(content, 'objects_detected'):
            for obj in content.objects_detected:
                entities.append({
                    'text': f"detected_{obj.get('type', 'object')}",
                    'type': 'detected_object',
                    'confidence': obj.get('confidence', 0.5),
                    'source': 'image_analysis'
                })
        
        # Extract entities from audio transcription
        if content.content_type == 'audio' and hasattr(content, 'segments'):
            for segment in content.segments:
                text = segment.get('text', '')
                if text:
                    audio_entities = self._extract_text_entities(text)
                    entities.extend(audio_entities)
        
        return entities
    
    def _extract_text_entities(self, text: str) -> List[Dict[str, Any]]:
        """Extract entities from text using NLP techniques."""
        entities = []
        
        # Simple entity extraction patterns
        patterns = {
            'email': r'\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b',
            'phone': r'\b(\+?1[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b',
            'date': r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2})\b',
            'money': r'\$\d+(?:\.\d{2})?\b',
            'url': r'\b(https?://[^\s]+)\b',
        }
        
        for entity_type, pattern in patterns.items():
            matches = re.finditer(pattern, text)
            for match in matches:
                entities.append({
                    'text': match.group(),
                    'type': entity_type,
                    'start': match.start(),
                    'end': match.end(),
                    'confidence': 0.9
                })
        
        return entities


# Global instance
multimodal_processor = MultimodalProcessor()
