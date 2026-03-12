# Admin Responses Tab + Text Alignment

## Date: 2026-03-12

## Summary

Add a 4th "Responses" tab to the admin dashboard that lists all respondents with expandable full submissions, inline editing of importance ratings and DoD text, and per-respondent deletion. Also fix text alignment so paragraph text is left-justified.

## New "Responses" Tab

### Layout
- List of respondents showing name (or "Anonymous") and submission date
- Each row expandable to show full submission
- Expanded view: all items grouped by category with importance (color-coded) and DoD text

### Per-Response Editing
- Edit button per response row opens inline edit mode
- Editable fields: importance (1-5 dropdown) and definition_of_done (textarea)
- Save/Cancel buttons to commit or discard
- Backend: `PATCH /admin/responses/:responseId` endpoint

### Per-Respondent Deletion
- Delete button on respondent row with confirmation prompt
- Uses existing `DELETE /admin/respondents/:id` (cascades to responses)
- No automatic consensus regeneration — user manually regenerates from Rankings tab

## Backend Changes

### New Endpoint
- `PATCH /admin/responses/:responseId` — updates importance and/or definition_of_done

### Existing Endpoints Used
- `GET /admin/respondents` — list respondents
- `GET /admin/items/:itemId/responses` — individual responses (may need new endpoint for per-respondent responses)
- `DELETE /admin/respondents/:id` — delete with cascade

### New Endpoint Needed
- `GET /admin/respondents/:id/responses` — get all responses for a single respondent with item details

## Text Alignment Fix

- Any paragraph text (DoD responses, descriptions) longer than ~2 lines should be left-justified
- Applies to: survey review screen DoD text, admin response views, consensus text
- CSS change: add `text-align: left` to relevant text containers
