-- Add animation_prompts column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS animation_prompts JSONB DEFAULT '[
  {
    "id": "loop",
    "name": "Seamless Loop",
    "prompt": "Look at this image. Write a single prompt for Kling AI to generate a SEAMLESS LOOP animation based on this image.\n\nUSER CONTEXT: {{user_prompt}}\n\nCRITICAL REQUIREMENTS:\n1. **Loop**: The animation must be a consecutive loop (start frame = end frame).\n2. **Camera**: STATIC CAMERA ONLY. No pan, no zoom, no tilt.\n3. **Motion**: Only small, internal effects (wind, fog, water flow, breathing).\n4. **Output**: A single comma-separated string suitable for image-to-video generation.\n\nAnalyze the subject and depth. Describe the scene and specify subtle motions."
  },
  {
    "id": "zoom_in",
    "name": "Slow Zoom In",
    "prompt": "Look at this image. Write a single prompt for Kling AI to generate a SLOW ZOOM IN animation based on this image.\n\nUSER CONTEXT: {{user_prompt}}\n\nCRITICAL REQUIREMENTS:\n1. **Camera**: Slow, steady push in (dolly in).\n2. **Motion**: Preserve the scene structure, just move the camera closer.\n3. **Output**: A single comma-separated string suitable for image-to-video generation."
  }
]'::jsonb;
