# Test pages

`violations.html` is a page with known accessibility violations. Serve it with

```sh
npm run test-page
```

and open http://localhost:5180/violations.html. Click the extension icon, then **Scan page**.

Expected result with axe-core 4.14: 9 issues on 9 elements.

| Severity | Rule | Element |
|---|---|---|
| Critical | `button-name` | `#icon-button` |
| Critical | `image-alt` | `#swatch` |
| Critical | `label` | `#search` |
| Serious | `color-contrast` | `#low-contrast` |
| Serious | `html-has-lang` | `html` |
| Serious | `link-name` | `#empty-link` |
| Moderate | `heading-order` | `#skipped-level` |
| Moderate | `region` | `#outside-landmark` |
| Minor | `empty-heading` | `#empty-heading` |
