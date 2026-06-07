Take a screenshot of the Student Pathway Dashboard and check for visual issues.

## Steps

1. Run the screenshot script:

   ```
   node scripts/screenshot.js
   ```

2. Read the saved image from `debug/screenshot-*.png` (pick the most recent file).

3. Report on:
   - Overall layout — header, form section, eligibility cards, footer visible and unclipped
   - Form dropdowns (School, Subject, Level, Grade, Bonus Points) properly styled
   - Eligibility pathway cards rendering correctly with green/red status colours
   - Any broken Tailwind styles, font issues, or overlapping elements
   - Mobile/narrow viewport issues if applicable

## Notes

- The app loads via `file://` — CDN resources (Tailwind, Google Fonts) require an internet connection to render correctly
- No server required; open directly from disk
- Screenshots are saved to `debug/` (git-ignored)
