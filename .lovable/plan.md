The user approved removing the failing `news-sitemap.xml` from both the repo and Google Search Console, keeping the working `sitemap.xml`.

## Actions
1. Delete `public/news-sitemap.xml` from the project repo.
2. Remove the `news-sitemap.xml` submission from Google Search Console via the connector gateway so only the working `sitemap.xml` remains.

## Verification
- Confirm `public/news-sitemap.xml` no longer exists.
- Confirm GSC API call succeeds (HTTP 200 or 404, since the file may not have been successfully submitted).