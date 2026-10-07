# Project artwork rules

Before saving any square transparent prize, caller expression, badge or gem:

1. Preserve an existing original in Images/_drafts before replacing it. Never overwrite a previous backup.
2. Use Python image processing on the existing PNG; framing changes must not regenerate or redraw artwork.
3. Find the bounding box of all pixels whose alpha is greater than 10 and crop to it.
4. Resize proportionally with Pillow Lanczos so the longer side is exactly 820 pixels. Round the shorter side to the nearest even pixel so centering has exactly equal integer-pixel margins.
5. Paste onto a fully transparent 1024 x 1024 RGBA canvas, exactly centered. Paste without an alpha mask to preserve alpha rather than applying it twice.
6. Save as transparent PNG at the specified filename. Verify the saved alpha bounding box, dimensions and four margins.

This standing framing rule supersedes the earlier middle-80-percent guidance in IMAGE-BRIEF.md. The five section 7A images are approved. The user has authorized the remaining artwork in section 6 order, in batches of about six, excluding the logo. Match the approved pink pencil style, keep food simple and toy-like with reduced realistic surface detail, and check section 8 before saving each image.
